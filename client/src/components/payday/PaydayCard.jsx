import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiAlertTriangle, FiCheckCircle, FiGift } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useFinance } from "../../context/FinanceContext";
import { getPaydayAPI, updateProfileAPI } from "../../services/api";
import { formatRupiah } from "../../utils/format";
import DropdownMenu from "../ui/DropdownMenu";
import "../../styles/payday.css";

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: i === 30 ? "Tanggal 31 (akhir bulan)" : `Tanggal ${i + 1}`,
}));

const fmtDate = (key, opts = { weekday: "long", day: "numeric", month: "long" }) =>
    new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", opts);

const STATUS = {
    aman: { label: "Aman", icon: FiCheckCircle },
    waspada: { label: "Waspada", icon: FiAlertTriangle },
    minus: { label: "Kurang", icon: FiAlertTriangle },
};

/** Kartu "sisa aman sampai gajian" di dashboard. */
export default function PaydayCard() {
    const { user, updateUser } = useAuth();
    const { totalBalance } = useFinance();
    const [data, setData] = useState(null);
    const [key, setKey] = useState(null);
    const [error, setError] = useState(false);
    const reqKey = `${user?.payday || 0}:${totalBalance}`;

    useEffect(() => {
        let alive = true;
        getPaydayAPI()
            .then((res) => {
                if (!alive) return;
                setData(res.data);
                setError(false);
                setKey(reqKey);
            })
            .catch(() => {
                if (!alive) return;
                setError(true);
                setKey(reqKey);
            });
        return () => {
            alive = false;
        };
    }, [reqKey]);

    if (key === null && !data) return <section className="pd-card pd-skeleton" aria-busy />;
    if (error && !data) return null;
    if (!data?.configured) return <PaydaySetup onSaved={(u) => updateUser(u)} />;

    const d = data;
    const S = STATUS[d.status] || STATUS.aman;
    const cyclePct = Math.min(100, Math.round(((d.dayOfCycle - 1) / Math.max(1, d.cycleLength)) * 100));
    const over = d.leftToday < 0;
    const maxBar = Math.max(d.dailyAllowance, ...d.series.map((s) => s.spend || 0), 1);

    return (
        <section className={`pd-card is-${d.status}`}>
            <div className="pd-main">
                <span className="pd-kicker">
                    <FiCalendar aria-hidden /> Sampai gajian · {fmtDate(d.nextPayday)}
                </span>
                {d.isPayday && (
                    <div className="pd-payday">
                        <FiGift aria-hidden /> Hari ini gajian! Sisihkan dulu untuk tabungan sebelum dibelanjakan.
                    </div>
                )}
                <div className="pd-big">
                    <strong>{formatRupiah(d.dailyAllowance)}</strong>
                    <span>/ hari</span>
                </div>
                <p className={`pd-today ${over ? "is-over" : ""}`}>
                    {over
                        ? `Hari ini sudah lewat ${formatRupiah(-d.leftToday)} dari jatah.`
                        : d.spentToday > 0
                          ? `Sisa jatah hari ini ${formatRupiah(d.leftToday)} (terpakai ${formatRupiah(d.spentToday)}).`
                          : "Belum ada belanja hari ini."}
                </p>

                <div className="pd-bars" aria-label="Belanja harian di siklus gaji ini">
                    {d.series.map((s) => (
                        <span
                            key={s.key}
                            className={`${s.future ? "is-future" : ""} ${(s.spend || 0) > d.dailyAllowance ? "is-over" : ""}`}
                            style={{ height: s.future ? "100%" : `${Math.max(4, ((s.spend || 0) / maxBar) * 100)}%` }}
                            title={`${fmtDate(s.key, { day: "numeric", month: "short" })}: ${s.future ? "belum" : formatRupiah(s.spend || 0)}`}
                        />
                    ))}
                    <i style={{ bottom: `${(d.dailyAllowance / maxBar) * 100}%` }} aria-hidden />
                </div>
                <div className="pd-bars-legend">
                    <span>{fmtDate(d.lastPayday, { day: "numeric", month: "short" })}</span>
                    <span>Garis = jatah harian</span>
                    <span>{fmtDate(d.nextPayday, { day: "numeric", month: "short" })}</span>
                </div>
            </div>

            <div className="pd-countdown">
                <div className="pd-ring" style={{ "--p": `${cyclePct}%` }}>
                    <div>
                        <strong>{d.daysLeft}</strong>
                        <span>hari lagi</span>
                    </div>
                </div>
                <span className={`pd-status is-${d.status}`}>
                    <S.icon aria-hidden /> {S.label}
                </span>
            </div>

            <dl className="pd-math">
                <div>
                    <dt>Saldo siap pakai</dt>
                    <dd>{formatRupiah(d.liquid)}</dd>
                </div>
                <div>
                    <dt>
                        Tagihan sebelum gajian{d.bills.length ? ` (${d.bills.length})` : ""}
                    </dt>
                    <dd className="is-neg">−{formatRupiah(d.billsTotal)}</dd>
                </div>
                <div className="is-total">
                    <dt>Bisa dipakai</dt>
                    <dd className={d.spendable < 0 ? "is-neg" : ""}>{formatRupiah(d.spendable)}</dd>
                </div>
                <p className="pd-proj">
                    {d.spendable <= 0
                        ? "Saldo tidak cukup untuk tagihan sebelum gajian. Tunda belanja yang tidak penting."
                        : d.projectedLeft >= 0
                          ? `Dengan laju ${formatRupiah(d.avgDaily)}/hari, saat gajian masih tersisa sekitar ${formatRupiah(d.projectedLeft)}.`
                          : `Dengan laju ${formatRupiah(d.avgDaily)}/hari, uangmu kurang sekitar ${formatRupiah(-d.projectedLeft)} sebelum gajian.`}
                </p>
                {d.bills.length > 0 && (
                    <ul className="pd-bills">
                        {d.bills.slice(0, 3).map((b, i) => (
                            <li key={`${b.id}-${i}`}>
                                <span>{b.name}</span>
                                <span>{fmtDate(b.date, { day: "numeric", month: "short" })}</span>
                                <strong>{formatRupiah(b.amount)}</strong>
                            </li>
                        ))}
                        {d.bills.length > 3 && <li className="pd-more">+{d.bills.length - 3} tagihan lain</li>}
                    </ul>
                )}
                <Link to="/settings#keuangan" className="pd-edit">
                    Gajian tanggal {d.payday} · ubah
                </Link>
            </dl>
        </section>
    );
}

function PaydaySetup({ onSaved }) {
    const [day, setDay] = useState("25");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const save = async () => {
        setSaving(true);
        setErr("");
        try {
            const res = await updateProfileAPI({ payday: Number(day) });
            onSaved(res.data);
        } catch (e) {
            setErr(e.response?.data?.message || "Gagal menyimpan.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="pd-card pd-setup">
            <div className="pd-setup-text">
                <span className="pd-kicker">
                    <FiCalendar aria-hidden /> Sisa aman sampai gajian
                </span>
                <h3>Berapa yang aman dipakai per hari sampai gajian?</h3>
                <p>
                    Atur tanggal gajianmu. DailyTrack menghitung jatah harian dari saldo siap pakai dikurangi tagihan
                    rutin yang jatuh sebelum gajian.
                </p>
            </div>
            <div className="pd-setup-form">
                <DropdownMenu value={day} options={DAY_OPTIONS} onChange={setDay} minWidth="200px" label="Aku gajian setiap" />
                <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Menyimpan..." : "Hitung jatahku"}
                </button>
                {err && <span className="pd-err">{err}</span>}
            </div>
        </section>
    );
}
