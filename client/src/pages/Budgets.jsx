import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FiAlertTriangle,
    FiAlertOctagon,
    FiCheckCircle,
    FiCopy,
    FiEdit2,
    FiPlus,
    FiRepeat,
    FiTag,
    FiTrash2,
    FiTrendingUp,
    FiX,
    FiZap,
} from "react-icons/fi";
import { confirmDialog } from "../utils/confirm";
import DropdownMenu from "../components/ui/DropdownMenu";
import Switch from "../components/ui/Switch";
import PageHeader from "../components/Layout/PageHeader";
import Meter from "../components/planning/Meter";
import { getBudgetsAPI, createBudgetAPI, updateBudgetAPI, deleteBudgetAPI } from "../services/api";
import { getBudgetSuggestionsAPI, copyPreviousBudgetsAPI } from "../services/planningApi";
import { useFinance } from "../context/FinanceContext";
import { CATEGORY_ICONS } from "../utils/categoryIcons";
import { formatNumberInput, formatRupiah, MONTHS, parseNumberInput } from "../utils/format";
import "../styles/planning.css";

const STATUS = {
    over: { label: "Jebol", icon: FiAlertOctagon, tone: "danger" },
    danger: { label: "Berisiko jebol", icon: FiTrendingUp, tone: "warn" },
    warn: { label: "Waspada", icon: FiAlertTriangle, tone: "warn" },
    safe: { label: "Aman", icon: FiCheckCircle, tone: "ok" },
};

const emptyForm = { categoryId: "", limit: "", alertThreshold: 80, rollover: false, note: "" };

