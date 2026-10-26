import { useState } from "react";
import { FiFileText, FiPrinter, FiDatabase, FiDownload, FiCheck, FiAlertCircle } from "react-icons/fi";
import { useFinance } from "../../context/FinanceContext";
import { exportTransactionsCsvAPI, exportBackupAPI } from "../../services/dataApi";
import { MONTHS } from "../../utils/format";
import DatePicker from "../ui/DatePicker";
import DropdownMenu from "../ui/DropdownMenu";
import MonthlyReport from "./MonthlyReport";
import { saveBlob, errorMessage, toKey, compactKey } from "./download";

const TYPE_OPTIONS = [
    { value: "", label: "Semua jenis" },
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
];

function presetRange(id) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (id === "bulan-ini") return [toKey(new Date(y, m, 1)), toKey(now)];
    if (id === "bulan-lalu") return [toKey(new Date(y, m - 1, 1)), toKey(new Date(y, m, 0))];
    if (id === "3-bulan") return [toKey(new Date(y, m - 2, 1)), toKey(now)];
    if (id === "tahun-ini") return [toKey(new Date(y, 0, 1)), toKey(now)];
    return ["", ""];
}

const PRESETS = [
    { id: "bulan-ini", label: "Bulan ini" },
    { id: "bulan-lalu", label: "Bulan lalu" },
    { id: "3-bulan", label: "3 bulan" },
    { id: "tahun-ini", label: "Tahun ini" },
    { id: "semua", label: "Semua" },
];

function Status({ state }) {
    if (!state) return null;
    return (
        <p className={`ex-status is-${state.type}`} role={state.type === "error" ? "alert" : "status"}>
            {state.type === "error" ? <FiAlertCircle aria-hidden /> : <FiCheck aria-hidden />} {state.text}
        </p>
    );
}

