import { useState } from "react";
import { FiArrowUpRight, FiArrowDownLeft, FiEdit2, FiTrash2, FiChevronDown, FiRotateCcw, FiUsers } from "react-icons/fi";
import DatePicker from "../ui/DatePicker";
import DropdownMenu from "../ui/DropdownMenu";
import { formatNumberInput, parseNumberInput, formatRupiah } from "../../utils/format";
import { dueLabel, fmtDate, todayYMD, toYMD, colorFor, initials } from "./utils";

/** Satu catatan utang/piutang dengan form bayar, ubah, dan riwayat yang bisa dibuka di tempat. */
export default function DebtRow({ d, wallets, onPay, onUndoPayment, onUpdate, onDelete, busy, showPerson = true }) {
    const [panel, setPanel] = useState(null); // pay | edit | history
    const toggle = (p) => setPanel((cur) => (cur === p ? null : p));
    const lending = d.direction === "owed_to_me";
    const due = dueLabel(d);
    const settled = d.status === "settled";

    return (
        <article className={`dbt-row ${settled ? "is-settled" : ""} ${d.overdue ? "is-late" : ""} ${panel ? "is-open" : ""}`}>
            <div className="dbt-row-main">
                {showPerson ? (
                    <span className="dbt-avatar" style={{ "--c": colorFor(d.personKey) }}>
                        {initials(d.person)}
                    </span>
                ) : (
                    <span className={`dbt-dir-badge is-${d.direction}`}>{lending ? <FiArrowUpRight /> : <FiArrowDownLeft />}</span>
                )}
                <div className="dbt-row-text">
                    <div className="dbt-row-title">
                        {showPerson && <strong>{d.person}</strong>}
                        <span className={`dbt-kind is-${d.direction}`}>{lending ? "Piutang" : "Utang"}</span>
                        {d.splitBill && (
                            <span className="dbt-kind is-split">
                                <FiUsers aria-hidden /> Patungan
                            </span>
                        )}
                        {!showPerson && <strong className="dbt-row-note-strong">{d.note || (lending ? "Pinjaman" : "Utang")}</strong>}
                    </div>
                    <div className="dbt-row-meta">
                        {[showPerson && d.note, fmtDate(d.date), d.wallet && `via ${d.wallet.name}`].filter(Boolean).join(" · ")}
                        {due && <span className={`dbt-due is-${due.tone}`}>{due.text}</span>}
                        {settled && <span className="dbt-due is-done">Lunas {d.settledAt ? fmtDate(d.settledAt) : ""}</span>}
                    </div>
                </div>
                <div className="dbt-row-amount">
                    <strong className={lending ? "is-in" : "is-out"}>{formatRupiah(settled ? d.amount : d.remaining)}</strong>
                    {!settled && d.paid > 0 && <small>dari {formatRupiah(d.amount)}</small>}
                    {d.paid > 0 && !settled && (
                        <span className="dbt-progress" aria-label={`${Math.round(d.progress * 100)}% terbayar`}>
                            <span style={{ width: `${Math.round(d.progress * 100)}%` }} />
                        </span>
                    )}
                </div>
                <div className="dbt-row-actions">
                    {!settled && (
                        <button type="button" className={`dbt-pay-btn ${panel === "pay" ? "is-active" : ""}`} onClick={() => toggle("pay")}>
                            {lending ? "Terima bayaran" : "Bayar"}
                        </button>
                    )}
                    <button type="button" className="dbt-icon-btn" onClick={() => toggle("edit")} aria-label="Ubah catatan" title="Ubah">
                        <FiEdit2 />
                    </button>
                    {!d.splitBill && (
                        <button type="button" className="dbt-icon-btn is-danger" onClick={() => onDelete(d)} aria-label="Hapus catatan" title="Hapus">
                            <FiTrash2 />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`dbt-icon-btn dbt-chev ${panel === "history" ? "is-up" : ""}`}
                        onClick={() => toggle("history")}
                        aria-label="Riwayat pembayaran"
                        title="Riwayat"
                    >
                        <FiChevronDown />
                    </button>
                </div>
            </div>

            {panel === "pay" && <PayPanel d={d} wallets={wallets} busy={busy} onCancel={() => setPanel(null)} onPay={onPay} />}
            {panel === "edit" && <EditPanel d={d} busy={busy} onCancel={() => setPanel(null)} onUpdate={onUpdate} />}
            {panel === "history" && <History d={d} onUndo={onUndoPayment} />}
        </article>
    );
}

function PayPanel({ d, wallets, onPay, onCancel, busy }) {
    const lending = d.direction === "owed_to_me";
    const usable = wallets.filter((w) => w.type !== "gold" && !w.isArchived);
    const [amount, setAmount] = useState(formatNumberInput(String(d.remaining)));
    const [walletId, setWalletId] = useState(d.wallet && usable.some((w) => w._id === d.wallet._id) ? d.wallet._id : "");
    const [date, setDate] = useState(todayYMD());
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const value = parseNumberInput(amount);
    const wallet = usable.find((w) => w._id === walletId);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!(value > 0)) return setError("Nominal harus lebih dari 0.");
        if (value > d.remaining) return setError(`Melebihi sisa ${formatRupiah(d.remaining)}.`);
        if (wallet && !lending && value > (wallet.balance || 0)) return setError(`Saldo ${wallet.name} tidak cukup.`);
        const res = await onPay(d, { amount: value, walletId: walletId || null, date, note });
        if (res === true) onCancel();
        else if (typeof res === "string") setError(res);
    };

    return (
        <form className="dbt-panel" onSubmit={submit}>
            <div className="dbt-panel-grid">
                <div className="tx-field">
                    <label>{lending ? "Diterima" : "Dibayar"}</label>
                    <label className="dbt-money">
                        <span>Rp</span>
                        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(formatNumberInput(e.target.value))} aria-label="Nominal pembayaran" />
                    </label>
                    <div className="dbt-quick">
                        <button type="button" className={`tx-chip ${value === d.remaining ? "is-active" : ""}`} onClick={() => setAmount(formatNumberInput(String(d.remaining)))}>
                            Lunas
                        </button>
                        {d.remaining >= 2000 && (
                            <button type="button" className="tx-chip" onClick={() => setAmount(formatNumberInput(String(Math.round(d.remaining / 2))))}>
                                Separuh
                            </button>
                        )}
                    </div>
                </div>
                <div className="tx-field">
                    <label>{lending ? "Masuk ke" : "Dibayar dari"}</label>
                    <DropdownMenu
                        value={walletId}
                        onChange={setWalletId}
                        options={[
                            { value: "", label: "Tidak lewat wallet" },
                            ...usable.map((w) => ({ value: w._id, label: `${w.name} · ${formatRupiah(w.balance || 0)}` })),
                        ]}
                    />
                </div>
                <div className="tx-field">
                    <label>Tanggal</label>
                    <DatePicker value={date} onChange={(v) => setDate(v || todayYMD())} clearable={false} />
                </div>
                <div className="tx-field">
                    <label>Catatan</label>
                    <input type="text" placeholder="Opsional" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                </div>
            </div>
            <p className="tx-hint">
                {wallet
                    ? `Saldo ${wallet.name} ${lending ? "bertambah" : "berkurang"} ${formatRupiah(value || 0)}. Tidak dihitung sebagai ${lending ? "pemasukan" : "pengeluaran"}.`
                    : lending
                      ? "Tanpa wallet, pembayaran hanya mengurangi sisa piutang. Cocok juga untuk mengikhlaskan sisa utang teman."
                      : "Tanpa wallet, pembayaran hanya mengurangi sisa utang."}
            </p>
            {error && <p className="dbt-error">{error}</p>}
            <div className="dbt-form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Batal
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                    {value === d.remaining ? "Tandai lunas" : "Simpan cicilan"}
                </button>
            </div>
        </form>
    );
}

