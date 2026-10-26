import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    FiUploadCloud,
    FiDownload,
    FiFile,
    FiArrowLeft,
    FiArrowRight,
    FiCheck,
    FiAlertTriangle,
    FiAlertCircle,
    FiRotateCcw,
    FiRepeat,
} from "react-icons/fi";
import { useFinance } from "../../context/FinanceContext";
import { getTransactionsAPI } from "../../services/api";
import { previewImportAPI, importTransactionsAPI, undoImportAPI } from "../../services/dataApi";
import { learnFromHistory, guessCategoryFor } from "../../utils/quickParse";
import { formatRupiah } from "../../utils/format";
import { confirmDialog } from "../../utils/confirm";
import DropdownMenu from "../ui/DropdownMenu";
import Switch from "../ui/Switch";
import { parseCsv, detectLayout, buildRows, TEMPLATE_CSV } from "./csv";
import { saveBlob } from "./download";

const STEPS = ["Unggah", "Cocokkan kolom", "Periksa", "Selesai"];
const MAX_ROWS = 2000;
const PAGE = 50;
const MAX_BYTES = 5 * 1024 * 1024;

const MODES = [
    { value: "signed", label: "Satu kolom (+/−)" },
    { value: "split", label: "Debet & kredit terpisah" },
    { value: "flag", label: "Nominal + penanda DB/CR" },
];

