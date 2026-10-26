import { useEffect, useMemo, useState } from "react";
import {
    FiArrowDownLeft,
    FiArrowUpRight,
    FiCalendar,
    FiCheck,
    FiClock,
    FiEdit2,
    FiFlag,
    FiPause,
    FiPlay,
    FiPlus,
    FiTarget,
    FiTrash2,
    FiTrendingUp,
    FiX,
} from "react-icons/fi";
import { confirmDialog } from "../utils/confirm";
import { useFinance } from "../context/FinanceContext";
import { getGoalsAPI, createGoalAPI, updateGoalAPI, addSavingAPI, deleteGoalAPI } from "../services/api";
import { formatRupiah, formatNumberInput, parseNumberInput, MONTHS } from "../utils/format";
import PageHeader from "../components/Layout/PageHeader";
import FormScreen from "../components/ui/FormScreen";
import DropdownMenu from "../components/ui/DropdownMenu";
import DatePicker from "../components/ui/DatePicker";
import ColorSwatches from "../components/ui/ColorSwatches";
import Meter from "../components/planning/Meter";
import "../styles/planning.css";

const PRIORITY = {
    high: { label: "Prioritas tinggi", tone: "danger" },
    medium: { label: "Prioritas sedang", tone: "warn" },
    low: { label: "Prioritas rendah", tone: "muted" },
};

const STATUS = {
    completed: { label: "Tercapai", tone: "ok" },
    "on-track": { label: "Sesuai jadwal", tone: "ok" },
    behind: { label: "Tertinggal", tone: "warn" },
    overdue: { label: "Lewat target", tone: "danger" },
    "not-started": { label: "Belum mulai", tone: "muted" },
    steady: { label: "Rutin menabung", tone: "ok" },
    stalled: { label: "Belum ada setoran baru", tone: "warn" },
    paused: { label: "Dijeda", tone: "muted" },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const fmtDate = (d, withYear = true) =>
    d
        ? new Date(d).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              ...(withYear ? { year: "numeric" } : {}),
          })
        : "-";
const fmtMonthYear = (d) => (d ? new Date(d).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "-");
const short = (n) => {
    const v = Math.abs(n);
    if (v >= 1e9) return `${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    if (v >= 1e6) return `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
    if (v >= 1e3) return `${Math.round(n / 1e3)} rb`;
    return String(n);
};

const emptyForm = {
    name: "",
    targetAmount: "",
    deadline: "",
    priority: "medium",
    color: "#1e6e55",
    note: "",
    walletId: "",
};

