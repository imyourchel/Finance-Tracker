import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    FiArrowDownLeft,
    FiArrowUpRight,
    FiRepeat,
    FiCornerDownLeft,
    FiCheck,
    FiAlertCircle,
    FiZap,
    FiX,
    FiCalendar,
    FiHash,
    FiEdit3,
} from "react-icons/fi";
import { useFinance } from "../../context/FinanceContext";
import { createTransactionAPI, deleteTransactionAPI, getTransactionsAPI } from "../../services/api";
import { parseQuick, learnFromHistory } from "../../utils/quickParse";
import { formatRupiah, formatNumberInput } from "../../utils/format";
import DropdownMenu from "../ui/DropdownMenu";
import "../../styles/quickadd.css";
import { QUICK_ADD_EVENT } from "../../utils/quickAddBus";


const EXAMPLES = [
    "kopi 18rb gopay",
    "makan siang warteg 22.000 kemarin",
    "gaji 6,5jt bca",
    "topup gopay 100rb dari bca",
    "parkir goceng; bensin 30rb #motor",
    "nonton bioskop 50rb sabtu malam @senang",
];

const TYPE_META = {
    expense: { label: "Pengeluaran", icon: FiArrowUpRight },
    income: { label: "Pemasukan", icon: FiArrowDownLeft },
    transfer: { label: "Transfer", icon: FiRepeat },
};

const MOOD_LABEL = {
    senang: "😄 Senang",
    biasa: "😐 Biasa",
    sedih: "😔 Sedih",
    self_reward: "🎁 Self reward",
    terpaksa: "😩 Terpaksa",
    bangga: "😌 Bangga",
    bersalah: "😖 Bersalah",
};

const ymd = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const dateLabel = (d) => {
    const x = new Date(d);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    const time = x.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (x.toDateString() === today.toDateString()) return `Hari ini, ${time}`;
    if (x.toDateString() === y.toDateString()) return `Kemarin, ${time}`;
    return x.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
};

/** Catat cepat dengan bahasa sehari-hari. Buka dengan Ctrl/⌘+K dari halaman mana pun. */
export default function QuickAdd() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener("keydown", onKey);
        window.addEventListener(QUICK_ADD_EVENT, onOpen);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener(QUICK_ADD_EVENT, onOpen);
        };
    }, []);

    if (!open) return null;
    return createPortal(<Palette onClose={() => setOpen(false)} />, document.body);
}

let learnedCache = null;

