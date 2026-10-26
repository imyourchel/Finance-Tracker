import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiPrinter, FiX, FiAlertCircle } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { getBudgetsAPI, getGoalsAPI, getTransactionsAPI } from "../../services/api";
import { getInsightsOverviewAPI } from "../../services/insightsApi";
import { formatRupiah, MONTHS } from "../../utils/format";

const pct = (n) => `${Math.round(Number(n) || 0)}%`;
const fmtDay = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const delta = (cur, prev) => {
    if (!prev) return null;
    const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
    return p;
};

const BUDGET_STATUS = { safe: "Aman", warn: "Waspada", danger: "Hampir habis", over: "Jebol" };
const GOAL_HEALTH = {
    completed: "Tercapai",
    "on-track": "Sesuai jadwal",
    behind: "Tertinggal",
    overdue: "Lewat target",
    "not-started": "Belum mulai",
    steady: "Berjalan",
    stalled: "Mandek",
};

/** Laporan bulanan siap cetak. Salinannya dipasang di <body> supaya hanya laporan yang tercetak. */
export default function MonthlyReport({ month, year, onClose }) {
    const { user } = useAuth();
    const [state, setState] = useState({ loading: true, error: "", data: null });

    useEffect(() => {
        let alive = true;
        Promise.all([
            getInsightsOverviewAPI({ month, year }),
            getBudgetsAPI({ month, year }).catch(() => ({ data: [] })),
            getGoalsAPI().catch(() => ({ data: [] })),
            getTransactionsAPI({ month, year, type: "expense", sort: "amount_desc", limit: 10 }),
        ])
            .then(([ov, bd, gl, tx]) => {
                if (!alive) return;
                const goals = Array.isArray(gl.data) ? gl.data : gl.data?.goals || [];
                setState({
                    loading: false,
                    error: "",
                    data: {
                        overview: ov.data,
                        budgets: Array.isArray(bd.data) ? bd.data : bd.data?.budgets || [],
                        goals: goals.filter((g) => g.status !== "cancelled"),
                        top: (tx.data?.transactions || []).filter((t) => !t.goalId && !t.debtId),
                    },
                });
            })
            .catch((err) => {
                if (alive) setState({ loading: false, error: err.response?.data?.message || "Laporan gagal dimuat.", data: null });
            });
        return () => {
            alive = false;
        };
    }, [month, year]);

    const label = `${MONTHS[month - 1]} ${year}`;

    return (
        <section className="rp-wrap" aria-label={`Laporan ${label}`}>
            <div className="rp-toolbar">
                <div>
                    <strong>Laporan {label}</strong>
                    <span>Pilih "Simpan sebagai PDF" di jendela cetak untuk menyimpan PDF.</span>
                </div>
                <div className="rp-toolbar-actions">
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        <FiX aria-hidden /> Tutup
                    </button>
                    <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!state.data}>
                        <FiPrinter aria-hidden /> Cetak / Simpan PDF
                    </button>
                </div>
            </div>

            {state.loading ? (
                <div className="rp-doc rp-skeleton" aria-busy />
            ) : state.error ? (
                <div className="rp-error">
                    <FiAlertCircle aria-hidden /> {state.error}
                </div>
            ) : (
                <>
                    <ReportDoc data={state.data} label={label} user={user} />
                    {createPortal(
                        <div className="dt-print-root">
                            <ReportDoc data={state.data} label={label} user={user} />
                        </div>,
                        document.body,
                    )}
                </>
            )}
        </section>
    );
}

