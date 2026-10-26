import { useMemo, useState } from "react";
import { FiArrowUpRight, FiArrowDownLeft, FiX } from "react-icons/fi";
import DatePicker from "../ui/DatePicker";
import DropdownMenu from "../ui/DropdownMenu";
import { formatNumberInput, parseNumberInput, formatRupiah } from "../../utils/format";
import { todayYMD } from "./utils";

const addDays = (ymd, n) => {
    const d = new Date(`${ymd}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const endOfMonth = (ymd) => {
    const d = new Date(`${ymd}T00:00:00`);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
};

/** Panel inline untuk mencatat utang atau piutang baru. */
export default function DebtForm({ wallets, people, onSubmit, onCancel, busy, defaultDirection = "owed_to_me" }) {
    const [form, setForm] = useState({
        direction: defaultDirection,
        person: "",
        amount: "",
        date: todayYMD(),
        dueDate: "",
        walletId: "",
        note: "",
    });
    const [error, setError] = useState("");
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const usable = useMemo(() => wallets.filter((w) => w.type !== "gold" && !w.isArchived), [wallets]);
    const wallet = usable.find((w) => w._id === form.walletId);
    const amount = parseNumberInput(form.amount);
    const lending = form.direction === "owed_to_me";

    const walletHint = wallet
        ? lending
            ? `Saldo ${wallet.name} berkurang ${formatRupiah(amount || 0)} karena uangnya kamu pinjamkan. Tidak dihitung sebagai pengeluaran.`
            : `Saldo ${wallet.name} bertambah ${formatRupiah(amount || 0)} dari uang pinjaman. Tidak dihitung sebagai pemasukan.`
        : "Pilih wallet kalau uangnya benar-benar berpindah sekarang. Kosongkan untuk sekadar mencatat.";

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.person.trim()) return setError("Nama orang wajib diisi.");
        if (!(amount > 0)) return setError("Nominal harus lebih dari 0.");
        if (wallet && lending && amount > (wallet.balance || 0)) return setError(`Saldo ${wallet.name} tidak cukup.`);
        const ok = await onSubmit({ ...form, amount, walletId: form.walletId || null, dueDate: form.dueDate || null });
        if (ok !== true && typeof ok === "string") setError(ok);
    };

    return (
        <form className="inline-form dbt-form" onSubmit={submit}>
            <div className="inline-form-head">
                <div>
                    <h2>Catat utang-piutang</h2>
                    <p>Pinjaman antar teman, keluarga, atau rekan kerja.</p>
                </div>
                <button type="button" className="dbt-icon-btn" onClick={onCancel} aria-label="Tutup">
                    <FiX />
                </button>
            </div>

            <div className="dbt-dir" role="radiogroup" aria-label="Jenis catatan">
                {[
                    { v: "owed_to_me", icon: FiArrowUpRight, t: "Piutang", d: "Orang lain berutang ke aku" },
                    { v: "i_owe", icon: FiArrowDownLeft, t: "Utang", d: "Aku berutang ke orang lain" },
                ].map(({ v, icon: Icon, t, d }) => (
                    <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={form.direction === v}
                        className={`dbt-dir-opt is-${v} ${form.direction === v ? "is-active" : ""}`}
                        onClick={() => set("direction", v)}
                    >
                        <span className="dbt-dir-icon">
                            <Icon aria-hidden />
                        </span>
                        <span>
                            <strong>{t}</strong>
                            <small>{d}</small>
                        </span>
                    </button>
                ))}
            </div>

            <div className="dbt-grid">
                <div className="tx-field">
                    <label htmlFor="dbt-person">{lending ? "Siapa yang berutang?" : "Berutang ke siapa?"}</label>
                    <input
                        id="dbt-person"
                        type="text"
                        list="dbt-people"
                        placeholder="Nama teman"
                        value={form.person}
                        onChange={(e) => set("person", e.target.value)}
                        maxLength={60}
                        autoFocus
                    />
                    <datalist id="dbt-people">
                        {people.map((p) => (
                            <option key={p} value={p} />
                        ))}
                    </datalist>
                </div>
                <div className="tx-field">
                    <label htmlFor="dbt-amount">Nominal</label>
                    <label className="dbt-money">
                        <span>Rp</span>
                        <input
                            id="dbt-amount"
                            inputMode="numeric"
                            placeholder="0"
                            value={form.amount}
                            onChange={(e) => set("amount", formatNumberInput(e.target.value))}
                        />
                    </label>
                </div>
                <div className="tx-field">
                    <label>Tanggal</label>
                    <DatePicker value={form.date} onChange={(v) => set("date", v || todayYMD())} clearable={false} />
                </div>
                <div className="tx-field">
                    <label>Jatuh tempo (opsional)</label>
                    <DatePicker value={form.dueDate} onChange={(v) => set("dueDate", v || "")} min={form.date} placeholder="Tanpa jatuh tempo" />
                    <div className="dbt-quick">
                        {[
                            ["1 minggu", addDays(form.date, 7)],
                            ["2 minggu", addDays(form.date, 14)],
                            ["Akhir bulan", endOfMonth(form.date)],
                        ].map(([label, v]) => (
                            <button key={label} type="button" className={`tx-chip ${form.dueDate === v ? "is-active" : ""}`} onClick={() => set("dueDate", v)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="tx-field dbt-span">
                    <label>Lewat wallet</label>
                    <DropdownMenu
                        value={form.walletId}
                        onChange={(v) => set("walletId", v)}
                        options={[
                            { value: "", label: "Tidak lewat wallet (catat saja)" },
                            ...usable.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` })),
                        ]}
                    />
                    <p className="tx-hint">{walletHint}</p>
                </div>
                <div className="tx-field dbt-span">
                    <label htmlFor="dbt-note">Keterangan</label>
                    <input
                        id="dbt-note"
                        type="text"
                        placeholder={lending ? "mis. Pinjam buat bensin" : "mis. Ditalangin makan siang"}
                        value={form.note}
                        onChange={(e) => set("note", e.target.value)}
                        maxLength={300}
                    />
                </div>
            </div>

            {error && <p className="dbt-error">{error}</p>}
            <div className="dbt-form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Batal
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                    {busy ? "Menyimpan..." : lending ? "Simpan piutang" : "Simpan utang"}
                </button>
            </div>
        </form>
    );
}
