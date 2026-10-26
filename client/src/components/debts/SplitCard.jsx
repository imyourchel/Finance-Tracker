import { useState } from "react";
import { FiCheck, FiCopy, FiTrash2, FiUsers } from "react-icons/fi";
import { formatRupiah } from "../../utils/format";
import { buildReminder, copyText, fmtDate, colorFor, initials } from "./utils";

/** Kartu patungan dengan checklist siapa yang sudah bayar. */
export default function SplitCard({ s, debtsById, onToggle, onDelete, busyId }) {
    const [copied, setCopied] = useState(null);
    const pct = s.others ? Math.round((s.collected / s.others) * 100) : 100;
    const unpaid = s.participants.filter((p) => p.status !== "settled" && p.debtId);

    const copy = async (key, text) => {
        if (await copyText(text)) {
            setCopied(key);
            setTimeout(() => setCopied(null), 1800);
        }
    };

    const groupText = () =>
        [
            `Halo semua 👋 Rekap patungan ${s.title} (${fmtDate(s.date)}):`,
            ...s.participants.map(
                (p) => `${p.status === "settled" ? "✅" : "⏳"} ${p.name}: ${formatRupiah(p.share).replace(/\s/g, "")}${p.status === "settled" ? " (lunas)" : ""}`,
            ),
            unpaid.length ? "Yang belum, boleh transfer kapan sempat ya. Makasih! 🙏" : "Semua sudah lunas. Makasih semuanya! 🙌",
        ].join("\n");

    return (
        <article className={`dbt-split ${s.done ? "is-done" : ""}`}>
            <header>
                <span className="dbt-split-icon">
                    <FiUsers aria-hidden />
                </span>
                <div>
                    <h3>{s.title}</h3>
                    <span>
                        {[fmtDate(s.date), s.wallet ? `dibayar dari ${s.wallet.name}` : null, s.includeMe ? `bagianku ${formatRupiah(s.myShare)}` : "aku menalangi"]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                </div>
                <strong>{formatRupiah(s.total)}</strong>
            </header>

            <div className="dbt-split-progress">
                <div className="dbt-progress lg">
                    <span style={{ width: `${pct}%` }} />
                </div>
                <span>
                    {s.done ? "Semua sudah lunas" : `Terkumpul ${formatRupiah(s.collected)} dari ${formatRupiah(s.others)}`}
                </span>
            </div>

            <ul className="dbt-checklist">
                {s.participants.map((p) => {
                    const done = p.status === "settled";
                    const debt = p.debtId ? debtsById[p.debtId] : null;
                    return (
                        <li key={p._id} className={done ? "is-done" : ""}>
                            <button
                                type="button"
                                className="dbt-check"
                                role="checkbox"
                                aria-checked={done}
                                aria-label={`${p.name} ${done ? "sudah bayar" : "belum bayar"}`}
                                disabled={!debt || busyId === p.debtId}
                                onClick={() => onToggle(s, p, debt)}
                            >
                                {done && <FiCheck />}
                            </button>
                            <span className="dbt-avatar sm" style={{ "--c": colorFor(p.name.toLowerCase()) }}>
                                {initials(p.name)}
                            </span>
                            <span className="dbt-check-name">{p.name}</span>
                            <span className="dbt-check-amount">
                                {done ? formatRupiah(p.share) : p.paid > 0 ? `sisa ${formatRupiah(p.remaining)}` : formatRupiah(p.share)}
                            </span>
                            {!done && debt && (
                                <button
                                    type="button"
                                    className="dbt-icon-btn"
                                    title="Salin pesan tagihan"
                                    aria-label={`Salin pesan tagihan untuk ${p.name}`}
                                    onClick={() => copy(p._id, buildReminder(p.name, [debt]))}
                                >
                                    {copied === p._id ? <FiCheck /> : <FiCopy />}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            <footer>
                <button type="button" className={`dbt-copy ${copied === "group" ? "is-done" : ""}`} onClick={() => copy("group", groupText())}>
                    {copied === "group" ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                    {copied === "group" ? "Rekap disalin" : "Salin rekap untuk grup"}
                </button>
                <button type="button" className="dbt-icon-btn is-danger" onClick={() => onDelete(s)} aria-label="Hapus patungan" title="Hapus patungan">
                    <FiTrash2 />
                </button>
            </footer>
        </article>
    );
}