function ReportDoc({ data, label, user }) {
    const { overview: o, budgets, goals, top } = data;
    const cur = o?.current || {};
    const prev = o?.previous || {};
    const cats = o?.categories || [];
    const kpis = [
        { label: "Pemasukan", value: cur.income, prev: prev.income },
        { label: "Pengeluaran", value: cur.expense, prev: prev.expense, invert: true },
        { label: "Sisa", value: cur.net, prev: prev.net },
        { label: "Disisihkan ke goal", value: cur.goalSaved, prev: prev.goalSaved },
    ];

    return (
        <article className="rp-doc">
            <header className="rp-head">
                <div className="rp-brand">
                    <img src="/brand/logo-128.webp" alt="" />
                    <div>
                        <span>DailyTrack</span>
                        <small>Laporan keuangan bulanan</small>
                    </div>
                </div>
                <div className="rp-period">
                    <h1>{label}</h1>
                    <small>
                        {user?.name ? `${user.name} · ` : ""}dibuat{" "}
                        {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </small>
                </div>
            </header>

            <section className="rp-kpis">
                {kpis.map((k) => {
                    const d = delta(k.value || 0, k.prev || 0);
                    const good = d === null ? null : k.invert ? d <= 0 : d >= 0;
                    return (
                        <div key={k.label}>
                            <span>{k.label}</span>
                            <strong className={k.label === "Sisa" && (k.value || 0) < 0 ? "is-neg" : ""}>
                                {formatRupiah(k.value || 0)}
                            </strong>
                            {d !== null && (
                                <small className={good ? "is-good" : "is-bad"}>
                                    {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}% vs {o?.period?.previousLabel || "bulan lalu"}
                                </small>
                            )}
                        </div>
                    );
                })}
            </section>
            <p className="rp-note">
                Rasio tabungan <b>{pct(cur.savingRate)}</b> dari pemasukan · {cur.count || 0} transaksi tercatat. Transfer
                antar-wallet dan setoran goal tidak dihitung sebagai pemasukan atau pengeluaran.
            </p>

            <section className="rp-section">
                <h2>Pengeluaran per kategori</h2>
                {cats.length ? (
                    <table className="rp-table">
                        <thead>
                            <tr>
                                <th>Kategori</th>
                                <th className="num">Total</th>
                                <th className="num">Porsi</th>
                                <th className="num">Bulan lalu</th>
                                <th className="num">Perubahan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cats.map((c) => (
                                <tr key={c.id || c.name}>
                                    <td>
                                        <span className="rp-dot" style={{ background: c.color || "#1e6e55" }} />
                                        {c.name}
                                        <span className="rp-bar">
                                            <i style={{ width: `${Math.min(100, c.share || 0)}%`, background: c.color || "#1e6e55" }} />
                                        </span>
                                    </td>
                                    <td className="num">{formatRupiah(c.total)}</td>
                                    <td className="num">{pct(c.share)}</td>
                                    <td className="num">{formatRupiah(c.prevTotal || 0)}</td>
                                    <td className={`num ${c.change > 0 ? "is-bad" : c.change < 0 ? "is-good" : ""}`}>
                                        {c.prevTotal ? `${c.change > 0 ? "+" : c.change < 0 ? "−" : ""}${formatRupiah(Math.abs(c.change || 0))}` : "Baru"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="rp-empty">Belum ada pengeluaran di bulan ini.</p>
                )}
            </section>

            <div className="rp-two">
                <section className="rp-section">
                    <h2>Budget</h2>
                    {budgets.length ? (
                        <table className="rp-table">
                            <thead>
                                <tr>
                                    <th>Kategori</th>
                                    <th className="num">Terpakai</th>
                                    <th className="num">Batas</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {budgets.map((b) => {
                                    const limit = b.effectiveLimit ?? b.limit;
                                    const p = limit ? Math.round((b.spent / limit) * 100) : 0;
                                    const status = b.status || (p > 100 ? "over" : p >= 80 ? "warn" : "safe");
                                    return (
                                        <tr key={b._id}>
                                            <td>{b.category?.name || "Kategori"}</td>
                                            <td className="num">{formatRupiah(b.spent || 0)}</td>
                                            <td className="num">{formatRupiah(limit || 0)}</td>
                                            <td>
                                                <span className={`rp-pill is-${status}`}>
                                                    {BUDGET_STATUS[status] || status} · {p}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="rp-empty">Belum ada budget untuk bulan ini.</p>
                    )}
                </section>

                <section className="rp-section">
                    <h2>Goals</h2>
                    {goals.length ? (
                        <table className="rp-table">
                            <thead>
                                <tr>
                                    <th>Goal</th>
                                    <th className="num">Terkumpul</th>
                                    <th className="num">Target</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {goals.map((g) => {
                                    const p = g.percentage ?? (g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0);
                                    return (
                                        <tr key={g._id}>
                                            <td>{g.name}</td>
                                            <td className="num">{formatRupiah(g.currentAmount || 0)}</td>
                                            <td className="num">{formatRupiah(g.targetAmount || 0)}</td>
                                            <td>
                                                <span className={`rp-pill is-${g.status === "completed" ? "safe" : g.health === "behind" || g.health === "overdue" ? "warn" : "neutral"}`}>
                                                    {GOAL_HEALTH[g.health] || (g.status === "completed" ? "Tercapai" : "Berjalan")} · {p}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="rp-empty">Belum ada goal tabungan.</p>
                    )}
                </section>
            </div>

            <section className="rp-section">
                <h2>10 pengeluaran terbesar</h2>
                {top.length ? (
                    <table className="rp-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Keterangan</th>
                                <th>Kategori</th>
                                <th>Wallet</th>
                                <th className="num">Nominal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {top.map((t) => (
                                <tr key={t._id}>
                                    <td>{fmtDay(t.date)}</td>
                                    <td>{t.description || "—"}</td>
                                    <td>{t.isTransfer ? "Transfer" : t.category?.name || "Lainnya"}</td>
                                    <td>{t.wallet?.name || "—"}</td>
                                    <td className="num">{formatRupiah(t.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="rp-empty">Tidak ada pengeluaran.</p>
                )}
            </section>

            <footer className="rp-foot">Dibuat dengan DailyTrack · Setiap rupiah punya cerita.</footer>
        </article>
    );
}
