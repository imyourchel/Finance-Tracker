import { FiCopy, FiCheck, FiAlertTriangle } from "react-icons/fi";
import { useState } from "react";
import { formatRupiah } from "../../utils/format";
import { buildReminder, copyText, colorFor, initials, dueLabel } from "./utils";

/** Ringkasan per orang: posisi bersih, catatan terbuka, dan pesan tagihan. */
export default function PersonCard({ p, items, onOpen }) {
    const [copied, setCopied] = useState(false);
    const first = p.name.split(" ")[0];
    const owed = items.filter((d) => d.direction === "owed_to_me");
    const statement =
        p.net > 0
            ? `${first} berutang ${formatRupiah(p.net)} ke kamu`
            : p.net < 0
              ? `Kamu berutang ${formatRupiah(-p.net)} ke ${first}`
              : "Saling lunas kalau digabung";

    const copy = async () => {
        if (await copyText(buildReminder(p.name, owed))) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        }
    };

    return (
        <article className={`dbt-person ${p.net > 0 ? "is-in" : p.net < 0 ? "is-out" : ""} ${p.overdue ? "is-late" : ""}`}>
            <header>
                <span className="dbt-avatar lg" style={{ "--c": colorFor(p.key) }}>
                    {initials(p.name)}
                </span>
                <div>
                    <h3>{p.name}</h3>
                    <span className="dbt-person-statement">{statement}</span>
                </div>
                {p.overdue > 0 && (
                    <span className="dbt-late-pill" title="Ada yang lewat jatuh tempo">
                        <FiAlertTriangle aria-hidden /> {p.overdue}
                    </span>
                )}
            </header>

            {(p.owedToMe > 0 && p.iOwe > 0) && (
                <div className="dbt-person-split">
                    <span>
                        Dia berutang <strong className="is-in">{formatRupiah(p.owedToMe)}</strong>
                    </span>
                    <span>
                        Kamu berutang <strong className="is-out">{formatRupiah(p.iOwe)}</strong>
                    </span>
                </div>
            )}

            <ul>
                {items.slice(0, 4).map((d) => {
                    const due = dueLabel(d);
                    return (
                        <li key={d._id}>
                            <span className={`dbt-mini-dir is-${d.direction}`} />
                            <span className="dbt-person-item">{d.note || (d.direction === "owed_to_me" ? "Pinjaman" : "Utang")}</span>
                            {due && <span className={`dbt-due is-${due.tone}`}>{due.text}</span>}
                            <strong>{formatRupiah(d.remaining)}</strong>
                        </li>
                    );
                })}
                {items.length > 4 && <li className="dbt-more">+{items.length - 4} catatan lain</li>}
            </ul>

            <footer>
                {owed.length > 0 && (
                    <button type="button" className={`dbt-copy ${copied ? "is-done" : ""}`} onClick={copy}>
                        {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                        {copied ? "Pesan disalin" : "Salin pesan tagihan"}
                    </button>
                )}
                <button type="button" className="dbt-link" onClick={onOpen}>
                    Kelola catatan
                </button>
            </footer>
        </article>
    );
}
