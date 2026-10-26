import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
    FiArrowLeft,
    FiArrowDownLeft,
    FiArrowUpRight,
    FiRepeat,
    FiTag,
    FiChevronDown,
    FiUploadCloud,
    FiX,
    FiAlertCircle,
    FiAlertTriangle,
    FiMapPin,
} from "react-icons/fi";
import { createTransactionAPI, updateTransactionAPI } from "../services/api";
import { useFinance } from "../context/FinanceContext";
import { formatDateInput, formatNumberInput, parseNumberInput, formatRupiah } from "../utils/format";
import DropdownMenu from "../components/ui/DropdownMenu";
import DatePicker from "../components/ui/DatePicker";
import { confirmDialog } from "../utils/confirm";
import { CATEGORY_ICONS } from "../utils/categoryIcons";

const TYPES = [
    { value: "expense", label: "Pengeluaran", icon: FiArrowUpRight },
    { value: "income", label: "Pemasukan", icon: FiArrowDownLeft },
    { value: "transfer", label: "Transfer", icon: FiRepeat },
];

const MOODS = [
    { value: "senang", label: "😄 Senang" },
    { value: "biasa", label: "😐 Biasa" },
    { value: "sedih", label: "😔 Sedih" },
    { value: "self_reward", label: "🎁 Self reward" },
    { value: "terpaksa", label: "😩 Terpaksa" },
    { value: "bangga", label: "😌 Bangga" },
    { value: "bersalah", label: "😖 Bersalah" },
];

const fmtDateLong = (ymd) => {
    if (!ymd) return "-";
    const d = new Date(`${ymd}T00:00:00`);
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const initialForm = (editData, wallets) => ({
    type: editData?.type || "expense",
    walletId: editData?.wallet?._id || wallets.find((w) => w.isDefault)?._id || wallets[0]?._id || "",
    categoryId: editData?.category?._id || "",
    transferTo: editData?.transferTo?._id || "",
    transferFee: editData?.transferFee ? formatNumberInput(String(editData.transferFee)) : "",
    amount: editData?.amount ? formatNumberInput(String(editData.amount)) : "",
    description: editData?.description || "",
    date: editData?.date ? formatDateInput(editData.date) : formatDateInput(new Date()),
    mood: editData?.mood || "",
    tags: editData?.tags?.filter(Boolean) || [],
    location: editData?.location || "",
    goldWeight: editData?.goldWeight ? String(editData.goldWeight).replace(".", ",") : "",
});

const parseGram = (v) => Number(String(v || "").replace(",", ".")) || 0;
const cleanGram = (v) => v.replace(/[^0-9.,]/g, "").replace(/([.,].*)[.,]/g, "$1").slice(0, 8);
const fmtGram = (n) => Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 3 });