function EditPanel({ d, onUpdate, onCancel, busy }) {
    const locked = Boolean(d.splitBill || d.wallet);
    const [person, setPerson] = useState(d.person);
    const [note, setNote] = useState(d.note);
    const [amount, setAmount] = useState(formatNumberInput(String(d.amount)));
    const [dueDate, setDueDate] = useState(toYMD(d.dueDate));
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        const payload = { person, note, dueDate: dueDate || null };
        if (!locked) payload.amount = parseNumberInput(amount);
        const res = await onUpdate(d, payload);
        if (res === true) onCancel();
        else if (typeof res === "string") setError(res);
    };

    return (
        <form className="dbt-panel" onSubmit={submit}>
            <div className="dbt-panel-grid">
                <div className="tx-field">
                    <label>Nama</label>
                    <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={60} />
                </div>
                <div className="tx-field">
                    <label>Nominal</label>
                    <label className={`dbt-money ${locked ? "is-locked" : ""}`}>
                        <span>Rp</span>
                        <input inputMode="numeric" value={amount} disabled={locked} onChange={(e) => setAmount(formatNumberInput(e.target.value))} aria-label="Nominal" />
                    </label>
                    {locked && (
                        <p className="tx-hint">{d.splitBill ? "Diatur dari patungannya." : "Sudah tercatat di wallet. Hapus lalu catat ulang untuk mengubah."}</p>
                    )}
                </div>
                <div className="tx-field">
                    <label>Jatuh tempo</label>
                    <DatePicker value={dueDate} onChange={(v) => setDueDate(v || "")} placeholder="Tanpa jatuh tempo" />
                </div>
                <div className="tx-field">
                    <label>Keterangan</label>
                    <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
                </div>
            </div>
            {error && <p className="dbt-error">{error}</p>}
            <div className="dbt-form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Batal
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                    Simpan perubahan
                </button>
            </div>
        </form>
    );
}

function History({ d, onUndo }) {
    const lending = d.direction === "owed_to_me";
    return (
        <div className="dbt-panel dbt-history">
            <ol>
                <li>
                    <span className="dbt-dot is-start" />
                    <div>
                        <strong>{lending ? `Dipinjamkan ke ${d.person}` : `Pinjam dari ${d.person}`}</strong>
                        <span>
                            {fmtDate(d.date, true)}
                            {d.wallet ? ` · via ${d.wallet.name}` : ""}
                        </span>
                    </div>
                    <em>{formatRupiah(d.amount)}</em>
                </li>
                {[...d.payments].reverse().map((p) => (
                    <li key={p._id}>
                        <span className="dbt-dot" />
                        <div>
                            <strong>{lending ? "Diterima" : "Dibayar"}</strong>
                            <span>
                                {[fmtDate(p.date, true), p.wallet ? `via ${p.wallet.name}` : "tanpa wallet", p.note].filter(Boolean).join(" · ")}
                            </span>
                        </div>
                        <em className="is-pay">−{formatRupiah(p.amount)}</em>
                        <button type="button" className="dbt-icon-btn" onClick={() => onUndo(d, p)} aria-label="Batalkan pembayaran" title="Batalkan">
                            <FiRotateCcw />
                        </button>
                    </li>
                ))}
            </ol>
            <div className="dbt-history-foot">
                <span>Sisa</span>
                <strong>{formatRupiah(d.remaining)}</strong>
            </div>
        </div>
    );
}