export default function Budgets() {
    const { categories, month, year, setMonth, setYear, availableYears } = useFinance();
    const [budgets, setBudgets] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loadedKey, setLoadedKey] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [notice, setNotice] = useState("");
    const key = `${year}-${month}`;
    const loading = loadedKey !== key;

    const load = useCallback(async () => {
        const [bRes, sRes] = await Promise.all([
            getBudgetsAPI({ month, year }),
            getBudgetSuggestionsAPI({ month, year }).catch(() => ({ data: { suggestions: [] } })),
        ]);
        setBudgets(bRes.data || []);
        setSuggestions(sRes.data?.suggestions || []);
        setLoadedKey(`${year}-${month}`);
    }, [month, year]);

    useEffect(() => {
        let alive = true;
        Promise.all([
            getBudgetsAPI({ month, year }),
            getBudgetSuggestionsAPI({ month, year }).catch(() => ({ data: { suggestions: [] } })),
        ])
            .then(([bRes, sRes]) => {
                if (!alive) return;
                setBudgets(bRes.data || []);
                setSuggestions(sRes.data?.suggestions || []);
                setLoadedKey(`${year}-${month}`);
            })
            .catch(() => alive && setLoadedKey(`${year}-${month}`));
        return () => {
            alive = false;
        };
    }, [month, year]);

    const expenseCategories = categories.filter((c) => c.type === "expense" || c.type === "both");
    const budgeted = new Set(budgets.map((b) => String(b.category?._id)));
    const freeCategories = expenseCategories.filter((c) => !budgeted.has(String(c._id)));
    const suggestionFor = (catId) => suggestions.find((s) => String(s.category._id) === String(catId));
    const openSuggestions = suggestions.filter((s) => !s.hasBudget && !budgeted.has(String(s.category._id)));

    // ── Ringkasan bulan ──────────────────────────────────
    const summary = useMemo(() => {
        const limit = budgets.reduce((a, b) => a + b.effectiveLimit, 0);
        const spent = budgets.reduce((a, b) => a + b.spent, 0);
        const projected = budgets.reduce((a, b) => a + Math.max(b.projected, b.spent), 0);
        const clock = budgets[0]?.clock;
        const remaining = limit - spent;
        const perDay = clock?.daysLeft > 0 ? Math.max(0, remaining) / clock.daysLeft : 0;
        const counts = { over: 0, danger: 0, warn: 0, safe: 0 };
        budgets.forEach((b) => (counts[b.status] += 1));
        return { limit, spent, projected, remaining, perDay, clock, counts };
    }, [budgets]);

    const alerts = budgets
        .filter((b) => b.status !== "safe")
        .sort((a, b) => ["over", "danger", "warn"].indexOf(a.status) - ["over", "danger", "warn"].indexOf(b.status));

    // ── Aksi ─────────────────────────────────────────────
    const createBudget = async (payload) => {
        await createBudgetAPI({ ...payload, month, year });
        await load();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.categoryId) return setFormError("Pilih kategori terlebih dahulu.");
        const limit = parseNumberInput(form.limit);
        if (!limit) return setFormError("Isi batas budget.");
        setFormError("");
        setSaving(true);
        try {
            await createBudget({ ...form, limit });
            setForm(emptyForm);
            setShowForm(false);
            setNotice("Budget ditambahkan.");
        } catch (err) {
            setFormError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Gagal menyimpan budget.");
        } finally {
            setSaving(false);
        }
    };

    const applySuggestion = async (s) => {
        const ok = await confirmDialog({
            title: `Buat budget ${s.category.name}?`,
            message: `Batas ${formatRupiah(s.suggested)} per bulan — sedikit di bawah rata-rata 3 bulan terakhir (${formatRupiah(s.average)}).`,
            confirmLabel: "Buat budget",
            danger: false,
        });
        if (!ok) return;
        try {
            await createBudget({ categoryId: s.category._id, limit: s.suggested, alertThreshold: 80 });
            setNotice(`Budget ${s.category.name} dibuat.`);
        } catch (err) {
            setNotice(err.response?.data?.message || "Gagal membuat budget.");
        }
    };

    const copyPrevious = async () => {
        const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
        const ok = await confirmDialog({
            title: `Salin budget ${MONTHS[prev.m - 1]}?`,
            message: "Kategori yang sudah punya budget bulan ini tidak akan ditimpa.",
            confirmLabel: "Salin",
            danger: false,
        });
        if (!ok) return;
        try {
            const res = await copyPreviousBudgetsAPI({ month, year });
            await load();
            setNotice(
                res.data.created
                    ? `${res.data.created} budget disalin dari ${MONTHS[prev.m - 1]}.`
                    : "Semua kategori sudah punya budget bulan ini.",
            );
        } catch (err) {
            setNotice(err.response?.data?.message || "Gagal menyalin budget.");
        }
    };

    const handleDelete = async (b) => {
        const ok = await confirmDialog({
            title: `Hapus budget ${b.category?.name || ""}?`,
            message: "Transaksi di kategori ini tidak ikut terhapus.",
            confirmLabel: "Hapus",
        });
        if (!ok) return;
        await deleteBudgetAPI(b._id);
        await load();
    };

    const handleUpdate = async (b, patch) => {
        const changes = [];
        if (patch.limit !== b.limit) changes.push(`batas ${formatRupiah(b.limit)} → ${formatRupiah(patch.limit)}`);
        if (patch.alertThreshold !== b.alertThreshold) changes.push(`peringatan ${b.alertThreshold}% → ${patch.alertThreshold}%`);
        if (patch.rollover !== Boolean(b.rollover)) changes.push(patch.rollover ? "rollover aktif" : "rollover nonaktif");
        if ((patch.note || "") !== (b.note || "")) changes.push("catatan diubah");
        if (changes.length === 0) return setEditingId(null);
        const ok = await confirmDialog({
            title: `Simpan perubahan ${b.category?.name || "budget"}?`,
            message: changes.join(" · "),
            confirmLabel: "Simpan",
            danger: false,
        });
        if (!ok) return;
        await updateBudgetAPI(b._id, patch);
        setEditingId(null);
        await load();
    };

    const years = Array.from(new Set([...(availableYears || []), year, new Date().getFullYear() + 1])).sort();
    const clock = summary.clock;
    const periodLabel = `${MONTHS[month - 1]} ${year}`;
    const subtitle =
        clock?.phase === "current"
            ? `${periodLabel} · ${clock.daysLeft} hari lagi`
            : clock?.phase === "past"
              ? `${periodLabel} · sudah lewat`
              : periodLabel;
    const pct = summary.limit > 0 ? Math.round((summary.spent / summary.limit) * 100) : 0;
    const pacePct = clock?.phase === "current" ? (clock.daysElapsed / clock.daysInMonth) * 100 : null;

    return (
        <div className="pl-page">
            <PageHeader
                title="Budget"
                subtitle={subtitle}
                action={
                    <div className="pl-head-actions">
                        <DropdownMenu
                            value={month}
                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                            onChange={(v) => setMonth(Number(v))}
                            minWidth="140px"
                        />
                        <DropdownMenu
                            value={year}
                            options={years.map((y) => ({ value: y, label: String(y) }))}
                            onChange={(v) => setYear(Number(v))}
                            minWidth="100px"
                        />
                        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                            <FiPlus aria-hidden /> Budget
                        </button>
                    </div>
                }
            />

            {notice && (
                <div className="pl-notice" role="status">
                    <FiCheckCircle aria-hidden /> {notice}
                    <button type="button" onClick={() => setNotice("")} aria-label="Tutup">
                        <FiX />
                    </button>
                </div>
            )}

            {showForm && (
                <BudgetForm
                    form={form}
                    setForm={setForm}
                    error={formError}
                    saving={saving}
                    categories={freeCategories}
                    suggestionFor={suggestionFor}
                    onSubmit={handleSubmit}
                    onClose={() => {
                        setShowForm(false);
                        setFormError("");
                    }}
                />
            )}

            {loading ? (
                <div className="pl-skeleton-stack">
                    <div className="pl-skel" style={{ height: 150 }} />
                    <div className="pl-skel" style={{ height: 120 }} />
                    <div className="pl-skel" style={{ height: 120 }} />
                </div>
            ) : budgets.length === 0 ? (
                <div className="pl-empty">
                    <span className="pl-empty-icon">
                        <FiTag aria-hidden />
                    </span>
                    <strong>Belum ada budget untuk {periodLabel}</strong>
                    <p>Tetapkan batas per kategori supaya pengeluaran tetap terkendali.</p>
                    <div className="pl-empty-actions">
                        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                            <FiPlus aria-hidden /> Buat budget
                        </button>
                        <button type="button" className="btn-ghost" onClick={copyPrevious}>
                            <FiCopy aria-hidden /> Salin dari bulan lalu
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <section className="pl-overview">
                        <div className="pl-overview-main">
                            <span className="pl-eyebrow">Terpakai bulan ini</span>
                            <div className="pl-overview-amount">
                                <strong>{formatRupiah(summary.spent)}</strong>
                                <span>dari {formatRupiah(summary.limit)}</span>
                            </div>
                            <Meter
                                value={pct}
                                ghost={summary.limit > 0 ? (summary.projected / summary.limit) * 100 : 0}
                                marker={pacePct}
                                markerLabel="Batas wajar sampai hari ini"
                                tone={summary.spent > summary.limit ? "danger" : pct >= 80 ? "warn" : "accent"}
                                height={12}
                                label="Total budget terpakai"
                            />
                            <div
                                className="pl-legend"
                                style={{
                                    "--legend-fill":
                                        summary.spent > summary.limit
                                            ? "var(--pl-danger)"
                                            : pct >= 80
                                              ? "var(--pl-warn)"
                                              : "var(--accent)",
                                }}
                            >
                                <span>
                                    <i className="dot fill" /> Terpakai {pct}%
                                </span>
                                {clock?.phase === "current" && (
                                    <>
                                        <span>
                                            <i className="dot ghost" /> Proyeksi
                                        </span>
                                        <span>
                                            <i className="dot marker" /> Hari ke-{clock.daysElapsed}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="pl-overview-stats">
                            <Stat
                                label={summary.remaining >= 0 ? "Sisa budget" : "Lewat batas"}
                                value={formatRupiah(Math.abs(summary.remaining))}
                                tone={summary.remaining < 0 ? "danger" : undefined}
                            />
                            {clock?.phase !== "past" && (
                                <Stat
                                    label="Aman dipakai per hari"
                                    value={formatRupiah(Math.round(summary.perDay))}
                                    hint={`untuk ${clock?.daysLeft} hari ke depan`}
                                />
                            )}
                            <Stat
                                label={clock?.phase === "current" ? "Proyeksi akhir bulan" : "Total akhir bulan"}
                                value={formatRupiah(summary.projected)}
                                tone={summary.projected > summary.limit ? "danger" : "ok"}
                                hint={
                                    clock?.phase === "current"
                                        ? summary.projected > summary.limit
                                            ? `±${formatRupiah(summary.projected - summary.limit)} di atas batas`
                                            : "masih di bawah batas"
                                        : undefined
                                }
                            />
                            <div className="pl-counts">
                                {["safe", "warn", "danger", "over"].map((s) =>
                                    summary.counts[s] ? (
                                        <span key={s} className={`pl-pill tone-${STATUS[s].tone}`}>
                                            {summary.counts[s]} {STATUS[s].label.toLowerCase()}
                                        </span>
                                    ) : null,
                                )}
                            </div>
                        </div>
                    </section>

                    {alerts.length > 0 && (
                        <section className="pl-alerts" aria-label="Peringatan budget">
                            {alerts.map((b) => {
                                const S = STATUS[b.status];
                                return (
                                    <div key={b._id} className={`pl-alert tone-${S.tone}`}>
                                        <S.icon aria-hidden />
                                        <span>
                                            <strong>{b.category?.name}</strong> — {alertText(b)}
                                        </span>
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    <div className="pl-section-head">
                        <h2>Per kategori</h2>
                        <button type="button" className="pl-link" onClick={copyPrevious}>
                            <FiCopy aria-hidden /> Salin dari bulan lalu
                        </button>
                    </div>
                    <div className="pl-list">
                        {budgets.map((b) =>
                            editingId === b._id ? (
                                <BudgetEditor
                                    key={b._id}
                                    budget={b}
                                    onCancel={() => setEditingId(null)}
                                    onSave={(patch) => handleUpdate(b, patch)}
                                />
                            ) : (
                                <BudgetCard
                                    key={b._id}
                                    budget={b}
                                    onEdit={() => setEditingId(b._id)}
                                    onDelete={() => handleDelete(b)}
                                />
                            ),
                        )}
                    </div>
                </>
            )}

            {!loading && openSuggestions.length > 0 && (
                <section className="pl-suggest">
                    <div className="pl-section-head">
                        <h2>
                            <FiZap aria-hidden /> Saran budget
                        </h2>
                        <span className="pl-muted">Dari rata-rata pengeluaran 3 bulan terakhir</span>
                    </div>
                    <div className="pl-suggest-grid">
                        {openSuggestions.slice(0, 6).map((s) => {
                            const Icon = CATEGORY_ICONS[s.category.icon] || FiTag;
                            return (
                                <div key={s.category._id} className="pl-suggest-card">
                                    <span className="pl-cat-icon" style={{ "--cat": s.category.color || "#1e6e55" }}>
                                        <Icon aria-hidden />
                                    </span>
                                    <div className="pl-suggest-text">
                                        <strong>{s.category.name}</strong>
                                        <span>
                                            Rata-rata {formatRupiah(s.average)}/bln · puncak {formatRupiah(s.peak)}
                                        </span>
                                    </div>
                                    <button type="button" className="pl-chip-btn" onClick={() => applySuggestion(s)}>
                                        {formatRupiah(s.suggested)}
                                        <FiPlus aria-hidden />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

function alertText(b) {
    if (b.status === "over") return `lewat ${formatRupiah(b.spent - b.effectiveLimit)} dari batas.`;
    if (b.status === "danger")
        return `dengan laju ${formatRupiah(b.dailyRate)}/hari, diperkirakan jebol ${formatRupiah(b.projectedOver)}. Tahan di ${formatRupiah(b.perDayLeft)}/hari.`;
    return `sudah terpakai ${b.percentage}% (batas peringatan ${b.alertThreshold}%).`;
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

function BudgetCard({ budget: b, onEdit, onDelete }) {
    const S = STATUS[b.status] || STATUS.safe;
    const Icon = CATEGORY_ICONS[b.category?.icon] || FiTag;
    const clock = b.clock || {};
    const pacePct = clock.phase === "current" ? (clock.daysElapsed / clock.daysInMonth) * 100 : null;
    const ghost = b.effectiveLimit > 0 ? (b.projected / b.effectiveLimit) * 100 : 0;
    const trend = b.avg3 > 0 ? Math.round(((b.projected - b.avg3) / b.avg3) * 100) : null;

    return (
        <article className={`pl-budget status-${b.status}`}>
            <header className="pl-budget-head">
                <span className="pl-cat-icon" style={{ "--cat": b.category?.color || "#1e6e55" }}>
                    <Icon aria-hidden />
                </span>
                <div className="pl-budget-title">
                    <strong>{b.category?.name || "Kategori"}</strong>
                    <span className="pl-budget-tags">
                        <span className={`pl-pill tone-${S.tone}`}>
                            <S.icon aria-hidden /> {S.label}
                        </span>
                        {b.rollover && (
                            <span className="pl-pill tone-muted" title="Sisa bulan lalu ikut ditambahkan">
                                <FiRepeat aria-hidden /> Rollover
                                {b.carryIn > 0 && ` +${formatRupiah(b.carryIn)}`}
                            </span>
                        )}
                    </span>
                </div>
                <div className="pl-budget-amount">
                    <strong>{formatRupiah(b.spent)}</strong>
                    <span>dari {formatRupiah(b.effectiveLimit)}</span>
                </div>
                <div className="pl-icon-actions">
                    <button type="button" onClick={onEdit} aria-label="Ubah budget">
                        <FiEdit2 />
                    </button>
                    <button type="button" className="is-danger" onClick={onDelete} aria-label="Hapus budget">
                        <FiTrash2 />
                    </button>
                </div>
            </header>

            <Meter
                value={b.percentage}
                ghost={clock.phase === "current" ? ghost : undefined}
                marker={pacePct}
                markerLabel="Batas wajar sampai hari ini"
                tone={S.tone === "danger" ? "danger" : S.tone === "warn" ? "warn" : "cat"}
                color={S.tone === "ok" ? b.category?.color : undefined}
                label={`Budget ${b.category?.name}`}
            />

            <dl className="pl-facts">
                <div>
                    <dt>{b.remaining >= 0 ? "Sisa" : "Lewat"}</dt>
                    <dd className={b.remaining < 0 ? "is-danger" : ""}>{formatRupiah(Math.abs(b.remaining))}</dd>
                </div>
                {clock.phase !== "past" && (
                    <div>
                        <dt>Per hari</dt>
                        <dd className={b.remaining <= 0 ? "is-danger" : ""}>
                            {b.remaining <= 0 ? (
                                "Habis"
                            ) : (
                                <>
                                    {formatRupiah(b.perDayLeft)}
                                    <small> × {clock.daysLeft} hari</small>
                                </>
                            )}
                        </dd>
                    </div>
                )}
                {clock.phase === "current" && (
                    <div>
                        <dt>Proyeksi</dt>
                        <dd className={b.projected > b.effectiveLimit ? "is-danger" : ""}>{formatRupiah(b.projected)}</dd>
                    </div>
                )}
                <div>
                    <dt>Rata-rata 3 bln</dt>
                    <dd>
                        {formatRupiah(b.avg3)}
                        {trend !== null && clock.phase === "current" && (
                            <small className={trend > 0 ? "is-danger" : "is-ok"}>
                                {" "}
                                <FiTrendingUp aria-hidden className={trend <= 0 ? "flip" : ""} /> {Math.abs(trend)}%
                            </small>
                        )}
                    </dd>
                </div>
            </dl>
            {b.note && <p className="pl-note">{b.note}</p>}
        </article>
    );
}

function BudgetEditor({ budget: b, onCancel, onSave }) {
    const [limit, setLimit] = useState(formatNumberInput(String(b.limit)));
    const [threshold, setThreshold] = useState(b.alertThreshold || 80);
    const [rollover, setRollover] = useState(Boolean(b.rollover));
    const [note, setNote] = useState(b.note || "");
    const [busy, setBusy] = useState(false);
    const parsed = parseNumberInput(limit);

    return (
        <form
            className="pl-budget is-editing"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!parsed) return;
                setBusy(true);
                try {
                    await onSave({ limit: parsed, alertThreshold: Number(threshold), rollover, note });
                } finally {
                    setBusy(false);
                }
            }}
        >
            <header className="pl-edit-head">
                <strong>Ubah budget {b.category?.name}</strong>
                <button type="button" className="pop-icon-btn" onClick={onCancel} aria-label="Batal">
                    <FiX />
                </button>
            </header>
            <div className="pl-form-grid">
                <label className="pl-field">
                    <span>Batas per bulan</span>
                    <div className="pl-money">
                        <em>Rp</em>
                        <input value={limit} onChange={(e) => setLimit(formatNumberInput(e.target.value))} inputMode="numeric" />
                    </div>
                    {b.avg3 > 0 && (
                        <button type="button" className="pl-hint-btn" onClick={() => setLimit(formatNumberInput(String(b.avg3)))}>
                            Pakai rata-rata 3 bulan ({formatRupiah(b.avg3)})
                        </button>
                    )}
                </label>
                <label className="pl-field">
                    <span>Peringatan saat terpakai {threshold}%</span>
                    <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="pl-range"
                    />
                </label>
                <div className="pl-span">
                    <Switch
                        id={`ro-${b._id}`}
                        checked={rollover}
                        onChange={setRollover}
                        label="Rollover sisa budget"
                        description="Sisa bulan lalu ditambahkan ke batas bulan ini."
                    />
                </div>
                <label className="pl-field pl-span">
                    <span>Catatan</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" className="pl-input" />
                </label>
            </div>
            <div className="pl-form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Batal
                </button>
                <button type="submit" className="btn-primary" disabled={!parsed || busy}>
                    {busy ? "Menyimpan..." : "Simpan perubahan"}
                </button>
            </div>
        </form>
    );
}

function BudgetForm({ form, setForm, error, saving, categories, suggestionFor, onSubmit, onClose }) {
    const s = form.categoryId ? suggestionFor(form.categoryId) : null;
    return (
        <section className="inline-form" aria-label="Tambah budget">
            <header className="inline-form-head">
                <div>
                    <h2>Tambah budget</h2>
                    <p>Batas pengeluaran per kategori untuk bulan yang dipilih.</p>
                </div>
                <button type="button" className="pop-icon-btn" aria-label="Tutup" onClick={onClose}>
                    <FiX />
                </button>
            </header>
            {error && (
                <div className="set-notice is-error" style={{ marginTop: 0, marginBottom: 14 }}>
                    {error}
                </div>
            )}
            <form onSubmit={onSubmit}>
                <div className="pl-form-grid">
                    <label className="pl-field">
                        <span>Kategori</span>
                        <DropdownMenu
                            value={form.categoryId}
                            options={[
                                { value: "", label: "Pilih kategori..." },
                                ...categories.map((c) => ({ value: c._id, label: c.name })),
                            ]}
                            onChange={(v) => setForm({ ...form, categoryId: v })}
                        />
                    </label>
                    <label className="pl-field">
                        <span>Batas per bulan</span>
                        <div className="pl-money">
                            <em>Rp</em>
                            <input
                                value={form.limit}
                                onChange={(e) => setForm({ ...form, limit: formatNumberInput(e.target.value) })}
                                placeholder="1.500.000"
                                inputMode="numeric"
                            />
                        </div>
                        {s && (
                            <button
                                type="button"
                                className="pl-hint-btn"
                                onClick={() => setForm({ ...form, limit: formatNumberInput(String(s.suggested)) })}
                            >
                                <FiZap aria-hidden /> Saran {formatRupiah(s.suggested)} · rata-rata {formatRupiah(s.average)}
                            </button>
                        )}
                    </label>
                    <label className="pl-field">
                        <span>Peringatan saat terpakai {form.alertThreshold}%</span>
                        <input
                            type="range"
                            min="50"
                            max="100"
                            step="5"
                            value={form.alertThreshold}
                            onChange={(e) => setForm({ ...form, alertThreshold: Number(e.target.value) })}
                            className="pl-range"
                        />
                    </label>
                    <div className="pl-field">
                        <span>&nbsp;</span>
                        <Switch
                            id="ro-new"
                            checked={form.rollover}
                            onChange={(v) => setForm({ ...form, rollover: v })}
                            label="Rollover sisa budget"
                            description="Sisa bulan lalu ditambahkan."
                        />
                    </div>
                </div>
                <div className="pl-form-actions">
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Batal
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? "Menyimpan..." : "Simpan budget"}
                    </button>
                </div>
            </form>
        </section>
    );
}
