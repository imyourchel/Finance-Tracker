import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiUsers, FiAlertTriangle, FiClock, FiInbox, FiX, FiArrowUpRight, FiArrowDownLeft } from "react-icons/fi";
import PageHeader from "../components/Layout/PageHeader";
import { useFinance } from "../context/FinanceContext";
import { confirmDialog } from "../utils/confirm";
import { formatRupiah } from "../utils/format";
import {
    getDebtsAPI,
    createDebtAPI,
    updateDebtAPI,
    deleteDebtAPI,
    addDebtPaymentAPI,
    deleteDebtPaymentAPI,
    createSplitAPI,
    deleteSplitAPI,
} from "../services/debtApi";
import DebtForm from "../components/debts/DebtForm";
import SplitForm from "../components/debts/SplitForm";
import DebtRow from "../components/debts/DebtRow";
import PersonCard from "../components/debts/PersonCard";
import SplitCard from "../components/debts/SplitCard";
import { dueLabel, fmtDate } from "../components/debts/utils";
import "../styles/debts.css";

const msg = (err) => err.response?.data?.message || "Terjadi kesalahan. Coba lagi sebentar.";

/** Utang-piutang & patungan. */
export default function Debts() {
    const { wallets, categories, refresh } = useFinance();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [panel, setPanel] = useState(null); // debt | split
    const [tab, setTab] = useState("orang");
    const [personFilter, setPersonFilter] = useState(null);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await getDebtsAPI();
            setData(res.data);
            setError("");
        } catch (err) {
            setError(msg(err));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        getDebtsAPI()
            .then((res) => alive && setData(res.data))
            .catch((err) => alive && setError(msg(err)));
        return () => {
            alive = false;
        };
    }, []);

    /** Jalankan aksi; data terbaru dikembalikan server. true = sukses, string = pesan error. */
    const run = async (fn, { touchesWallet = true } = {}) => {
        setBusy(true);
        try {
            const res = await fn();
            setData(res.data);
            if (touchesWallet) refresh();
            return true;
        } catch (err) {
            return msg(err);
        } finally {
            setBusy(false);
        }
    };
    const alertFail = (text) => confirmDialog({ title: "Belum berhasil", message: text, alertOnly: true });

    const people = useMemo(() => {
        if (!data) return [];
        const seen = new Map();
        for (const d of data.debts) if (!seen.has(d.personKey)) seen.set(d.personKey, d.person);
        return [...seen.values()];
    }, [data]);
    const debtsById = useMemo(() => Object.fromEntries((data?.debts || []).map((d) => [d._id, d])), [data]);

    if (!data) {
        return (
            <div className="dbt-page">
                <PageHeader title="Utang & Piutang" subtitle="Memuat catatan..." />
                {error ? (
                    <div className="dbt-empty">
                        <strong>{error}</strong>
                        <button type="button" className="btn-ghost" onClick={load}>
                            Coba lagi
                        </button>
                    </div>
                ) : (
                    <div className="dbt-hero dbt-skeleton" />
                )}
            </div>
        );
    }

    const { summary, debts, splits } = data;
    const open = debts.filter((d) => d.status === "open");
    const settled = debts.filter((d) => d.status === "settled");
    const alerts = open.filter((d) => d.overdue || (d.daysToDue !== null && d.daysToDue - 1 <= 3)).slice(0, 4);
    const activeSplits = splits.filter((s) => !s.done);
    const visibleOpen = personFilter ? open.filter((d) => d.personKey === personFilter) : open;

    const TABS = [
        { id: "orang", label: "Per orang", n: summary.people.length },
        { id: "catatan", label: "Catatan aktif", n: open.length },
        { id: "patungan", label: "Patungan", n: activeSplits.length || splits.length },
        { id: "lunas", label: "Lunas", n: settled.length },
    ];

    // ── Aksi ────────────────────────────────────────────────
    const createDebt = async (payload) => {
        const ok = await run(() => createDebtAPI(payload), { touchesWallet: Boolean(payload.walletId) });
        if (ok === true) {
            setPanel(null);
            setTab("catatan");
        }
        return ok;
    };
    const createSplit = async (payload) => {
        const ok = await run(() => createSplitAPI(payload), { touchesWallet: Boolean(payload.walletId) });
        if (ok === true) {
            setPanel(null);
            setTab("patungan");
        }
        return ok;
    };
    const pay = (d, payload) => run(() => addDebtPaymentAPI(d._id, payload), { touchesWallet: Boolean(payload.walletId) });
    const update = async (d, payload) => {
        const ok = await confirmDialog({
            title: "Simpan perubahan?",
            message: `Catatan ${d.direction === "owed_to_me" ? "piutang" : "utang"} ${d.person} akan diperbarui.`,
            confirmLabel: "Simpan",
            danger: false,
        });
        if (!ok) return false;
        return run(() => updateDebtAPI(d._id, payload), { touchesWallet: false });
    };
    const remove = async (d) => {
        const ok = await confirmDialog({
            title: `Hapus catatan ${d.person}?`,
            message: d.wallet || d.payments.some((p) => p.wallet)
                ? "Semua transaksi wallet dari catatan ini ikut dibatalkan dan saldonya dikembalikan."
                : "Catatan dan riwayat pembayarannya akan dihapus.",
            confirmLabel: "Hapus",
        });
        if (!ok) return;
        const res = await run(() => deleteDebtAPI(d._id));
        if (res !== true) alertFail(res);
    };
    const undoPayment = async (d, p) => {
        const ok = await confirmDialog({
            title: "Batalkan pembayaran ini?",
            message: `${formatRupiah(p.amount)} pada ${fmtDate(p.date, true)} dibatalkan${p.wallet ? ` dan saldo ${p.wallet.name} dikembalikan` : ""}.`,
            confirmLabel: "Batalkan pembayaran",
        });
        if (!ok) return;
        const res = await run(() => deleteDebtPaymentAPI(d._id, p._id));
        if (res !== true) alertFail(res);
    };
    const toggleParticipant = async (s, p, debt) => {
        if (!debt) return;
        if (debt.status !== "settled") {
            const ok = await confirmDialog({
                title: `${p.name} sudah bayar?`,
                message: `Tandai ${formatRupiah(debt.remaining)} diterima${s.wallet ? ` ke ${s.wallet.name}` : ""}.`,
                confirmLabel: "Ya, sudah bayar",
                danger: false,
            });
            if (!ok) return;
            setBusyId(debt._id);
            const res = await run(() =>
                addDebtPaymentAPI(debt._id, { amount: debt.remaining, walletId: s.wallet?._id || null, note: `Patungan ${s.title}` }),
            );
            setBusyId(null);
            if (res !== true) alertFail(res);
            return;
        }
        const ok = await confirmDialog({
            title: `Batalkan tanda lunas ${p.name}?`,
            message: "Semua pembayaran untuk bagian ini dibatalkan dan saldo wallet dikembalikan.",
            confirmLabel: "Batalkan",
        });
        if (!ok) return;
        setBusyId(debt._id);
        let res = true;
        for (const pm of debt.payments) {
            res = await run(() => deleteDebtPaymentAPI(debt._id, pm._id));
            if (res !== true) break;
        }
        setBusyId(null);
        if (res !== true) alertFail(res);
    };
    const removeSplit = async (s) => {
        const ok = await confirmDialog({
            title: `Hapus patungan "${s.title}"?`,
            message: s.wallet
                ? `Semua piutang dari patungan ini dihapus, transaksinya dibatalkan, dan saldo ${s.wallet.name} dikembalikan.`
                : "Semua piutang dari patungan ini ikut dihapus.",
            confirmLabel: "Hapus patungan",
        });
        if (!ok) return;
        const res = await run(() => deleteSplitAPI(s._id));
        if (res !== true) alertFail(res);
    };

    const rowProps = { wallets, onPay: pay, onUndoPayment: undoPayment, onUpdate: update, onDelete: remove, busy };

    return (
        <div className="dbt-page">
            <PageHeader
                title="Utang & Piutang"
                subtitle="Pinjaman antar teman dan patungan, tercatat rapi tanpa canggung."
                action={
                    <div className="dbt-head-actions">
                        <button type="button" className="btn-ghost" onClick={() => setPanel(panel === "split" ? null : "split")}>
                            <FiUsers aria-hidden /> Patungan
                        </button>
                        <button type="button" className="btn-primary" onClick={() => setPanel(panel === "debt" ? null : "debt")}>
                            <FiPlus aria-hidden /> Catat
                        </button>
                    </div>
                }
            />

            {panel === "debt" && <DebtForm wallets={wallets} people={people} busy={busy} onSubmit={createDebt} onCancel={() => setPanel(null)} />}
            {panel === "split" && (
                <SplitForm wallets={wallets} categories={categories} people={people} busy={busy} onSubmit={createSplit} onCancel={() => setPanel(null)} />
            )}

            <section className="dbt-hero">
                <div className="dbt-hero-main">
                    <span className="dbt-kicker">Posisi bersih</span>
                    <strong className={`dbt-net ${summary.net < 0 ? "is-neg" : ""}`}>
                        {summary.net > 0 ? "+" : summary.net < 0 ? "−" : ""}
                        {formatRupiah(Math.abs(summary.net))}
                    </strong>
                    <p>
                        {summary.openCount === 0
                            ? "Tidak ada utang maupun piutang yang berjalan. Bersih!"
                            : summary.net > 0
                              ? "Uangmu yang masih di tangan orang lain lebih besar daripada utangmu."
                              : summary.net < 0
                                ? "Utangmu lebih besar daripada uang yang dipinjam orang lain."
                                : "Utang dan piutangmu seimbang."}
                    </p>
                    {summary.owedToMe + summary.iOwe > 0 && (
                        <div className="dbt-balance-bar" aria-hidden>
                            <span className="is-in" style={{ flex: summary.owedToMe || 0.0001 }} />
                            <span className="is-out" style={{ flex: summary.iOwe || 0.0001 }} />
                        </div>
                    )}
                </div>
                <div className="dbt-hero-stats">
                    <div className="dbt-stat is-in">
                        <span>
                            <FiArrowUpRight aria-hidden /> Piutang
                        </span>
                        <strong>{formatRupiah(summary.owedToMe)}</strong>
                        <small>orang lain berutang ke kamu</small>
                    </div>
                    <div className="dbt-stat is-out">
                        <span>
                            <FiArrowDownLeft aria-hidden /> Utang
                        </span>
                        <strong>{formatRupiah(summary.iOwe)}</strong>
                        <small>kamu berutang ke orang lain</small>
                    </div>
                    <div className={`dbt-stat ${summary.overdueCount ? "is-late" : ""}`}>
                        <span>
                            <FiClock aria-hidden /> Jatuh tempo
                        </span>
                        <strong>
                            {summary.overdueCount
                                ? `${summary.overdueCount} lewat`
                                : summary.nextDue
                                  ? fmtDate(summary.nextDue.dueDate)
                                  : "—"}
                        </strong>
                        <small>
                            {summary.overdueCount
                                ? "segera ditagih atau dibayar"
                                : summary.nextDue
                                  ? `${summary.nextDue.person} · ${formatRupiah(summary.nextDue.remaining)}`
                                  : "tidak ada jatuh tempo"}
                        </small>
                    </div>
                </div>
            </section>

            {alerts.length > 0 && (
                <div className="dbt-alerts">
                    {alerts.map((d) => {
                        const due = dueLabel(d);
                        return (
                            <div key={d._id} className={`dbt-alert is-${due?.tone || "soon"}`}>
                                <FiAlertTriangle aria-hidden />
                                <span>
                                    <strong>{d.person}</strong>
                                    {d.direction === "owed_to_me"
                                        ? ` belum melunasi ${formatRupiah(d.remaining)}`
                                        : ` — utangmu ${formatRupiah(d.remaining)}`}
                                    {d.note ? ` (${d.note})` : ""}
                                </span>
                                <em>{due?.text}</em>
                            </div>
                        );
                    })}
                </div>
            )}

            <nav className="dbt-tabs" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className={`ach-tab ${tab === t.id ? "is-active" : ""}`}
                        onClick={() => {
                            setTab(t.id);
                            if (t.id !== "catatan") setPersonFilter(null);
                        }}
                    >
                        {t.label}
                        {t.n > 0 && <span className="ach-tab-count">{t.n}</span>}
                    </button>
                ))}
            </nav>

            {tab === "orang" &&
                (summary.people.length ? (
                    <div className="dbt-people-grid">
                        {summary.people.map((p) => (
                            <PersonCard
                                key={p.key}
                                p={p}
                                items={open.filter((d) => d.personKey === p.key)}
                                onOpen={() => {
                                    setPersonFilter(p.key);
                                    setTab("catatan");
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <Empty onDebt={() => setPanel("debt")} onSplit={() => setPanel("split")} />
                ))}

            {tab === "catatan" && (
                <section className="dbt-list">
                    {personFilter && (
                        <div className="dbt-filter">
                            Menampilkan catatan <strong>{summary.people.find((p) => p.key === personFilter)?.name || personFilter}</strong>
                            <button type="button" className="dbt-icon-btn" onClick={() => setPersonFilter(null)} aria-label="Hapus filter">
                                <FiX />
                            </button>
                        </div>
                    )}
                    {visibleOpen.length ? (
                        visibleOpen.map((d) => <DebtRow key={d._id} d={d} {...rowProps} />)
                    ) : (
                        <Empty onDebt={() => setPanel("debt")} onSplit={() => setPanel("split")} />
                    )}
                </section>
            )}

            {tab === "patungan" &&
                (splits.length ? (
                    <div className="dbt-split-grid">
                        {splits.map((s) => (
                            <SplitCard key={s._id} s={s} debtsById={debtsById} onToggle={toggleParticipant} onDelete={removeSplit} busyId={busyId} />
                        ))}
                    </div>
                ) : (
                    <div className="dbt-empty">
                        <FiUsers aria-hidden />
                        <strong>Belum ada patungan</strong>
                        <span>Bayar makan bareng atau sewa villa dulu? Bagi tagihannya di sini, lalu tandai siapa yang sudah bayar.</span>
                        <button type="button" className="btn-primary" onClick={() => setPanel("split")}>
                            Buat patungan
                        </button>
                    </div>
                ))}

            {tab === "lunas" && (
                <section className="dbt-list">
                    {settled.length ? (
                        settled.map((d) => <DebtRow key={d._id} d={d} {...rowProps} />)
                    ) : (
                        <div className="dbt-empty">
                            <FiInbox aria-hidden />
                            <strong>Belum ada yang lunas</strong>
                            <span>Catatan yang sudah dibayar penuh akan pindah ke sini.</span>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function Empty({ onDebt, onSplit }) {
    return (
        <div className="dbt-empty">
            <FiInbox aria-hidden />
            <strong>Belum ada utang-piutang berjalan</strong>
            <span>Catat pinjaman ke teman atau bagi tagihan patungan supaya tidak ada yang terlupa.</span>
            <div className="dbt-empty-actions">
                <button type="button" className="btn-ghost" onClick={onSplit}>
                    <FiUsers aria-hidden /> Patungan
                </button>
                <button type="button" className="btn-primary" onClick={onDebt}>
                    <FiPlus aria-hidden /> Catat utang/piutang
                </button>
            </div>
        </div>
    );
}