export default function TransactionEditor() {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { wallets, categories, refresh } = useFinance();
    const editData = id ? state?.transaction : null;
    const isEdit = Boolean(id);
    // Kembali ke halaman asal (mis. detail wallet), default ke daftar transaksi
    const backTo = state?.returnTo || "/transactions";

    // Preset dari tombol lain, mis. "Beli emas" di halaman Wallet
    const [form, setForm] = useState(() => ({ ...initialForm(editData, wallets), ...(!id && state?.preset) }));
    const [startForm] = useState(() => JSON.stringify({ ...initialForm(editData, wallets), ...(!id && state?.preset) }));
    const [tagDraft, setTagDraft] = useState("");
    const [showMore, setShowMore] = useState(
        Boolean(editData?.mood || editData?.tags?.length || editData?.receiptImage),
    );
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(editData?.receiptImage || null);
    const [receiptRemoved, setReceiptRemoved] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [saving, setSaving] = useState(null); // "stay" | "back" | null
    const [error, setError] = useState("");
    const amountRef = useRef(null);
    const fileRef = useRef(null);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    // Edit tanpa data (mis. halaman di-refresh) → kembali ke daftar
    useEffect(() => {
        if (isEdit && !editData) navigate("/transactions", { replace: true });
    }, [isEdit, editData, navigate]);

    useEffect(() => {
        amountRef.current?.focus();
    }, []);

    // Wallet terpilih; kalau belum ada (data wallet baru termuat) pakai wallet default
    const walletId = form.walletId || wallets.find((w) => w.isDefault)?._id || wallets[0]?._id || "";
    const isTransfer = form.type === "transfer";
    const amount = parseNumberInput(form.amount || "0") || 0;
    const fee = isTransfer ? parseNumberInput(form.transferFee || "0") || 0 : 0;
    const wallet = wallets.find((w) => w._id === walletId);
    const destWallet = wallets.find((w) => w._id === form.transferTo);
    const category = categories.find((c) => c._id === form.categoryId);
    const destOptions = wallets.filter((w) => w._id !== walletId);

    const visibleCategories = useMemo(
        () => categories.filter((c) => c.type === form.type || c.type === "both"),
        [categories, form.type],
    );

    // Saldo wallet asal setelah transaksi (memperhitungkan nilai lama saat edit)
    const balanceAfter = useMemo(() => {
        if (!wallet) return null;
        let base = wallet.balance || 0;
        if (isEdit && editData?.wallet?._id === wallet._id) {
            base += editData.type === "income" ? -editData.amount : editData.amount + (editData.transferFee || 0);
        }
        if (form.type === "income") return base + amount;
        return base - amount - fee;
    }, [wallet, form.type, amount, fee, isEdit, editData]);

    // Emas: wallet asal/tujuan bertipe emas → wajib isi berat
    const goldSource = wallet?.type === "gold";
    const goldDest = isTransfer && destWallet?.type === "gold";
    const goldWallet = goldDest ? destWallet : goldSource ? wallet : null;
    const grams = parseGram(form.goldWeight);
    const gramsIn = goldDest || (goldSource && form.type === "income");
    const gramsAfter = goldWallet
        ? Math.max(0, (goldWallet.goldWeight || 0) + (gramsIn ? grams : -grams) - (isEdit && editData?.goldWeight && editData.wallet?._id === goldWallet._id ? (editData.type === "income" ? editData.goldWeight : -editData.goldWeight) : 0))
        : 0;
    const goldLabel = goldDest ? "Beli emas" : goldSource && isTransfer ? "Jual emas" : null;

    const insufficient = form.type !== "income" && balanceAfter !== null && balanceAfter < 0 && amount > 0;

    const changeType = (type) => {
        setForm((f) => ({
            ...f,
            type,
            categoryId: "",
            transferTo: type === "transfer" ? f.transferTo || wallets.find((w) => w._id !== walletId)?._id || "" : "",
            transferFee: type === "transfer" ? f.transferFee : "",
        }));
        setError("");
    };

    const addTag = (raw) => {
        const t = raw.trim().replace(/^#/, "");
        if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
        setTagDraft("");
    };

    const pickFile = (f) => {
        if (!f) return;
        if (!f.type.startsWith("image/")) return setError("Bukti harus berupa gambar (JPG/PNG)");
        if (f.size > 5 * 1024 * 1024) return setError("Ukuran gambar maksimal 5 MB");
        setReceiptFile(f);
        setReceiptPreview(URL.createObjectURL(f));
        setReceiptRemoved(false);
    };

    const dirty = JSON.stringify(form) !== startForm || Boolean(receiptFile) || receiptRemoved;

    // Batal/kembali: tanya dulu kalau ada isian yang belum disimpan
    const leave = async (e) => {
        e?.preventDefault();
        if (dirty) {
            const ok = await confirmDialog({
                title: "Buang perubahan?",
                message: "Isian di halaman ini belum disimpan dan akan hilang.",
                confirmLabel: "Buang",
                cancelLabel: "Lanjut mengisi",
            });
            if (!ok) return;
        }
        navigate(backTo);
    };

    const removeReceipt = async () => {
        const ok = await confirmDialog({
            title: "Hapus foto bukti?",
            message: isEdit && editData?.receiptImage && !receiptFile
                ? "Foto bukti yang tersimpan akan dihapus saat kamu menyimpan transaksi."
                : "Foto yang baru kamu pilih akan dibatalkan.",
            confirmLabel: "Hapus",
        });
        if (!ok) return;
        setReceiptFile(null);
        setReceiptPreview(null);
        setReceiptRemoved(Boolean(editData?.receiptImage));
    };

    const validate = () => {
        if (!walletId) return "Pilih wallet terlebih dahulu";
        if (!(amount > 0)) return "Masukkan nominal transaksi";
        if (!isTransfer && !form.categoryId) return "Pilih kategori transaksi";
        if (isTransfer && !form.transferTo) return "Pilih wallet tujuan transfer";
        if (insufficient) return `Saldo ${wallet?.name} tidak cukup untuk transaksi ini`;
        if (goldWallet && !(grams > 0)) return "Isi berat emas dalam gram";
        if (goldWallet && !gramsIn && grams > (goldWallet.goldWeight || 0))
            return `Berat emas di ${goldWallet.name} hanya ${fmtGram(goldWallet.goldWeight)} gram`;
        return "";
    };

    const save = async (mode) => {
        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }
        setError("");
        if (isEdit) {
            const ok = await confirmDialog({
                title: "Simpan perubahan transaksi?",
                message: "Saldo wallet dan budget akan disesuaikan dengan data yang baru.",
                confirmLabel: "Simpan",
                danger: false,
            });
            if (!ok) return;
        }
        setSaving(mode);
        try {
            const payload = {
                walletId,
                categoryId: isTransfer ? undefined : form.categoryId,
                type: form.type,
                amount,
                transferTo: isTransfer ? form.transferTo : null,
                transferFee: fee,
                mood: form.mood || null,
                tags: form.tags,
                description: form.description.trim(),
                location: form.location.trim(),
                date: form.date,
                ...(goldWallet && { goldWeight: grams }),
            };

            let body = payload;
            if (receiptFile || receiptRemoved) {
                body = new FormData();
                Object.entries(payload).forEach(([k, v]) => {
                    if (v === undefined || v === null) return;
                    body.append(k, Array.isArray(v) ? v.join(",") : v);
                });
                if (receiptFile) body.append("receipt", receiptFile);
                if (receiptRemoved) body.append("receiptRemoved", "true");
            }

            if (isEdit) await updateTransactionAPI(id, body);
            else await createTransactionAPI(body);
            await refresh();

            if (mode === "stay" && !isEdit) {
                setForm((f) => ({ ...initialForm(null, wallets), type: f.type, walletId, date: f.date }));
                setReceiptFile(null);
                setReceiptPreview(null);
                setTagDraft("");
                setError("");
                amountRef.current?.focus();
            } else {
                navigate(backTo);
            }
        } catch (err) {
            setError(err.message || "Gagal menyimpan transaksi");
        } finally {
            setSaving(null);
        }
    };

    const onSubmit = (e) => {
        e.preventDefault();
        save("back");
    };

    // Ctrl/Cmd + Enter untuk simpan
    const onKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            save("back");
        }
    };

    const walletOptions = wallets.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` }));

    return (
        <div className={`tx-page tx-${form.type}`} onKeyDown={onKeyDown}>
            <Link to={backTo} className="tx-back" onClick={leave}>
                <FiArrowLeft aria-hidden /> {state?.returnLabel || "Transaksi"}
            </Link>
            <h1 className="tx-title">{isEdit ? "Edit transaksi" : goldLabel || "Tambah transaksi"}</h1>

            <form className="tx-layout" onSubmit={onSubmit} noValidate>
                <div className="tx-main">
                    {/* Tipe + nominal */}
                    <section className="tx-card tx-hero">
                        <div className="tx-types" role="radiogroup" aria-label="Tipe transaksi">
                            {TYPES.map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.type === value}
                                    className={`tx-type tx-type-${value} ${form.type === value ? "is-active" : ""}`}
                                    onClick={() => changeType(value)}
                                >
                                    <Icon aria-hidden />
                                    {label}
                                </button>
                            ))}
                        </div>

                        <label className="tx-amount" htmlFor="tx-amount">
                            <span className="tx-amount-label">Nominal</span>
                            <span className="tx-amount-row">
                                <span className="tx-amount-cur">Rp</span>
                                <input
                                    id="tx-amount"
                                    ref={amountRef}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="0"
                                    value={form.amount}
                                    onChange={(e) => set("amount", formatNumberInput(e.target.value))}
                                />
                            </span>
                        </label>
                    </section>

                    {/* Wallet & kategori */}
                    <section className="tx-card">
                        <div className={`tx-grid ${isTransfer ? "" : "tx-grid-1"}`}>
                            <div className="tx-field">
                                <label>{isTransfer ? "Dari wallet" : "Wallet"}</label>
                                <DropdownMenu
                                    value={walletId}
                                    options={walletOptions}
                                    onChange={(v) => set("walletId", v)}
                                    placeholder="Pilih wallet"
                                />
                            </div>
                            {isTransfer && (
                                <div className="tx-field">
                                    <label>Ke wallet</label>
                                    <DropdownMenu
                                        value={form.transferTo}
                                        options={destOptions.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` }))}
                                        onChange={(v) => set("transferTo", v)}
                                        placeholder={destOptions.length ? "Pilih wallet tujuan" : "Belum ada wallet lain"}
                                    />
                                </div>
                            )}
                        </div>

                        {goldWallet && (
                            <div className="tx-gold">
                                <div className="tx-field">
                                    <label htmlFor="tx-gold">
                                        Berat emas {goldLabel ? `(${goldLabel.toLowerCase()})` : ""}
                                    </label>
                                    <div className="unit-input">
                                        <input
                                            id="tx-gold"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="contoh: 1 atau 0,5"
                                            value={form.goldWeight}
                                            onChange={(e) => set("goldWeight", cleanGram(e.target.value))}
                                        />
                                        <span>gram</span>
                                    </div>
                                </div>
                                <p className="tx-hint">
                                    {goldWallet.name}: {fmtGram(goldWallet.goldWeight)} gram sekarang
                                    {grams > 0 && amount > 0 && ` · harga transaksi ini ${formatRupiah(Math.round(amount / grams))}/gram`}
                                </p>
                            </div>
                        )}

                        {isTransfer ? (
                            <div className="tx-field" style={{ marginTop: 16, maxWidth: 280 }}>
                                <label htmlFor="tx-fee">Biaya transfer</label>
                                <div className="money-input">
                                    <input
                                        id="tx-fee"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={form.transferFee}
                                        onChange={(e) => set("transferFee", formatNumberInput(e.target.value))}
                                    />
                                </div>
                                <p className="tx-hint">Isi kalau ada biaya admin antar bank.</p>
                            </div>
                        ) : (
                            <div className="tx-field" style={{ marginTop: 18 }}>
                                <label>Kategori</label>
                                <div className="tx-cats" role="radiogroup" aria-label="Kategori">
                                    {visibleCategories.map((c) => {
                                        const Icon = CATEGORY_ICONS[c.icon] || FiTag;
                                        const active = c._id === form.categoryId;
                                        return (
                                            <button
                                                key={c._id}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                className={`tx-cat ${active ? "is-active" : ""}`}
                                                style={{ "--cat": c.color || "var(--accent)" }}
                                                onClick={() => set("categoryId", c._id)}
                                            >
                                                <span className="tx-cat-icon">
                                                    <Icon aria-hidden />
                                                </span>
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                    {visibleCategories.length === 0 && (
                                        <p className="tx-hint">Belum ada kategori untuk tipe ini.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Tanggal, lokasi, keterangan */}
                    <section className="tx-card">
                        <div className="tx-grid">
                            <div className="tx-field">
                                <label>Tanggal</label>
                                <DatePicker value={form.date} onChange={(v) => set("date", v)} clearable={false} />
                            </div>
                            <div className="tx-field">
                                <label htmlFor="tx-location">Lokasi</label>
                                <div className="icon-input">
                                    <FiMapPin aria-hidden />
                                    <input
                                        id="tx-location"
                                        type="text"
                                        placeholder="Opsional, mis. Warung Pak Budi"
                                        value={form.location}
                                        onChange={(e) => set("location", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="tx-field" style={{ marginTop: 16 }}>
                            <label htmlFor="tx-desc">Keterangan</label>
                            <textarea
                                id="tx-desc"
                                rows={2}
                                placeholder="Opsional, mis. Nasi goreng 2 porsi"
                                value={form.description}
                                onChange={(e) => set("description", e.target.value)}
                                maxLength={200}
                            />
                        </div>
                    </section>

                    {/* Detail tambahan */}
                    <section className="tx-card tx-more">
                        <button
                            type="button"
                            className={`tx-more-toggle ${showMore ? "is-open" : ""}`}
                            onClick={() => setShowMore((v) => !v)}
                            aria-expanded={showMore}
                        >
                            <span>
                                <strong>Detail tambahan</strong>
                                <span>Mood, tag, dan foto bukti</span>
                            </span>
                            <FiChevronDown aria-hidden />
                        </button>

                        {showMore && (
                            <div className="tx-more-body">
                                <div className="tx-field">
                                    <label>Mood saat transaksi</label>
                                    <div className="tx-chips">
                                        {MOODS.map((m) => (
                                            <button
                                                key={m.value}
                                                type="button"
                                                className={`tx-chip ${form.mood === m.value ? "is-active" : ""}`}
                                                onClick={() => set("mood", form.mood === m.value ? "" : m.value)}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="tx-field">
                                    <label htmlFor="tx-tag">Tag</label>
                                    <div className="tag-input" onClick={() => document.getElementById("tx-tag")?.focus()}>
                                        {form.tags.map((t) => (
                                            <span key={t} className="tag">
                                                #{t}
                                                <button
                                                    type="button"
                                                    aria-label={`Hapus tag ${t}`}
                                                    onClick={() => set("tags", form.tags.filter((x) => x !== t))}
                                                >
                                                    <FiX />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            id="tx-tag"
                                            type="text"
                                            value={tagDraft}
                                            placeholder={form.tags.length ? "" : "Ketik lalu Enter, mis. kopi"}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v.endsWith(",")) addTag(v.slice(0, -1));
                                                else setTagDraft(v);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addTag(tagDraft);
                                                } else if (e.key === "Backspace" && !tagDraft && form.tags.length) {
                                                    set("tags", form.tags.slice(0, -1));
                                                }
                                            }}
                                            onBlur={() => tagDraft && addTag(tagDraft)}
                                        />
                                    </div>
                                </div>

                                <div className="tx-field">
                                    <label>Foto bukti</label>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={(e) => pickFile(e.target.files?.[0])}
                                    />
                                    {receiptPreview ? (
                                        <div className="tx-receipt">
                                            <img src={receiptPreview} alt="Bukti transaksi" />
                                            <div>
                                                <strong>{receiptFile?.name || "Bukti tersimpan"}</strong>
                                                <div className="tx-receipt-actions">
                                                    <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                                                        Ganti
                                                    </button>
                                                    <button type="button" className="btn-ghost is-danger" onClick={removeReceipt}>
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className={`tx-drop ${dragOver ? "is-over" : ""}`}
                                            onClick={() => fileRef.current?.click()}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOver(true);
                                            }}
                                            onDragLeave={() => setDragOver(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragOver(false);
                                                pickFile(e.dataTransfer.files?.[0]);
                                            }}
                                        >
                                            <FiUploadCloud aria-hidden />
                                            <span>
                                                <strong>Pilih foto</strong> atau tarik ke sini
                                            </span>
                                            <small>JPG atau PNG, maksimal 5 MB</small>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* Ringkasan */}
                <aside className="tx-side">
                    <div className="tx-card tx-summary">
                        <div className="tx-summary-head">Ringkasan</div>
                        <div className={`tx-summary-amount is-${form.type}`}>
                            {form.type === "income" ? "+" : "−"}
                            {formatRupiah(amount + fee)}
                        </div>
                        <dl>
                            <div>
                                <dt>Tipe</dt>
                                <dd>{TYPES.find((t) => t.value === form.type)?.label}</dd>
                            </div>
                            {!isTransfer && (
                                <div>
                                    <dt>Kategori</dt>
                                    <dd>{category?.name || "—"}</dd>
                                </div>
                            )}
                            <div>
                                <dt>{isTransfer ? "Dari" : "Wallet"}</dt>
                                <dd>{wallet?.name || "—"}</dd>
                            </div>
                            {isTransfer && (
                                <div>
                                    <dt>Ke</dt>
                                    <dd>{destWallet?.name || "—"}</dd>
                                </div>
                            )}
                            {isTransfer && fee > 0 && (
                                <div>
                                    <dt>Biaya transfer</dt>
                                    <dd>{formatRupiah(fee)}</dd>
                                </div>
                            )}
                            {goldWallet && (
                                <div>
                                    <dt>{goldLabel || "Berat emas"}</dt>
                                    <dd>
                                        {gramsIn ? "+" : "−"}
                                        {fmtGram(grams)} gram
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt>Tanggal</dt>
                                <dd>{fmtDateLong(form.date)}</dd>
                            </div>
                        </dl>

                        {wallet && (
                            <div className={`tx-balance ${insufficient ? "is-bad" : ""}`}>
                                <span>Saldo {wallet.name} setelah ini</span>
                                <strong>{formatRupiah(balanceAfter)}</strong>
                            </div>
                        )}
                        {goldWallet && (
                            <div className="tx-balance is-gold">
                                <span>Emas {goldWallet.name} setelah ini</span>
                                <strong>{fmtGram(gramsAfter)} gram</strong>
                            </div>
                        )}
                        {insufficient && (
                            <div className="tx-warn">
                                <FiAlertTriangle aria-hidden />
                                Saldo tidak cukup. Kurangi nominal atau pilih wallet lain.
                            </div>
                        )}

                        {error && (
                            <div className="tx-error" role="alert">
                                <FiAlertCircle aria-hidden />
                                {error}
                            </div>
                        )}

                        <div className="tx-actions">
                            <button type="submit" className="btn-primary" disabled={Boolean(saving)} aria-busy={saving === "back"}>
                                {saving === "back" && <span className="btn-spinner" aria-hidden />}
                                {saving === "back" ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Simpan transaksi"}
                            </button>
                            {!isEdit && (
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    disabled={Boolean(saving)}
                                    aria-busy={saving === "stay"}
                                    onClick={() => save("stay")}
                                >
                                    {saving === "stay" && <span className="btn-spinner" aria-hidden />}
                                    Simpan & tambah lagi
                                </button>
                            )}
                            <Link to={backTo} className="tx-cancel" onClick={leave}>
                                Batal
                            </Link>
                        </div>
                        <p className="tx-kbd">
                            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> untuk simpan
                        </p>
                    </div>
                </aside>
            </form>
        </div>
    );
}