function Palette({ onClose }) {
    const { wallets, categories, refresh } = useFinance();
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [text, setText] = useState("");
    const [overrides, setOverrides] = useState({}); // per indeks: { categoryId, walletId }
    const [learned, setLearned] = useState(learnedCache || {});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState([]);
    const [error, setError] = useState("");
    const [example] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);

    useEffect(() => {
        inputRef.current?.focus();
        if (learnedCache) return;
        getTransactionsAPI({ limit: 100, sort: "date_desc" })
            .then((res) => {
                learnedCache = learnFromHistory(res.data.transactions || []);
                setLearned(learnedCache);
            })
            .catch(() => {});
    }, []);

    const parsed = useMemo(() => {
        const items = parseQuick(text, { wallets, categories, learned, now: new Date() });
        return items.map((it, i) => {
            const o = overrides[i] || {};
            const merged = { ...it, ...o };
            const issues = merged.issues.filter(
                (x) =>
                    !(x === "Kategori belum dikenali" && merged.categoryId) &&
                    !(x === "Wallet belum dipilih" && merged.walletId),
            );
            return { ...merged, issues, ok: issues.length === 0 };
        });
    }, [text, wallets, categories, learned, overrides]);

    const walletById = (id) => wallets.find((w) => w._id === id);
    const catById = (id) => categories.find((c) => String(c._id) === String(id));
    const canSave = parsed.length > 0 && parsed.every((p) => p.ok) && !saving;

    const setOverride = (i, patch) => setOverrides((o) => ({ ...o, [i]: { ...o[i], ...patch } }));

    const save = useCallback(async () => {
        if (!canSave) return;
        setSaving(true);
        setError("");
        const done = [];
        try {
            for (const p of parsed) {
                const isTransfer = p.type === "transfer";
                const res = await createTransactionAPI({
                    walletId: p.walletId,
                    categoryId: isTransfer ? undefined : p.categoryId,
                    type: p.type,
                    amount: p.amount,
                    transferTo: isTransfer ? p.transferTo : null,
                    transferFee: 0,
                    mood: p.mood || null,
                    tags: p.tags,
                    description:
                        p.description ||
                        (isTransfer ? `Transfer ke ${walletById(p.transferTo)?.name || ""}`.trim() : ""),
                    date: p.date.toISOString(),
                });
                const tx = res.data?.transaction || res.data?.outTransaction || res.data;
                done.push({ id: tx?._id, label: p.description || TYPE_META[p.type].label, amount: p.amount, type: p.type });
            }
            setSaved((s) => [...done, ...s].slice(0, 5));
            setText("");
            setOverrides({});
            learnedCache = null; // pelajari ulang dengan catatan baru di pembukaan berikutnya
            refresh();
        } catch (err) {
            setError(err.response?.data?.message || "Gagal menyimpan. Coba lagi.");
            if (done.length) {
                setSaved((s) => [...done, ...s].slice(0, 5));
                refresh();
            }
        } finally {
            setSaving(false);
            inputRef.current?.focus();
        }
    }, [canSave, parsed, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

    const undo = async (item) => {
        if (!item.id) return;
        try {
            await deleteTransactionAPI(item.id);
            setSaved((s) => s.filter((x) => x !== item));
            refresh();
        } catch (err) {
            setError(err.response?.data?.message || "Gagal membatalkan.");
        }
    };

    const openDetail = () => {
        const p = parsed[0];
        onClose();
        navigate("/transactions/new", {
            state: p
                ? {
                      preset: {
                          type: p.type,
                          walletId: p.walletId || "",
                          transferTo: p.transferTo || "",
                          categoryId: p.categoryId || "",
                          amount: p.amount ? formatNumberInput(String(p.amount)) : "",
                          description: p.description,
                          date: ymd(p.date),
                          tags: p.tags,
                          mood: p.mood || "",
                      },
                  }
                : undefined,
        });
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
        }
    };

    const walletOptions = wallets.map((w) => ({ value: w._id, label: w.name }));

    return (
        <div className="qa-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="qa-panel" role="dialog" aria-modal="true" aria-label="Catat cepat">
                <div className="qa-input-row">
                    <FiZap className="qa-bolt" aria-hidden />
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setOverrides({});
                            setError("");
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={`Ketik seperti biasa, mis. "${example}"`}
                        aria-label="Kalimat transaksi"
                        spellCheck={false}
                    />
                    <kbd className="qa-kbd">Esc</kbd>
                </div>

                {parsed.length > 0 ? (
                    <ul className="qa-list">
                        {parsed.map((p, i) => {
                            const Meta = TYPE_META[p.type];
                            const cats = categories.filter((c) => !c.type || c.type === p.type);
                            return (
                                <li key={i} className={`qa-item is-${p.type} ${p.ok ? "" : "has-issue"}`}>
                                    <span className="qa-type">
                                        <Meta.icon aria-hidden />
                                    </span>
                                    <div className="qa-main">
                                        <div className="qa-title">
                                            <strong>
                                                {p.type === "transfer"
                                                    ? `${walletById(p.walletId)?.name || "?"} → ${walletById(p.transferTo)?.name || "?"}`
                                                    : p.description || catById(p.categoryId)?.name || Meta.label}
                                            </strong>
                                            <span className={`qa-amount ${p.amount ? "" : "is-missing"}`}>
                                                {p.amount
                                                    ? `${p.type === "income" ? "+" : p.type === "expense" ? "−" : ""}${formatRupiah(p.amount)}`
                                                    : "Rp ?"}
                                            </span>
                                        </div>
                                        <div className="qa-chips">
                                            <span className="qa-chip is-type">{Meta.label}</span>
                                            {p.type !== "transfer" && (
                                                <DropdownMenu
                                                    value={p.categoryId || ""}
                                                    options={cats.map((c) => ({ value: c._id, label: c.name }))}
                                                    onChange={(v) => setOverride(i, { categoryId: v })}
                                                    placeholder="Kategori"
                                                    minWidth="120px"
                                                />
                                            )}
                                            {p.type !== "transfer" && (
                                                <DropdownMenu
                                                    value={p.walletId || ""}
                                                    options={walletOptions}
                                                    onChange={(v) => setOverride(i, { walletId: v })}
                                                    placeholder="Wallet"
                                                    minWidth="110px"
                                                />
                                            )}
                                            <span className="qa-chip">
                                                <FiCalendar aria-hidden /> {dateLabel(p.date)}
                                            </span>
                                            {p.tags.map((t) => (
                                                <span key={t} className="qa-chip">
                                                    <FiHash aria-hidden />
                                                    {t}
                                                </span>
                                            ))}
                                            {p.mood && <span className="qa-chip">{MOOD_LABEL[p.mood]}</span>}
                                            {p.categorySource === "learned" && (
                                                <span className="qa-chip is-learned" title="Ditebak dari catatanmu sebelumnya">
                                                    dari kebiasaanmu
                                                </span>
                                            )}
                                        </div>
                                        {p.issues.length > 0 && (
                                            <div className="qa-issue">
                                                <FiAlertCircle aria-hidden /> {p.issues.join(" · ")}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="qa-help">
                        <p>Tulis seperti chat ke teman. Contoh:</p>
                        <div className="qa-examples">
                            {EXAMPLES.map((ex) => (
                                <button
                                    key={ex}
                                    type="button"
                                    onClick={() => {
                                        setText(ex);
                                        inputRef.current?.focus();
                                    }}
                                >
                                    {ex}
                                </button>
                            ))}
                        </div>
                        <ul className="qa-tips">
                            <li>
                                <b>18rb</b>, <b>1,5jt</b>, <b>goceng</b>, <b>Rp 22.000</b> untuk nominal
                            </li>
                            <li>
                                <b>kemarin</b>, <b>sabtu</b>, <b>tgl 5</b>, <b>jam 8 malam</b> untuk waktu
                            </li>
                            <li>
                                <b>#tag</b> untuk tag, <b>@senang</b> untuk mood, <b>;</b> untuk beberapa transaksi
                            </li>
                        </ul>
                    </div>
                )}

                {error && (
                    <div className="qa-error" role="alert">
                        <FiAlertCircle aria-hidden /> {error}
                    </div>
                )}

                {saved.length > 0 && (
                    <ul className="qa-saved" aria-live="polite">
                        {saved.map((s, i) => (
                            <li key={`${s.id}-${i}`}>
                                <FiCheck aria-hidden />
                                <span>
                                    {s.label} · {formatRupiah(s.amount)}
                                </span>
                                {s.id && (
                                    <button type="button" onClick={() => undo(s)}>
                                        Batalkan
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <footer className="qa-foot">
                    <span>
                        <kbd>Enter</kbd> simpan · <kbd>Shift</kbd>+<kbd>Enter</kbd> baris baru
                    </span>
                    <div className="qa-actions">
                        <button type="button" className="qa-ghost" onClick={openDetail}>
                            <FiEdit3 aria-hidden /> Isi detail
                        </button>
                        <button type="button" className="qa-save" onClick={save} disabled={!canSave}>
                            {saving ? (
                                "Menyimpan..."
                            ) : (
                                <>
                                    Simpan{parsed.length > 1 ? ` ${parsed.length}` : ""} <FiCornerDownLeft aria-hidden />
                                </>
                            )}
                        </button>
                        <button type="button" className="qa-close" onClick={onClose} aria-label="Tutup">
                            <FiX />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
