import { useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiX } from "react-icons/fi";
import DatePicker from "../ui/DatePicker";
import DropdownMenu from "../ui/DropdownMenu";
import Switch from "../ui/Switch";
import { formatNumberInput, parseNumberInput, formatRupiah } from "../../utils/format";
import { todayYMD, colorFor, initials } from "./utils";

let rowSeq = 0;
const newRow = (name = "") => ({ id: ++rowSeq, name, share: "" });

/** Bagi rata — sama persis dengan perhitungan server. */
function equalShares(total, count, includeMe) {
    const n = count + (includeMe ? 1 : 0);
    if (!n || !total) return { shares: Array(count).fill(0), mine: 0 };
    const base = Math.floor(total / n);
    let rest = total - base * n;
    let mine = includeMe ? base : 0;
    if (includeMe) {
        mine += rest;
        rest = 0;
    }
    const shares = Array.from({ length: count }, () => {
        const extra = rest > 0 ? 1 : 0;
        rest -= extra;
        return base + extra;
    });
    return { shares, mine };
}

/** Panel inline untuk patungan: aku bayar dulu, bagian teman jadi piutang. */
export default function SplitForm({ wallets, categories, people, onSubmit, onCancel, busy }) {
    const [form, setForm] = useState({
        title: "",
        total: "",
        date: todayYMD(),
        dueDate: "",
        walletId: "",
        categoryId: "",
        includeMe: true,
        mode: "equal",
        note: "",
    });
    const [rows, setRows] = useState(() => [newRow(), newRow()]);
    const [error, setError] = useState("");
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const usable = useMemo(() => wallets.filter((w) => w.type !== "gold" && !w.isArchived), [wallets]);
    const expenseCats = useMemo(() => categories.filter((c) => c.type === "expense"), [categories]);
    const total = parseNumberInput(form.total);
    const named = rows.filter((r) => r.name.trim());

    const calc = useMemo(() => {
        if (form.mode === "equal") {
            const { shares, mine } = equalShares(total, rows.length, form.includeMe);
            return { shares, mine, diff: 0 };
        }
        const shares = rows.map((r) => parseNumberInput(r.share));
        const sum = shares.reduce((a, b) => a + b, 0);
        return form.includeMe ? { shares, mine: total - sum, diff: Math.min(0, total - sum) } : { shares, mine: 0, diff: total - sum };
    }, [form.mode, form.includeMe, rows, total]);

    const others = calc.shares.reduce((a, b) => a + b, 0);
    const suggestions = people.filter((p) => !rows.some((r) => r.name.trim().toLowerCase() === p.toLowerCase())).slice(0, 8);

    const updateRow = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
    const addPerson = (name = "") =>
        setRows((rs) => {
            const empty = rs.find((r) => !r.name.trim());
            if (name && empty) return rs.map((r) => (r.id === empty.id ? { ...r, name } : r));
            return [...rs, newRow(name)];
        });

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.title.trim()) return setError("Beri nama patungannya, mis. Makan malam tim.");
        if (!(total > 0)) return setError("Total tagihan harus lebih dari 0.");
        if (!named.length) return setError("Tambahkan minimal satu teman.");
        if (named.length !== rows.length) return setError("Isi nama setiap peserta atau hapus baris yang kosong.");
        if (form.mode === "custom" && calc.diff !== 0)
            return setError(
                calc.diff < 0
                    ? `Bagian teman melebihi total ${formatRupiah(-calc.diff)}.`
                    : `Masih kurang ${formatRupiah(calc.diff)} supaya sama dengan total.`,
            );
        const wallet = usable.find((w) => w._id === form.walletId);
        if (wallet && total > (wallet.balance || 0)) return setError(`Saldo ${wallet.name} tidak cukup untuk membayar ${formatRupiah(total)}.`);
        const ok = await onSubmit({
            ...form,
            total,
            walletId: form.walletId || null,
            categoryId: form.categoryId || null,
            dueDate: form.dueDate || null,
            participants: rows.map((r, i) => ({ name: r.name.trim(), share: calc.shares[i] })),
        });
        if (typeof ok === "string") setError(ok);
    };

    return (
        <form className="inline-form dbt-form" onSubmit={submit}>
            <div className="inline-form-head">
                <div>
                    <h2>Patungan baru</h2>
                    <p>Kamu bayar tagihannya dulu. Bagian tiap teman otomatis jadi piutang.</p>
                </div>
                <button type="button" className="dbt-icon-btn" onClick={onCancel} aria-label="Tutup">
                    <FiX />
                </button>
            </div>

            <div className="dbt-split-layout">
                <div className="dbt-grid">
                    <div className="tx-field dbt-span">
                        <label htmlFor="sp-title">Nama patungan</label>
                        <input
                            id="sp-title"
                            type="text"
                            placeholder="mis. Makan malam tim, Villa Puncak"
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            maxLength={80}
                            autoFocus
                        />
                    </div>
                    <div className="tx-field">
                        <label htmlFor="sp-total">Total tagihan</label>
                        <label className="dbt-money">
                            <span>Rp</span>
                            <input id="sp-total" inputMode="numeric" placeholder="0" value={form.total} onChange={(e) => set("total", formatNumberInput(e.target.value))} />
                        </label>
                    </div>
                    <div className="tx-field">
                        <label>Tanggal</label>
                        <DatePicker value={form.date} onChange={(v) => set("date", v || todayYMD())} clearable={false} />
                    </div>
                    <div className="tx-field">
                        <label>Dibayar dari</label>
                        <DropdownMenu
                            value={form.walletId}
                            onChange={(v) => set("walletId", v)}
                            options={[
                                { value: "", label: "Tidak lewat wallet" },
                                ...usable.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` })),
                            ]}
                        />
                    </div>
                    <div className="tx-field">
                        <label>Kategori bagianku</label>
                        <DropdownMenu
                            value={form.categoryId}
                            onChange={(v) => set("categoryId", v)}
                            options={[{ value: "", label: "Tanpa kategori" }, ...expenseCats.map((c) => ({ value: c._id, label: c.name }))]}
                        />
                    </div>
                    <div className="dbt-span">
                        <Switch
                            id="sp-me"
                            checked={form.includeMe}
                            onChange={(v) => set("includeMe", v)}
                            label="Aku ikut menanggung"
                            description="Matikan kalau kamu cuma menalangi dan tidak ikut menikmati."
                        />
                    </div>

                    <div className="dbt-span dbt-people-head">
                        <span className="dbt-label">Teman yang ikut</span>
                        <div className="tx-chips">
                            {[
                                ["equal", "Bagi rata"],
                                ["custom", "Atur nominal"],
                            ].map(([v, l]) => (
                                <button key={v} type="button" className={`tx-chip ${form.mode === v ? "is-active" : ""}`} onClick={() => set("mode", v)}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ul className="dbt-span dbt-people">
                        {rows.map((r, i) => (
                            <li key={r.id}>
                                <span className="dbt-avatar sm" style={{ "--c": colorFor(r.name.trim().toLowerCase()) }}>
                                    {initials(r.name)}
                                </span>
                                <input
                                    type="text"
                                    list="dbt-people-split"
                                    placeholder={`Nama teman ${i + 1}`}
                                    value={r.name}
                                    onChange={(e) => updateRow(r.id, "name", e.target.value)}
                                    maxLength={60}
                                    aria-label={`Nama teman ${i + 1}`}
                                />
                                {form.mode === "custom" ? (
                                    <label className="dbt-money sm">
                                        <span>Rp</span>
                                        <input
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={r.share}
                                            onChange={(e) => updateRow(r.id, "share", formatNumberInput(e.target.value))}
                                            aria-label={`Bagian teman ${i + 1}`}
                                        />
                                    </label>
                                ) : (
                                    <span className="dbt-share">{formatRupiah(calc.shares[i] || 0)}</span>
                                )}
                                <button
                                    type="button"
                                    className="dbt-icon-btn"
                                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                                    disabled={rows.length <= 1}
                                    aria-label="Hapus peserta"
                                >
                                    <FiTrash2 />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <datalist id="dbt-people-split">
                        {people.map((p) => (
                            <option key={p} value={p} />
                        ))}
                    </datalist>
                    <div className="dbt-span dbt-add-row">
                        <button type="button" className="dbt-add" onClick={() => addPerson()}>
                            <FiPlus aria-hidden /> Tambah teman
                        </button>
                        {suggestions.map((p) => (
                            <button key={p} type="button" className="dbt-suggest" onClick={() => addPerson(p)}>
                                + {p}
                            </button>
                        ))}
                    </div>

                    <div className="tx-field">
                        <label>Tagih paling lambat (opsional)</label>
                        <DatePicker value={form.dueDate} onChange={(v) => set("dueDate", v || "")} min={form.date} placeholder="Tanpa jatuh tempo" />
                    </div>
                    <div className="tx-field">
                        <label htmlFor="sp-note">Catatan</label>
                        <input id="sp-note" type="text" placeholder="Opsional" value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={300} />
                    </div>
                </div>

                <aside className="dbt-split-sum" aria-live="polite">
                    <span className="dbt-label">Ringkasan</span>
                    <div className="dbt-sum-total">{formatRupiah(total || 0)}</div>
                    <dl>
                        <div>
                            <dt>Bagianku</dt>
                            <dd>{formatRupiah(Math.max(0, calc.mine))}</dd>
                        </div>
                        <div>
                            <dt>Ditagih ke {rows.length} teman</dt>
                            <dd className="is-in">{formatRupiah(others)}</dd>
                        </div>
                        {form.mode === "custom" && calc.diff !== 0 && (
                            <div className="is-warn">
                                <dt>{calc.diff > 0 ? "Belum terbagi" : "Kelebihan"}</dt>
                                <dd>{formatRupiah(Math.abs(calc.diff))}</dd>
                            </div>
                        )}
                    </dl>
                    <p>
                        {form.walletId
                            ? "Saldo wallet berkurang sebesar total. Hanya bagianmu yang dihitung sebagai pengeluaran; sisanya jadi piutang."
                            : "Tanpa wallet, patungan hanya dicatat sebagai piutang tanpa mengubah saldo."}
                    </p>
                </aside>
            </div>

            {error && <p className="dbt-error">{error}</p>}
            <div className="dbt-form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Batal
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                    {busy ? "Menyimpan..." : "Buat patungan"}
                </button>
            </div>
        </form>
    );
}