const fmtDay = (key) =>
    new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function ImportWizard() {
    const { wallets, categories, refresh } = useFinance();
    const [step, setStep] = useState(0);
    const [file, setFile] = useState(null);
    const [parsed, setParsed] = useState(null); // { rows, delimiter }
    const [layout, setLayout] = useState(null);
    const [mapping, setMapping] = useState(null);
    const [walletId, setWalletId] = useState("");
    const [items, setItems] = useState([]);
    const [applyBalance, setApplyBalance] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [serverErrors, setServerErrors] = useState([]);
    const [result, setResult] = useState(null);
    const [learned, setLearned] = useState({});

    const usableWallets = useMemo(() => wallets.filter((w) => w.type !== "gold" && !w.isArchived), [wallets]);

    useEffect(() => {
        let alive = true;
        getTransactionsAPI({ limit: 100, sort: "date_desc" })
            .then((res) => alive && setLearned(learnFromHistory(res.data.transactions || [])))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const built = useMemo(
        () => (parsed && layout && mapping ? buildRows(parsed.rows, layout, mapping) : { rows: [], skipped: [] }),
        [parsed, layout, mapping],
    );

    const reset = () => {
        setStep(0);
        setFile(null);
        setParsed(null);
        setLayout(null);
        setMapping(null);
        setItems([]);
        setResult(null);
        setError("");
        setServerErrors([]);
    };

    // ── Langkah 1: baca file ─────────────────────────────
    const readFile = async (f) => {
        setError("");
        if (!f) return;
        if (f.size > MAX_BYTES) {
            setError("File terlalu besar (maks. 5 MB). Pecah per bulan lalu impor bergantian.");
            return;
        }
        if (!/\.(csv|txt|tsv)$/i.test(f.name) && !/text|csv/.test(f.type)) {
            setError("Pilih file .csv dari internet banking. Kalau berbentuk Excel (.xlsx), simpan dulu sebagai CSV.");
            return;
        }
        const text = await f.text();
        const p = parseCsv(text);
        if (p.rows.length < 2) {
            setError("File kosong atau tidak terbaca sebagai CSV.");
            return;
        }
        const l = detectLayout(p.rows);
        setFile({ name: f.name, size: f.size });
        setParsed(p);
        setLayout(l);
        setMapping(l.mapping);
        if (!walletId) setWalletId(guessWallet(l.bank.id, usableWallets) || usableWallets[0]?._id || "");
        setStep(1);
    };

    // ── Langkah 2 → 3: periksa duplikat & tebak kategori ─
    const toReview = async () => {
        setError("");
        if (!walletId) return setError("Pilih wallet tujuan dulu.");
        if (!built.rows.length) return setError("Belum ada baris yang terbaca. Periksa pemetaan kolom.");
        if (built.rows.length > MAX_ROWS)
            return setError(`File berisi ${built.rows.length} transaksi. Maksimal ${MAX_ROWS} sekali impor, pecah per periode.`);
        setBusy(true);
        try {
            const payload = built.rows.map((r) => ({ date: r.date, amount: r.amount, type: r.type, description: r.description }));
            const res = await previewImportAPI({ walletId, rows: payload });
            const dupByIndex = new Map((res.data.duplicates || []).map((d) => [d.index, d]));
            setItems(
                built.rows.map((r) => {
                    const dup = dupByIndex.get(r.index) || null;
                    const g = guessCategoryFor(r.description, r.type, categories, learned);
                    return {
                        ...r,
                        dup,
                        categoryId: g?.id ? String(g.id) : "",
                        categorySource: g?.source || null,
                        selected: !dup || dup.level === "likely",
                    };
                }),
            );
            setServerErrors([]);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || "Gagal memeriksa data.");
        } finally {
            setBusy(false);
        }
    };

    // ── Langkah 3 → 4: impor ─────────────────────────────
    const selected = items.filter((i) => i.selected);
    const income = selected.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0);
    const expense = selected.filter((i) => i.type === "expense").reduce((s, i) => s + i.amount, 0);
    const wallet = wallets.find((w) => w._id === walletId);

    const doImport = async () => {
        if (!selected.length) return;
        const ok = await confirmDialog({
            title: `Impor ${selected.length} transaksi ke ${wallet?.name}?`,
            message: applyBalance
                ? `Saldo ${wallet?.name} akan berubah ${income - expense >= 0 ? "+" : "−"}${formatRupiah(Math.abs(income - expense))}.`
                : "Saldo wallet tidak diubah. Cocok untuk mutasi lama yang sudah tercermin di saldo sekarang.",
            confirmLabel: "Impor",
            danger: false,
        });
        if (!ok) return;
        setBusy(true);
        setError("");
        setServerErrors([]);
        try {
            const res = await importTransactionsAPI({
                walletId,
                applyBalance,
                rows: selected.map((i) => ({
                    date: i.date,
                    amount: i.amount,
                    type: i.type,
                    description: i.description,
                    categoryId: i.categoryId || null,
                })),
            });
            setResult(res.data);
            setStep(3);
            refresh();
        } catch (err) {
            setError(err.response?.data?.message || "Impor gagal. Tidak ada data yang tersimpan.");
            const errs = err.response?.data?.errors || [];
            setServerErrors(errs.map((e) => ({ ...e, line: selected[e.index]?.line })));
        } finally {
            setBusy(false);
        }
    };

    const undo = async () => {
        const ok = await confirmDialog({
            title: "Batalkan impor ini?",
            message: `${result.created} transaksi akan dihapus${result.balanceApplied ? " dan saldo wallet dikembalikan" : ""}.`,
            confirmLabel: "Batalkan impor",
        });
        if (!ok) return;
        setBusy(true);
        try {
            await undoImportAPI({ ids: result.ids, revertBalance: result.balanceApplied });
            refresh();
            setResult((r) => ({ ...r, undone: true }));
        } catch (err) {
            setError(err.response?.data?.message || "Gagal membatalkan impor.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="im-wrap">
            <ol className="im-steps" aria-label="Langkah impor">
                {STEPS.map((s, i) => (
                    <li key={s} className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
                        <span>{i < step ? <FiCheck aria-hidden /> : i + 1}</span>
                        {s}
                    </li>
                ))}
            </ol>

            {error && (
                <div className="im-error" role="alert">
                    <FiAlertCircle aria-hidden />
                    <div>
                        <strong>{error}</strong>
                        {serverErrors.length > 0 && (
                            <ul>
                                {serverErrors.map((e) => (
                                    <li key={e.index}>
                                        Baris {e.line ?? e.index + 1}: {e.message}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {step === 0 && <UploadStep onFile={readFile} />}

            {step === 1 && parsed && layout && mapping && (
                <MappingStep
                    file={file}
                    parsed={parsed}
                    layout={layout}
                    mapping={mapping}
                    setMapping={setMapping}
                    built={built}
                    wallets={usableWallets}
                    walletId={walletId}
                    setWalletId={setWalletId}
                    onBack={reset}
                    onNext={toReview}
                    busy={busy}
                />
            )}

            {step === 2 && (
                <ReviewStep
                    items={items}
                    setItems={setItems}
                    categories={categories}
                    wallet={wallet}
                    income={income}
                    expense={expense}
                    selectedCount={selected.length}
                    applyBalance={applyBalance}
                    setApplyBalance={setApplyBalance}
                    onBack={() => setStep(1)}
                    onImport={doImport}
                    busy={busy}
                />
            )}

            {step === 3 && result && (
                <DoneStep result={result} onUndo={undo} onAgain={reset} busy={busy} />
            )}
        </section>
    );
}

function guessWallet(bankId, wallets) {
    const names = { bca: /bca/i, bri: /bri\b|bri$/i, bni: /bni/i, mandiri: /mandiri/i, jago: /jago/i };
    const re = names[bankId];
    return re ? wallets.find((w) => re.test(w.name))?._id : null;
}

// ── Langkah 1 ───────────────────────────────────────────
function UploadStep({ onFile }) {
    const inputRef = useRef(null);
    const [drag, setDrag] = useState(false);

    return (
        <div className="im-upload">
            <label
                className={`im-drop ${drag ? "is-drag" : ""}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    onFile(e.dataTransfer.files?.[0]);
                }}
            >
                <FiUploadCloud aria-hidden />
                <strong>Tarik file CSV mutasi ke sini</strong>
                <span>atau klik untuk memilih file (maks. 5 MB, {MAX_ROWS.toLocaleString("id-ID")} transaksi)</span>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,text/csv"
                    onChange={(e) => {
                        onFile(e.target.files?.[0]);
                        e.target.value = "";
                    }}
                />
            </label>

            <aside className="im-help">
                <h4>Format yang dikenali otomatis</h4>
                <ul className="im-banks">
                    {["BCA", "Mandiri", "BNI", "BRI", "Jago"].map((b) => (
                        <li key={b}>{b}</li>
                    ))}
                    <li>Format umum</li>
                </ul>
                <p>
                    Unduh mutasi dari internet banking dalam format <b>CSV</b>. Baris info rekening di atas tabel dan
                    ringkasan saldo di bawahnya akan dilewati otomatis.
                </p>
                <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => saveBlob(new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }), "template-impor-dailytrack.csv")}
                >
                    <FiDownload aria-hidden /> Unduh template CSV
                </button>
            </aside>
        </div>
    );
}

// ── Langkah 2 ───────────────────────────────────────────
function MappingStep({ file, parsed, layout, mapping, setMapping, built, wallets, walletId, setWalletId, onBack, onNext, busy }) {
    const sampleRows = parsed.rows.slice(layout.dataStart, layout.dataStart + 3);
    const colOptions = layout.header.map((h, i) => {
        const sample = sampleRows.map((r) => r[i]).find(Boolean) || "";
        const name = h || `Kolom ${i + 1}`;
        return { value: String(i), label: sample ? `${name} · ${sample.slice(0, 24)}` : name };
    });
    const set = (k) => (v) => setMapping((m) => ({ ...m, [k]: Number(v) }));
    const toggleDesc = (i) =>
        setMapping((m) => ({ ...m, desc: m.desc.includes(i) ? m.desc.filter((x) => x !== i) : [...m.desc, i].sort((a, b) => a - b) }));
    const preview = built.rows.slice(0, 5);
    const totalIn = built.rows.filter((r) => r.type === "income").length;

    return (
        <div className="im-step">
            <div className="im-filebar">
                <FiFile aria-hidden />
                <div>
                    <strong>{file?.name}</strong>
                    <span>
                        {(file?.size / 1024).toFixed(1)} KB · pemisah "{parsed.delimiter === "\t" ? "tab" : parsed.delimiter}" ·{" "}
                        {parsed.rows.length} baris
                    </span>
                </div>
                <span className={`im-bank ${layout.bank.id === "generic" ? "is-generic" : ""}`}>
                    {layout.bank.id === "generic" ? "Format umum" : `Terdeteksi: ${layout.bank.name}`}
                </span>
            </div>

            <div className="im-map">
                <div className="im-map-fields">
                    <h4>Kolom</h4>
                    <DropdownMenu label="Tanggal" value={String(mapping.date)} options={colOptions} onChange={set("date")} width="100%" />

                    <div className="im-field">
                        <span className="im-label">Keterangan (boleh lebih dari satu)</span>
                        <div className="tx-chips">
                            {layout.header.map((h, i) =>
                                i === mapping.date ? null : (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`tx-chip ${mapping.desc.includes(i) ? "is-active" : ""}`}
                                        onClick={() => toggleDesc(i)}
                                    >
                                        {h || `Kolom ${i + 1}`}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>

                    <div className="im-field">
                        <span className="im-label">Cara membaca nominal</span>
                        <div className="im-seg" role="radiogroup">
                            {MODES.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={mapping.mode === m.value}
                                    className={mapping.mode === m.value ? "is-active" : ""}
                                    onClick={() =>
                                        setMapping((x) => ({
                                            ...x,
                                            mode: m.value,
                                            debit: x.debit >= 0 ? x.debit : x.amount,
                                            credit: x.credit >= 0 ? x.credit : x.amount,
                                            flag: x.flag >= 0 ? x.flag : 0,
                                        }))
                                    }
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mapping.mode === "split" ? (
                        <div className="im-pair">
                            <DropdownMenu label="Uang keluar (debet)" value={String(mapping.debit)} options={colOptions} onChange={set("debit")} width="100%" />
                            <DropdownMenu label="Uang masuk (kredit)" value={String(mapping.credit)} options={colOptions} onChange={set("credit")} width="100%" />
                        </div>
                    ) : (
                        <div className="im-pair">
                            <DropdownMenu label="Nominal" value={String(mapping.amount)} options={colOptions} onChange={set("amount")} width="100%" />
                            {mapping.mode === "flag" && (
                                <DropdownMenu label="Penanda DB/CR" value={String(mapping.flag)} options={colOptions} onChange={set("flag")} width="100%" />
                            )}
                        </div>
                    )}
                    {mapping.mode === "signed" && (
                        <p className="im-hint">Angka negatif (−54.000) dibaca sebagai pengeluaran, positif sebagai pemasukan. Akhiran DB/CR juga dikenali.</p>
                    )}

                    <h4>Masukkan ke wallet</h4>
                    {wallets.length ? (
                        <DropdownMenu
                            value={walletId}
                            options={wallets.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` }))}
                            onChange={setWalletId}
                            width="100%"
                            placeholder="Pilih wallet"
                        />
                    ) : (
                        <p className="im-hint">Belum ada wallet non-emas. Buat wallet dulu di menu Wallet.</p>
                    )}
                </div>

                <div className="im-map-preview">
                    <div className="im-count">
                        <strong>{built.rows.length.toLocaleString("id-ID")}</strong> transaksi terbaca
                        <span>
                            {totalIn} masuk · {built.rows.length - totalIn} keluar
                            {built.skipped.length > 0 && ` · ${built.skipped.length} baris dilewati`}
                        </span>
                    </div>
                    {preview.length ? (
                        <table className="im-table is-compact">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Keterangan</th>
                                    <th className="num">Nominal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((r) => (
                                    <tr key={r.index}>
                                        <td>{fmtDay(r.date)}</td>
                                        <td className="im-desc">{r.description || "—"}</td>
                                        <td className={`num ${r.type === "income" ? "is-in" : "is-out"}`}>
                                            {r.type === "income" ? "+" : "−"}
                                            {formatRupiah(r.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="im-empty">Belum ada baris yang terbaca. Coba ganti kolom tanggal atau nominal.</p>
                    )}
                    {built.skipped.length > 0 && (
                        <details className="im-skipped">
                            <summary>Lihat baris yang dilewati</summary>
                            <ul>
                                {built.skipped.slice(0, 15).map((s) => (
                                    <li key={s.line}>
                                        Baris {s.line}: {s.reason}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            </div>

            <div className="im-actions">
                <button type="button" className="btn-ghost" onClick={onBack}>
                    <FiArrowLeft aria-hidden /> Ganti file
                </button>
                <button type="button" className="btn-primary" onClick={onNext} disabled={busy || !built.rows.length || !walletId}>
                    {busy ? "Memeriksa..." : "Periksa transaksi"} <FiArrowRight aria-hidden />
                </button>
            </div>
        </div>
    );
}

// ── Langkah 3 ───────────────────────────────────────────
const FILTERS = [
    { id: "all", label: "Semua" },
    { id: "dup", label: "Kemungkinan duplikat" },
    { id: "nocat", label: "Tanpa kategori" },
    { id: "off", label: "Tidak dipilih" },
];

function ReviewStep({ items, setItems, categories, wallet, income, expense, selectedCount, applyBalance, setApplyBalance, onBack, onImport, busy }) {
    const [filter, setFilter] = useState("all");
    const [page, setPage] = useState(0);
    const dupCount = items.filter((i) => i.dup).length;
    const nocat = items.filter((i) => i.selected && !i.categoryId).length;

    const view = items.filter((i) =>
        filter === "dup" ? i.dup : filter === "nocat" ? !i.categoryId : filter === "off" ? !i.selected : true,
    );
    const pages = Math.max(1, Math.ceil(view.length / PAGE));
    const cur = Math.min(page, pages - 1);
    const shown = view.slice(cur * PAGE, cur * PAGE + PAGE);
    const catOptions = (type) => [
        { value: "", label: "Tanpa kategori" },
        ...categories.filter((c) => !c.type || c.type === type).map((c) => ({ value: String(c._id), label: c.name })),
    ];

    const patch = (index, p) => setItems((list) => list.map((i) => (i.index === index ? { ...i, ...p } : i)));
    const allShownOn = shown.length > 0 && shown.every((i) => i.selected);
    const after = (wallet?.balance || 0) + (applyBalance ? income - expense : 0);

    return (
        <div className="im-step">
            <div className="im-summary">
                <div>
                    <span>Dipilih</span>
                    <strong>
                        {selectedCount} / {items.length}
                    </strong>
                </div>
                <div>
                    <span>Uang masuk</span>
                    <strong className="is-in">{formatRupiah(income)}</strong>
                </div>
                <div>
                    <span>Uang keluar</span>
                    <strong className="is-out">{formatRupiah(expense)}</strong>
                </div>
                <div className={dupCount ? "is-warn" : ""}>
                    <span>Kemungkinan duplikat</span>
                    <strong>{dupCount}</strong>
                </div>
            </div>

            <div className="im-toolbar">
                <div className="tx-chips">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`tx-chip ${filter === f.id ? "is-active" : ""}`}
                            onClick={() => {
                                setFilter(f.id);
                                setPage(0);
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="im-bulk">
                    <button type="button" onClick={() => setItems((l) => l.map((i) => ({ ...i, selected: true })))}>
                        Pilih semua
                    </button>
                    <button type="button" onClick={() => setItems((l) => l.map((i) => (i.dup ? { ...i, selected: false } : i)))}>
                        Lewati duplikat
                    </button>
                    <button
                        type="button"
                        title="Kalau semua jenis terbaca terbalik"
                        onClick={() =>
                            setItems((l) =>
                                l.map((i) => {
                                    const type = i.type === "income" ? "expense" : "income";
                                    const keep = categories.find((c) => String(c._id) === i.categoryId && (!c.type || c.type === type));
                                    return { ...i, type, categoryId: keep ? i.categoryId : "" };
                                }),
                            )
                        }
                    >
                        <FiRepeat aria-hidden /> Balik semua jenis
                    </button>
                </div>
            </div>

            <div className="im-table-wrap">
                <table className="im-table">
                    <thead>
                        <tr>
                            <th className="im-check">
                                <input
                                    type="checkbox"
                                    aria-label="Pilih semua di halaman ini"
                                    checked={allShownOn}
                                    onChange={(e) => {
                                        const ids = new Set(shown.map((s) => s.index));
                                        setItems((l) => l.map((i) => (ids.has(i.index) ? { ...i, selected: e.target.checked } : i)));
                                    }}
                                />
                            </th>
                            <th>Tanggal</th>
                            <th>Keterangan</th>
                            <th>Jenis</th>
                            <th>Kategori</th>
                            <th className="num">Nominal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((i) => (
                            <tr key={i.index} className={`${i.selected ? "" : "is-off"} ${i.dup ? `is-dup is-${i.dup.level}` : ""}`}>
                                <td className="im-check">
                                    <input
                                        type="checkbox"
                                        aria-label={`Pilih ${i.description || "transaksi"}`}
                                        checked={i.selected}
                                        onChange={(e) => patch(i.index, { selected: e.target.checked })}
                                    />
                                </td>
                                <td className="im-date">{fmtDay(i.date)}</td>
                                <td className="im-desc">
                                    <span title={i.description}>{i.description || "—"}</span>
                                    {i.dup && (
                                        <small className="im-dup">
                                            <FiAlertTriangle aria-hidden />
                                            {i.dup.level === "file"
                                                ? "Sama dengan baris lain di file ini"
                                                : i.dup.level === "exact"
                                                  ? `Sudah tercatat: ${i.dup.match.description || "transaksi"} (${formatRupiah(i.dup.match.amount)})`
                                                  : `Mirip: ${i.dup.match.description || "transaksi"}, ${new Date(i.dup.match.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                                        </small>
                                    )}
                                </td>
                                <td className="im-type-cell">
                                    <button
                                        type="button"
                                        className={`im-type is-${i.type}`}
                                        onClick={() => patch(i.index, { type: i.type === "income" ? "expense" : "income", categoryId: "" })}
                                        title="Klik untuk mengganti jenis"
                                    >
                                        {i.type === "income" ? "Masuk" : "Keluar"}
                                    </button>
                                </td>
                                <td className="im-cat">
                                    <DropdownMenu
                                        value={i.categoryId}
                                        options={catOptions(i.type)}
                                        onChange={(v) => patch(i.index, { categoryId: v, categorySource: "manual" })}
                                        minWidth="140px"
                                        width="100%"
                                    />
                                </td>
                                <td className={`num ${i.type === "income" ? "is-in" : "is-out"}`}>
                                    {i.type === "income" ? "+" : "−"}
                                    {formatRupiah(i.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!shown.length && <p className="im-empty">Tidak ada baris untuk filter ini.</p>}
            </div>

            {pages > 1 && (
                <div className="im-pager">
                    <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0}>
                        <FiArrowLeft aria-hidden /> Sebelumnya
                    </button>
                    <span>
                        Halaman {cur + 1} dari {pages}
                    </span>
                    <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1}>
                        Berikutnya <FiArrowRight aria-hidden />
                    </button>
                </div>
            )}

            <div className="im-final">
                <Switch
                    id="im-apply-balance"
                    checked={applyBalance}
                    onChange={setApplyBalance}
                    label="Ubah saldo wallet"
                    description={
                        applyBalance
                            ? `Saldo ${wallet?.name}: ${formatRupiah(wallet?.balance || 0)} → ${formatRupiah(after)}`
                            : "Matikan kalau mutasi ini sudah tercermin di saldo sekarang (impor data lama)."
                    }
                />
                {nocat > 0 && (
                    <p className="im-hint">
                        {nocat} transaksi terpilih belum punya kategori. Tetap bisa diimpor, tapi tidak masuk hitungan budget.
                    </p>
                )}
                <div className="im-actions">
                    <button type="button" className="btn-ghost" onClick={onBack}>
                        <FiArrowLeft aria-hidden /> Kembali
                    </button>
                    <button type="button" className="btn-primary" onClick={onImport} disabled={busy || !selectedCount}>
                        {busy ? "Mengimpor..." : `Impor ${selectedCount} transaksi`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Langkah 4 ───────────────────────────────────────────
function DoneStep({ result, onUndo, onAgain, busy }) {
    return (
        <div className={`im-done ${result.undone ? "is-undone" : ""}`}>
            <span className="im-done-icon">{result.undone ? <FiRotateCcw aria-hidden /> : <FiCheck aria-hidden />}</span>
            <h3>{result.undone ? "Impor dibatalkan" : `${result.created} transaksi berhasil diimpor`}</h3>
            {result.undone ? (
                <p>Semua transaksi dari impor ini sudah dihapus{result.balanceApplied ? " dan saldo dikembalikan" : ""}.</p>
            ) : (
                <>
                    <p>
                        Masuk {formatRupiah(result.income)} · keluar {formatRupiah(result.expense)}
                        {result.balanceApplied
                            ? ` · saldo ${result.wallet.name} sekarang ${formatRupiah(result.wallet.balance)}`
                            : " · saldo wallet tidak diubah"}
                        . Semua transaksi diberi tag <b>#impor</b>.
                    </p>
                </>
            )}
            <div className="im-actions is-center">
                {!result.undone && (
                    <>
                        <Link to={`/wallets/${result.wallet.id}`} className="btn-primary">
                            Lihat histori {result.wallet.name}
                        </Link>
                        <button type="button" className="btn-ghost is-danger" onClick={onUndo} disabled={busy}>
                            <FiRotateCcw aria-hidden /> Batalkan impor
                        </button>
                    </>
                )}
                <button type="button" className="btn-ghost" onClick={onAgain}>
                    Impor file lain
                </button>
            </div>
        </div>
    );
}