export default function Goals() {
    const { wallets, refresh } = useFinance();
    const [goals, setGoals] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [editor, setEditor] = useState(null); // null | { mode: "new" } | { mode: "edit", goal }
    const [tab, setTab] = useState("active");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        getGoalsAPI()
            .then((res) => {
                if (!alive) return;
                setGoals(res.data || []);
                setLoaded(true);
            })
            .catch(() => alive && setLoaded(true));
        return () => {
            alive = false;
        };
    }, [reload]);
    const reloadAll = async () => {
        setReload((n) => n + 1);
        await refresh();
    };

    const groups = useMemo(
        () => ({
            active: goals.filter((g) => g.status === "active"),
            paused: goals.filter((g) => g.status === "paused"),
            completed: goals.filter((g) => g.status === "completed"),
        }),
        [goals],
    );

    const overview = useMemo(() => {
        const live = groups.active;
        const saved = live.reduce((a, g) => a + (g.currentAmount || 0), 0);
        const target = live.reduce((a, g) => a + (g.targetAmount || 0), 0);
        const needed = live.reduce((a, g) => a + (g.neededPerMonth || 0), 0);
        const pace = live.reduce((a, g) => a + (g.pacePerMonth || 0), 0);
        const onTrack = live.filter((g) => ["on-track", "steady"].includes(g.health)).length;
        const behind = live.filter((g) => ["behind", "overdue", "stalled"].includes(g.health)).length;
        return { saved, target, needed, pace, onTrack, behind };
    }, [groups]);

    if (editor) {
        return (
            <GoalEditor
                initial={editor.goal}
                wallets={wallets}
                onClose={() => setEditor(null)}
                onSaved={async () => {
                    setEditor(null);
                    await reloadAll();
                }}
            />
        );
    }

    const tabs = [
        { id: "active", label: "Berjalan", count: groups.active.length },
        { id: "paused", label: "Dijeda", count: groups.paused.length },
        { id: "completed", label: "Tercapai", count: groups.completed.length },
    ].filter((t) => t.id === "active" || t.count > 0);
    const list = groups[tab] || [];
    const overallPct = overview.target > 0 ? Math.round((overview.saved / overview.target) * 100) : 0;

    return (
        <div className="pl-page">
            <PageHeader
                title="Goals & Tabungan"
                subtitle={`${groups.active.length} berjalan · ${groups.completed.length} tercapai`}
                action={
                    <button type="button" className="btn-primary" onClick={() => setEditor({ mode: "new" })}>
                        <FiPlus aria-hidden /> Goal baru
                    </button>
                }
            />

            {!loaded ? (
                <div className="pl-skeleton-stack">
                    <div className="pl-skel" style={{ height: 130 }} />
                    <div className="pl-skel" style={{ height: 320 }} />
                </div>
            ) : goals.length === 0 ? (
                <div className="pl-empty">
                    <span className="pl-empty-icon">
                        <FiTarget aria-hidden />
                    </span>
                    <strong>Belum ada goal tabungan</strong>
                    <p>Tentukan target dan tanggalnya — DailyTrack menghitung berapa yang perlu disisihkan tiap minggu.</p>
                    <div className="pl-empty-actions">
                        <button type="button" className="btn-primary" onClick={() => setEditor({ mode: "new" })}>
                            <FiPlus aria-hidden /> Buat goal pertama
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {groups.active.length > 0 && (
                        <section className="pl-overview is-goals">
                            <div className="pl-overview-main">
                                <span className="pl-eyebrow">Terkumpul di goal berjalan</span>
                                <div className="pl-overview-amount">
                                    <strong>{formatRupiah(overview.saved)}</strong>
                                    <span>dari {formatRupiah(overview.target)}</span>
                                </div>
                                <Meter value={overallPct} height={12} label="Progres semua goal" />
                                <div className="pl-legend">
                                    <span>{overallPct}% dari total target</span>
                                </div>
                            </div>
                            <div className="pl-overview-stats">
                                <Stat
                                    label="Perlu disisihkan / bulan"
                                    value={formatRupiah(overview.needed)}
                                    hint="agar semua goal tepat waktu"
                                />
                                <Stat
                                    label="Laju menabungmu / bulan"
                                    value={formatRupiah(overview.pace)}
                                    tone={overview.pace >= overview.needed ? "ok" : "warn"}
                                    hint="rata-rata 90 hari terakhir"
                                />
                                <div className="pl-counts">
                                    {overview.onTrack > 0 && (
                                        <span className="pl-pill tone-ok">{overview.onTrack} sesuai jadwal</span>
                                    )}
                                    {overview.behind > 0 && (
                                        <span className="pl-pill tone-warn">{overview.behind} perlu perhatian</span>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {tabs.length > 1 && (
                        <div className="tx-chips pl-tabs" role="tablist">
                            {tabs.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.id}
                                    className={`tx-chip ${tab === t.id ? "is-active" : ""}`}
                                    onClick={() => setTab(t.id)}
                                >
                                    {t.label} <span className="pl-tab-count">{t.count}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {list.length === 0 ? (
                        <div className="pl-empty is-compact">
                            <strong>Tidak ada goal di sini</strong>
                        </div>
                    ) : (
                        <div className="pl-goal-grid">
                            {list.map((g) => (
                                <GoalCard
                                    key={g._id}
                                    goal={g}
                                    wallets={wallets}
                                    onEdit={() => setEditor({ mode: "edit", goal: g })}
                                    onChanged={reloadAll}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Stat({ label, value, hint, tone }) {
    return (
        <div className={`pl-stat ${tone ? `tone-${tone}` : ""}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            {hint && <small>{hint}</small>}
        </div>
    );
}

function Ring({ pct, color }) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, pct));
    return (
        <div className="pl-ring" style={{ "--ring": color }}>
            <svg viewBox="0 0 80 80" aria-hidden>
                <circle cx="40" cy="40" r={r} className="pl-ring-track" />
                <circle
                    cx="40"
                    cy="40"
                    r={r}
                    className="pl-ring-fill"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - p / 100)}
                />
            </svg>
            <span>
                {pct}
                <small>%</small>
            </span>
        </div>
    );
}

function GoalCard({ goal: g, wallets, onEdit, onChanged }) {
    const [panel, setPanel] = useState(null); // null | "deposit" | "withdraw" | "delete" | "history"
    const S = STATUS[g.status === "paused" ? "paused" : g.health] || STATUS["not-started"];
    const P = PRIORITY[g.priority] || PRIORITY.medium;
    const color = g.color || "#1e6e55";
    const done = g.status === "completed" || g.health === "completed";
    const maxMonthly = Math.max(1, ...(g.monthly || []).map((m) => Math.abs(m.net)));

    const togglePause = async () => {
        const pausing = g.status !== "paused";
        const ok = await confirmDialog({
            title: pausing ? `Jeda goal ${g.name}?` : `Lanjutkan goal ${g.name}?`,
            message: pausing
                ? "Goal tidak dihitung di ringkasan sampai dilanjutkan. Dana yang terkumpul tetap aman."
                : "Goal kembali dihitung di ringkasan dan proyeksi.",
            confirmLabel: pausing ? "Jeda" : "Lanjutkan",
            danger: false,
        });
        if (!ok) return;
        await updateGoalAPI(g._id, { status: pausing ? "paused" : "active" });
        await onChanged();
    };

    return (
        <article className={`pl-goal ${done ? "is-done" : ""}`} style={{ "--goal": color }}>
            <header className="pl-goal-head">
                <Ring pct={g.percentage} color={color} />
                <div className="pl-goal-title">
                    <strong>{g.name}</strong>
                    <span className="pl-budget-tags">
                        <span className={`pl-pill tone-${S.tone}`}>{S.label}</span>
                        {!done && <span className={`pl-pill tone-${P.tone} is-soft`}>{P.label}</span>}
                    </span>
                    <span className="pl-goal-money">
                        <b>{formatRupiah(g.currentAmount)}</b> dari {formatRupiah(g.targetAmount)}
                    </span>
                </div>
                <div className="pl-icon-actions">
                    <button type="button" onClick={onEdit} aria-label="Ubah goal">
                        <FiEdit2 />
                    </button>
                    {!done && (
                        <button
                            type="button"
                            onClick={togglePause}
                            aria-label={g.status === "paused" ? "Lanjutkan goal" : "Jeda goal"}
                        >
                            {g.status === "paused" ? <FiPlay /> : <FiPause />}
                        </button>
                    )}
                    <button
                        type="button"
                        className="is-danger"
                        onClick={() => setPanel(panel === "delete" ? null : "delete")}
                        aria-label="Hapus goal"
                    >
                        <FiTrash2 />
                    </button>
                </div>
            </header>

            {/* Milestone */}
            <div className="pl-milestones">
                <Meter
                    value={g.percentage}
                    color={color}
                    tone="cat"
                    ticks={[25, 50, 75].map((at) => ({ at, done: g.percentage >= at, label: `${at}%` }))}
                    label={`Progres ${g.name}`}
                />
                <ol>
                    {(g.milestones || []).map((m) => (
                        <li key={m.pct} className={m.reached ? "is-reached" : ""}>
                            <span className="pl-ms-dot">{m.reached ? <FiCheck aria-hidden /> : m.pct === 100 ? <FiFlag aria-hidden /> : null}</span>
                            <b>{m.pct}%</b>
                            <small>{m.reached ? (m.reachedAt ? fmtDate(m.reachedAt, false) : "tercapai") : short(m.amount)}</small>
                        </li>
                    ))}
                </ol>
            </div>

            {/* Rencana & proyeksi */}
            {!done && <GoalPlan g={g} />}
            {done && (
                <div className="pl-plan is-done">
                    <FiCheck aria-hidden />
                    <span>
                        Tercapai{g.completedAt ? ` pada ${fmtDate(g.completedAt)}` : ""}. {g.depositCount} kali setor.
                    </span>
                </div>
            )}

            {/* Setoran 6 bulan */}
            <div className="pl-spark" aria-label="Setoran bersih 6 bulan terakhir">
                {(g.monthly || []).map((m) => (
                    <div key={`${m.year}-${m.month}`} className="pl-spark-col" title={`${MONTHS[m.month - 1]}: ${formatRupiah(m.net)}`}>
                        <span
                            className={`pl-spark-bar ${m.net < 0 ? "is-neg" : ""}`}
                            style={{ height: `${Math.max(m.net ? 8 : 2, (Math.abs(m.net) / maxMonthly) * 100)}%` }}
                        />
                        <small>{MONTHS[m.month - 1].slice(0, 3)}</small>
                    </div>
                ))}
            </div>

            {/* Panel aksi */}
            {panel === "deposit" || panel === "withdraw" ? (
                <MoneyPanel g={g} wallets={wallets} mode={panel} onClose={() => setPanel(null)} onDone={onChanged} />
            ) : panel === "delete" ? (
                <DeletePanel g={g} wallets={wallets} onClose={() => setPanel(null)} onDone={onChanged} />
            ) : panel === "history" ? (
                <History g={g} onClose={() => setPanel(null)} />
            ) : (
                <div className="pl-goal-actions">
                    {!done && g.status !== "paused" && (
                        <button type="button" className="btn-primary pl-goal-cta" onClick={() => setPanel("deposit")}>
                            <FiArrowDownLeft aria-hidden /> Setor
                        </button>
                    )}
                    {g.currentAmount > 0 && (
                        <button type="button" className="btn-ghost" onClick={() => setPanel("withdraw")}>
                            <FiArrowUpRight aria-hidden /> Tarik
                        </button>
                    )}
                    {g.recent?.length > 0 && (
                        <button type="button" className="pl-link" onClick={() => setPanel("history")}>
                            <FiClock aria-hidden /> Riwayat
                        </button>
                    )}
                </div>
            )}
        </article>
    );
}

function GoalPlan({ g }) {
    const hasDeadline = Boolean(g.deadline);
    const paceOk = g.projectedDate && (!hasDeadline || new Date(g.projectedDate) <= new Date(g.deadline));
    return (
        <div className={`pl-plan tone-${(STATUS[g.health] || {}).tone || "muted"}`}>
            <div className="pl-plan-row">
                <FiCalendar aria-hidden />
                {hasDeadline ? (
                    <span>
                        Target <b>{fmtDate(g.deadline)}</b>
                        {g.daysLeft >= 0 ? ` · ${g.daysLeft} hari lagi` : ` · lewat ${Math.abs(g.daysLeft)} hari`}
                    </span>
                ) : (
                    <span>Tanpa tanggal target</span>
                )}
            </div>
            {hasDeadline && g.remaining > 0 && (
                <div className="pl-plan-need">
                    <div>
                        <small>Per minggu</small>
                        <b>{formatRupiah(g.neededPerWeek)}</b>
                    </div>
                    <div>
                        <small>Per bulan</small>
                        <b>{formatRupiah(g.neededPerMonth)}</b>
                    </div>
                </div>
            )}
            <div className="pl-plan-row">
                <FiTrendingUp aria-hidden />
                {g.pacePerMonth > 0 ? (
                    <span>
                        Lajumu {formatRupiah(g.pacePerMonth)}/bln →{" "}
                        <b className={paceOk ? "is-ok" : "is-warn"}>tercapai ±{fmtMonthYear(g.projectedDate)}</b>
                    </span>
                ) : (
                    <span>Belum ada setoran dalam 90 hari terakhir.</span>
                )}
            </div>
            {g.health === "behind" && g.gap > 0 && (
                <div className="pl-plan-row is-warn">
                    <FiClock aria-hidden />
                    <span>
                        Tertinggal <b>{formatRupiah(g.gap)}</b> dari jadwal menabung rata.
                    </span>
                </div>
            )}
        </div>
    );
}

function MoneyPanel({ g, wallets, mode, onClose, onDone }) {
    const deposit = mode === "deposit";
    const [amount, setAmount] = useState("");
    const [walletId, setWalletId] = useState(g.wallet?._id || g.wallet || wallets[0]?._id || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const wallet = wallets.find((w) => w._id === walletId);
    const parsed = parseNumberInput(amount);

    const quick = deposit
        ? [
              g.neededPerWeek > 0 && { label: "Target minggu ini", value: g.neededPerWeek },
              g.neededPerMonth > 0 && { label: "Target bulan ini", value: g.neededPerMonth },
              g.remaining > 0 && { label: "Lunasi", value: g.remaining },
          ].filter(Boolean)
        : [
              { label: "Setengah", value: Math.floor(g.currentAmount / 2) },
              { label: "Semua", value: g.currentAmount },
          ].filter((q) => q.value > 0);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!parsed) return setError("Isi jumlahnya dulu.");
        if (!walletId) return setError(deposit ? "Pilih wallet sumber." : "Pilih wallet tujuan.");
        if (deposit && wallet && parsed > (wallet.balance || 0))
            return setError(`Saldo ${wallet.name} tidak cukup (${formatRupiah(wallet.balance || 0)}).`);
        if (!deposit && parsed > g.currentAmount) return setError("Melebihi dana yang terkumpul.");

        const after = deposit ? g.currentAmount + parsed : g.currentAmount - parsed;
        const pctAfter = g.targetAmount ? Math.round((after / g.targetAmount) * 100) : 0;
        const ok = await confirmDialog({
            title: deposit ? `Setor ${formatRupiah(parsed)} ke ${g.name}?` : `Tarik ${formatRupiah(parsed)} dari ${g.name}?`,
            message: deposit
                ? `Dipotong dari ${wallet?.name}. Progres naik ke ${pctAfter}%.`
                : `Masuk ke ${wallet?.name}. Progres turun ke ${pctAfter}%.`,
            confirmLabel: deposit ? "Setor" : "Tarik dana",
            danger: !deposit,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await addSavingAPI(g._id, { amount: parsed, walletId, action: mode });
            onClose();
            await onDone();
        } catch (err) {
            setError(err.response?.data?.message || "Gagal menyimpan.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="pl-panel" onSubmit={submit}>
            <header>
                <strong>{deposit ? "Setor ke goal" : "Tarik dari goal"}</strong>
                <button type="button" className="pop-icon-btn" onClick={onClose} aria-label="Tutup">
                    <FiX />
                </button>
            </header>
            <div className="pl-money">
                <em>Rp</em>
                <input
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(formatNumberInput(e.target.value))}
                    placeholder="0"
                    inputMode="numeric"
                    aria-label="Jumlah"
                />
            </div>
            {quick.length > 0 && (
                <div className="pl-quick">
                    {quick.map((q) => (
                        <button key={q.label} type="button" onClick={() => setAmount(formatNumberInput(String(q.value)))}>
                            {q.label} · {short(q.value)}
                        </button>
                    ))}
                </div>
            )}
            <label className="pl-field">
                <span>{deposit ? "Dari wallet" : "Ke wallet"}</span>
                <DropdownMenu
                    value={walletId}
                    options={wallets.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` }))}
                    onChange={setWalletId}
                />
            </label>
            {error && <div className="pl-error">{error}</div>}
            <div className="pl-form-actions">
                <button type="button" className="btn-ghost" onClick={onClose}>
                    Batal
                </button>
                <button type="submit" className={`btn-primary ${deposit ? "" : "is-danger"}`} disabled={busy}>
                    {busy ? "Menyimpan..." : deposit ? "Setor" : "Tarik"}
                </button>
            </div>
        </form>
    );
}

function DeletePanel({ g, wallets, onClose, onDone }) {
    const [walletId, setWalletId] = useState(g.wallet?._id || g.wallet || wallets[0]?._id || "");
    const [error, setError] = useState("");
    const hasFunds = g.currentAmount > 0;
    const target = wallets.find((w) => w._id === walletId);

    const run = async () => {
        if (hasFunds && !walletId) return setError("Pilih wallet untuk menerima dana.");
        const ok = await confirmDialog({
            title: `Hapus goal ${g.name}?`,
            message: hasFunds
                ? `${formatRupiah(g.currentAmount)} dikembalikan ke ${target?.name}. Riwayat setoran tetap tercatat di transaksi.`
                : "Goal ini belum punya tabungan.",
            confirmLabel: "Hapus goal",
        });
        if (!ok) return;
        try {
            await deleteGoalAPI(g._id, hasFunds ? { walletId } : undefined);
            await onDone();
        } catch (err) {
            setError(err.response?.data?.message || "Gagal menghapus goal.");
        }
    };

    return (
        <div className="pl-panel is-danger">
            <header>
                <strong>Hapus goal</strong>
                <button type="button" className="pop-icon-btn" onClick={onClose} aria-label="Tutup">
                    <FiX />
                </button>
            </header>
            {hasFunds ? (
                <label className="pl-field">
                    <span>Kembalikan {formatRupiah(g.currentAmount)} ke</span>
                    <DropdownMenu
                        value={walletId}
                        options={wallets.map((w) => ({ value: w._id, label: w.name }))}
                        onChange={setWalletId}
                    />
                </label>
            ) : (
                <p className="pl-muted">Belum ada dana di goal ini.</p>
            )}
            {error && <div className="pl-error">{error}</div>}
            <div className="pl-form-actions">
                <button type="button" className="btn-ghost" onClick={onClose}>
                    Batal
                </button>
                <button type="button" className="btn-primary is-danger" onClick={run}>
                    Hapus goal
                </button>
            </div>
        </div>
    );
}

function History({ g, onClose }) {
    return (
        <div className="pl-panel">
            <header>
                <strong>Riwayat terakhir</strong>
                <button type="button" className="pop-icon-btn" onClick={onClose} aria-label="Tutup">
                    <FiX />
                </button>
            </header>
            <ul className="pl-history">
                {g.recent.map((e) => (
                    <li key={e._id}>
                        <span className={`pl-hist-icon ${e.kind === "deposit" ? "is-in" : "is-out"}`}>
                            {e.kind === "deposit" ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                        </span>
                        <span>{e.kind === "deposit" ? "Setor" : "Tarik"}</span>
                        <small>{fmtDate(e.date)}</small>
                        <b className={e.kind === "deposit" ? "is-ok" : ""}>
                            {e.kind === "deposit" ? "+" : "−"}
                            {formatRupiah(e.amount)}
                        </b>
                    </li>
                ))}
            </ul>
            {g.lastDepositAt && (
                <p className="pl-muted">
                    {g.depositCount} kali setor · terakhir {fmtDate(g.lastDepositAt)}
                </p>
            )}
        </div>
    );
}

function GoalEditor({ initial, wallets, onClose, onSaved }) {
    const isEdit = Boolean(initial);
    const [form, setForm] = useState(() =>
        initial
            ? {
                  name: initial.name,
                  targetAmount: formatNumberInput(String(initial.targetAmount)),
                  deadline: initial.deadline ? new Date(initial.deadline).toISOString().slice(0, 10) : "",
                  priority: initial.priority || "medium",
                  color: initial.color || "#1e6e55",
                  note: initial.note || "",
                  walletId: initial.wallet?._id || initial.wallet || "",
              }
            : { ...emptyForm, walletId: wallets.find((w) => w.isDefault)?._id || "" },
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const target = parseNumberInput(form.targetAmount);
    const saved = initial?.currentAmount || 0;
    const remaining = Math.max(0, target - saved);
    const days = form.deadline ? Math.ceil((new Date(`${form.deadline}T23:59:59`) - new Date()) / DAY_MS) : null;
    const perWeek = days > 0 ? Math.ceil(remaining / Math.max(1, days / 7)) : 0;
    const perMonth = days > 0 ? Math.ceil(remaining / Math.max(1, days / 30.44)) : 0;

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.name.trim()) return setError("Beri nama goal.");
        if (!target) return setError("Isi target tabungan.");
        if (isEdit) {
            const ok = await confirmDialog({
                title: "Simpan perubahan goal?",
                message:
                    target !== initial.targetAmount
                        ? `Target ${formatRupiah(initial.targetAmount)} → ${formatRupiah(target)}.`
                        : "Rencana setoran akan dihitung ulang.",
                confirmLabel: "Simpan",
                danger: false,
            });
            if (!ok) return;
        }
        setBusy(true);
        try {
            const payload = { ...form, name: form.name.trim(), targetAmount: target, deadline: form.deadline || null };
            if (isEdit) await updateGoalAPI(initial._id, payload);
            else await createGoalAPI(payload);
            await onSaved();
        } catch (err) {
            setError(err.response?.data?.message || "Gagal menyimpan goal.");
            setBusy(false);
        }
    };

    const preview = (
        <div className="pl-preview" style={{ "--goal": form.color }}>
            <span className="pl-eyebrow">Rencana menabung</span>
            <strong className="pl-preview-name">{form.name || "Goal baru"}</strong>
            <div className="pl-preview-amount">{formatRupiah(target)}</div>
            {saved > 0 && <small className="pl-muted">Sudah terkumpul {formatRupiah(saved)}</small>}
            <div className="pl-preview-rows">
                {days > 0 && remaining > 0 ? (
                    <>
                        <div>
                            <small>Per minggu</small>
                            <b>{formatRupiah(perWeek)}</b>
                        </div>
                        <div>
                            <small>Per bulan</small>
                            <b>{formatRupiah(perMonth)}</b>
                        </div>
                        <div>
                            <small>Waktu</small>
                            <b>{days} hari</b>
                        </div>
                    </>
                ) : (
                    <p className="pl-muted">Pilih tanggal target untuk melihat berapa yang perlu disisihkan.</p>
                )}
            </div>
            <ol className="pl-preview-ms">
                {[25, 50, 75, 100].map((m) => (
                    <li key={m}>
                        <b>{m}%</b> {formatRupiah(Math.round((target * m) / 100))}
                    </li>
                ))}
            </ol>
        </div>
    );

    return (
        <FormScreen
            backLabel="Goals"
            title={isEdit ? "Ubah goal" : "Goal baru"}
            subtitle="Tentukan target, tanggal, dan wallet tempat uangnya disimpan."
            onClose={onClose}
            aside={preview}
            width={980}
        >
            <form onSubmit={submit} className="pl-form-grid">
                <label className="pl-field pl-span">
                    <span>Nama goal</span>
                    <input
                        className="pl-input"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Laptop baru, Liburan Bali..."
                        autoFocus={!isEdit}
                    />
                </label>
                <label className="pl-field">
                    <span>Target</span>
                    <div className="pl-money">
                        <em>Rp</em>
                        <input
                            value={form.targetAmount}
                            onChange={(e) => set("targetAmount", formatNumberInput(e.target.value))}
                            placeholder="8.000.000"
                            inputMode="numeric"
                        />
                    </div>
                </label>
                <label className="pl-field">
                    <span>Tanggal target</span>
                    <DatePicker
                        value={form.deadline}
                        onChange={(v) => set("deadline", v)}
                        placeholder="Tanpa tanggal"
                        min={new Date().toISOString().slice(0, 10)}
                    />
                </label>
                <label className="pl-field">
                    <span>Wallet penyimpanan</span>
                    <DropdownMenu
                        value={form.walletId}
                        options={[{ value: "", label: "Belum ditentukan" }, ...wallets.map((w) => ({ value: w._id, label: w.name }))]}
                        onChange={(v) => set("walletId", v)}
                    />
                </label>
                <label className="pl-field">
                    <span>Prioritas</span>
                    <DropdownMenu
                        value={form.priority}
                        options={[
                            { value: "high", label: "Tinggi" },
                            { value: "medium", label: "Sedang" },
                            { value: "low", label: "Rendah" },
                        ]}
                        onChange={(v) => set("priority", v)}
                    />
                </label>
                <div className="pl-field pl-span">
                    <span>Warna</span>
                    <ColorSwatches value={form.color} onChange={(c) => set("color", c)} />
                </div>
                <label className="pl-field pl-span">
                    <span>Catatan</span>
                    <input
                        className="pl-input"
                        value={form.note}
                        onChange={(e) => set("note", e.target.value)}
                        placeholder="Untuk apa goal ini? (opsional)"
                    />
                </label>
                {error && <div className="pl-error pl-span">{error}</div>}
                <div className="pl-form-actions pl-span">
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Batal
                    </button>
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {busy ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Buat goal"}
                    </button>
                </div>
            </form>
        </FormScreen>
    );
}