export default function ExportPanel() {
    const { wallets, availableYears } = useFinance();
    const now = new Date();

    // CSV
    const [preset, setPreset] = useState("bulan-ini");
    const [[from, to], setRange] = useState(() => presetRange("bulan-ini"));
    const [walletId, setWalletId] = useState("");
    const [type, setType] = useState("");
    const [csvBusy, setCsvBusy] = useState(false);
    const [csvState, setCsvState] = useState(null);

    // Laporan
    const [rMonth, setRMonth] = useState(String(now.getMonth() + 1));
    const [rYear, setRYear] = useState(String(now.getFullYear()));
    const [report, setReport] = useState(null);

    // Cadangan
    const [bkBusy, setBkBusy] = useState(false);
    const [bkState, setBkState] = useState(null);

    const choosePreset = (id) => {
        setPreset(id);
        setRange(presetRange(id));
    };

    const downloadCsv = async () => {
        if (from && to && from > to) {
            setCsvState({ type: "error", text: "Tanggal awal harus sebelum tanggal akhir." });
            return;
        }
        setCsvBusy(true);
        setCsvState(null);
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            if (walletId) params.walletId = walletId;
            if (type) params.type = type;
            const res = await exportTransactionsCsvAPI(params);
            const text = await res.data.text();
            const count = Math.max(0, text.split("\r\n").filter(Boolean).length - 1);
            const name = `dailytrack-transaksi${from ? `-${compactKey(from)}` : ""}${to ? `-${compactKey(to)}` : ""}.csv`;
            saveBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), name);
            setCsvState(
                count
                    ? { type: "ok", text: `${count.toLocaleString("id-ID")} transaksi diunduh sebagai ${name}` }
                    : { type: "ok", text: "File diunduh, tapi tidak ada transaksi di rentang ini." },
            );
        } catch (err) {
            setCsvState({ type: "error", text: await errorMessage(err, "Gagal mengunduh CSV.") });
        } finally {
            setCsvBusy(false);
        }
    };

    const downloadBackup = async () => {
        setBkBusy(true);
        setBkState(null);
        try {
            const res = await exportBackupAPI();
            const text = await res.data.text();
            let counts = null;
            try {
                counts = JSON.parse(text).counts;
            } catch {
                /* tetap simpan */
            }
            saveBlob(new Blob([text], { type: "application/json" }), `dailytrack-cadangan-${compactKey(toKey(new Date()))}.json`);
            setBkState({
                type: "ok",
                text: counts
                    ? `Tersimpan: ${counts.transactions} transaksi, ${counts.wallets} wallet, ${counts.budgets} budget, ${counts.goals} goal.`
                    : "Cadangan tersimpan.",
            });
        } catch (err) {
            setBkState({ type: "error", text: await errorMessage(err, "Gagal membuat cadangan.") });
        } finally {
            setBkBusy(false);
        }
    };

    const years = (availableYears?.length ? availableYears : [now.getFullYear()]).map((y) => ({ value: String(y), label: String(y) }));

    return (
        <>
            <div className="ex-grid">
                <section className="ex-card">
                    <header>
                        <span className="ex-icon">
                            <FiFileText aria-hidden />
                        </span>
                        <div>
                            <h3>Transaksi ke CSV</h3>
                            <p>Bisa langsung dibuka di Excel atau Google Sheets.</p>
                        </div>
                    </header>

                    <div className="tx-chips" role="group" aria-label="Rentang cepat">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className={`tx-chip ${preset === p.id ? "is-active" : ""}`}
                                onClick={() => choosePreset(p.id)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="ex-row">
                        <label className="ex-field">
                            <span>Dari</span>
                            <DatePicker
                                value={from}
                                onChange={(v) => {
                                    setRange([v || "", to]);
                                    setPreset("");
                                }}
                                placeholder="Awal"
                                max={to || undefined}
                            />
                        </label>
                        <label className="ex-field">
                            <span>Sampai</span>
                            <DatePicker
                                value={to}
                                onChange={(v) => {
                                    setRange([from, v || ""]);
                                    setPreset("");
                                }}
                                placeholder="Akhir"
                                min={from || undefined}
                            />
                        </label>
                    </div>
                    <div className="ex-row">
                        <DropdownMenu
                            label="Wallet"
                            value={walletId}
                            options={[{ value: "", label: "Semua wallet" }, ...wallets.map((w) => ({ value: w._id, label: w.name }))]}
                            onChange={setWalletId}
                            width="100%"
                        />
                        <DropdownMenu label="Jenis" value={type} options={TYPE_OPTIONS} onChange={setType} width="100%" />
                    </div>
                    <p className="ex-hint">Kolom: Tanggal, Jam, Jenis, Kategori, Wallet, Wallet tujuan, Nominal, Biaya, Catatan, Tag, Mood.</p>
                    <button type="button" className="btn-primary ex-action" onClick={downloadCsv} disabled={csvBusy}>
                        <FiDownload aria-hidden /> {csvBusy ? "Menyiapkan..." : "Unduh CSV"}
                    </button>
                    <Status state={csvState} />
                </section>

                <section className="ex-card">
                    <header>
                        <span className="ex-icon is-brass">
                            <FiPrinter aria-hidden />
                        </span>
                        <div>
                            <h3>Laporan bulanan</h3>
                            <p>Ringkasan rapi untuk dicetak atau disimpan sebagai PDF.</p>
                        </div>
                    </header>
                    <div className="ex-row">
                        <DropdownMenu
                            label="Bulan"
                            value={rMonth}
                            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                            onChange={setRMonth}
                            width="100%"
                        />
                        <DropdownMenu label="Tahun" value={rYear} options={years} onChange={setRYear} width="100%" />
                    </div>
                    <ul className="ex-list">
                        <li>Ringkasan pemasukan, pengeluaran, sisa, dan rasio tabungan</li>
                        <li>Pengeluaran per kategori dibanding bulan sebelumnya</li>
                        <li>Status budget dan goals, serta 10 pengeluaran terbesar</li>
                    </ul>
                    <button
                        type="button"
                        className="btn-primary ex-action"
                        onClick={() => setReport({ month: Number(rMonth), year: Number(rYear), key: Date.now() })}
                    >
                        <FiFileText aria-hidden /> Buka laporan
                    </button>
                </section>

                <section className="ex-card">
                    <header>
                        <span className="ex-icon">
                            <FiDatabase aria-hidden />
                        </span>
                        <div>
                            <h3>Cadangan lengkap</h3>
                            <p>Semua datamu dalam satu file JSON.</p>
                        </div>
                    </header>
                    <ul className="ex-list">
                        <li>Wallet, kategori, dan semua transaksi</li>
                        <li>Budget, goals, dan tagihan rutin</li>
                        <li>Utang-piutang dan patungan</li>
                    </ul>
                    <p className="ex-hint">Simpan di tempat aman. File ini berisi seluruh catatan keuanganmu.</p>
                    <button type="button" className="btn-ghost ex-action" onClick={downloadBackup} disabled={bkBusy}>
                        <FiDownload aria-hidden /> {bkBusy ? "Menyiapkan..." : "Unduh cadangan"}
                    </button>
                    <Status state={bkState} />
                </section>
            </div>

            {report && (
                <MonthlyReport key={report.key} month={report.month} year={report.year} onClose={() => setReport(null)} />
            )}
        </>
    );
}
