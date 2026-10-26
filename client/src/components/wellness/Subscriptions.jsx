import { useState } from "react";
import { FiRepeat, FiEyeOff, FiRotateCcw, FiArrowUpRight, FiArrowDownRight, FiClock, FiAlertCircle } from "react-icons/fi";
import { rp, rpShort, dueLabel, serviceStyle } from "./helpers";

const RECURRABLE = new Set(["weekly", "monthly", "yearly"]);

function Mark({ it }) {
    const s = serviceStyle(it);
    return (
        <span className={`wl-mark-tile ${s.color ? "is-brand" : ""}`} style={s.color ? { "--brand": s.color } : undefined} aria-hidden>
            {s.label}
        </span>
    );
}

function Spark({ history }) {
    if (!history?.length) return null;
    const max = Math.max(...history.map((h) => h.amount));
    return (
        <span className="wl-spark" aria-hidden>
            {history.slice(-6).map((h) => (
                <i key={h.dateKey} style={{ height: `${Math.max(18, (h.amount / max) * 100)}%` }} title={`${h.dateKey}: ${rp(h.amount)}`} />
            ))}
        </span>
    );
}

function Row({ it, onRecurring, onIgnore, onRestore, busy }) {
    const pc = it.priceChange;
    const canRecur = !it.hasRecurring && RECURRABLE.has(it.frequency) && onRecurring;
    return (
        <li className={`wl-sub is-${it.status}`}>
            <Mark it={it} />
            <div className="wl-sub-main">
                <div className="wl-sub-name">
                    <strong>{it.name}</strong>
                    <span className="wl-chip">{it.frequencyLabel}</span>
                    {it.hasRecurring && (
                        <span className="wl-chip is-accent" title="Sudah tercatat otomatis sebagai tagihan rutin">
                            <FiRepeat aria-hidden /> Rutin
                        </span>
                    )}
                    {it.single && <span className="wl-chip is-muted">Baru terlihat sekali</span>}
                    {it.variable && <span className="wl-chip is-muted">Nominal berubah-ubah</span>}
                    {pc && (
                        <span className={`wl-chip ${pc.pct > 0 ? "is-up" : "is-down"}`} title={`${rp(pc.from)} → ${rp(pc.to)}`}>
                            {pc.pct > 0 ? <FiArrowUpRight aria-hidden /> : <FiArrowDownRight aria-hidden />}
                            {pc.pct > 0 ? "Naik" : "Turun"} {Math.abs(Math.round(pc.pct))}%
                        </span>
                    )}
                </div>
                <div className={`wl-sub-meta ${it.status === "due" ? "is-due" : ""}`}>
                    {it.status === "due" ? <FiAlertCircle aria-hidden /> : <FiClock aria-hidden />}
                    {dueLabel(it)}
                    {it.kind && <span className="wl-dot">{it.kind}</span>}
                </div>
            </div>
            <Spark history={it.history} />
            <div className="wl-sub-amount">
                <strong>{rp(it.amount)}</strong>
                {it.frequency !== "monthly" && <span>≈ {rpShort(it.monthly)}/bln</span>}
                {it.frequency === "monthly" && <span>{rpShort(it.yearly)}/thn</span>}
            </div>
            <div className="wl-sub-actions">
                {canRecur && (
                    <button type="button" onClick={() => onRecurring(it)} disabled={busy === it.key} title="Catat otomatis setiap periode">
                        <FiRepeat aria-hidden /> Jadikan rutin
                    </button>
                )}
                {onIgnore && (
                    <button type="button" className="is-quiet" onClick={() => onIgnore(it)} disabled={busy === it.key} title="Bukan langganan">
                        <FiEyeOff aria-hidden /> Abaikan
                    </button>
                )}
                {onRestore && (
                    <button type="button" onClick={() => onRestore(it)} disabled={busy === it.key}>
                        <FiRotateCcw aria-hidden /> Pulihkan
                    </button>
                )}
            </div>
        </li>
    );
}

/** Daftar langganan & tagihan rutin hasil deteksi. */
export default function Subscriptions({ data, onRecurring, onIgnore, onRestore, busy }) {
    const [showIgnored, setShowIgnored] = useState(false);
    const { items, stale, ignored, totals } = data;
    const optional = items.filter((it) => !it.essential);
    const essential = items.filter((it) => it.essential);

    return (
        <div className="wl-subs">
            <div className="wl-sub-stats">
                <div className="wl-stat is-main">
                    <span>Per bulan</span>
                    <strong>{rp(totals.monthly)}</strong>
                    <small>
                        {rpShort(totals.optionalMonthly)} langganan · {rpShort(totals.essentialMonthly)} tagihan pokok
                    </small>
                </div>
                <div className="wl-stat">
                    <span>Per tahun</span>
                    <strong>{rp(totals.yearly)}</strong>
                    <small>{totals.count} langganan & tagihan aktif</small>
                </div>
                <div className="wl-stat">
                    <span>Jatuh tempo 7 hari</span>
                    <strong>{totals.dueSoon}</strong>
                    <small>termasuk yang lewat & belum tercatat</small>
                </div>
                <div className={`wl-stat ${totals.priceChanges ? "is-warn" : ""}`}>
                    <span>Harga naik</span>
                    <strong>{totals.priceChanges}</strong>
                    <small>{totals.priceChanges ? "cek apakah masih sepadan" : "tidak ada kenaikan"}</small>
                </div>
            </div>

            {items.length === 0 && stale.length === 0 ? (
                <div className="wl-card wl-empty">
                    <FiRepeat aria-hidden />
                    <div>
                        <strong>Belum ada langganan terdeteksi</strong>
                        <span>
                            Pengeluaran yang berulang setiap minggu, bulan, atau tahun akan muncul di sini setelah tercatat
                            2–3 kali. Tulis nama layanannya di keterangan, misalnya "Netflix".
                        </span>
                    </div>
                </div>
            ) : (
                <div className="wl-card wl-sub-card">
                    {optional.length > 0 && (
                        <section>
                            <header className="wl-sub-group">
                                <h4>Langganan</h4>
                                <span>{rp(totals.optionalMonthly)}/bulan</span>
                            </header>
                            <ul>
                                {optional.map((it) => (
                                    <Row key={it.key} it={it} onRecurring={onRecurring} onIgnore={onIgnore} busy={busy} />
                                ))}
                            </ul>
                        </section>
                    )}
                    {essential.length > 0 && (
                        <section>
                            <header className="wl-sub-group">
                                <h4>Tagihan pokok</h4>
                                <span>{rp(totals.essentialMonthly)}/bulan</span>
                            </header>
                            <ul>
                                {essential.map((it) => (
                                    <Row key={it.key} it={it} onRecurring={onRecurring} onIgnore={onIgnore} busy={busy} />
                                ))}
                            </ul>
                        </section>
                    )}
                    {stale.length > 0 && (
                        <section>
                            <header className="wl-sub-group">
                                <h4>Mungkin sudah berhenti</h4>
                                <span>Tidak muncul lagi sesuai jadwalnya</span>
                            </header>
                            <ul>
                                {stale.map((it) => (
                                    <Row key={it.key} it={it} onIgnore={onIgnore} busy={busy} />
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}

            {ignored.length > 0 && (
                <div className="wl-ignored">
                    <button type="button" className="wl-link" onClick={() => setShowIgnored((v) => !v)}>
                        {showIgnored ? "Sembunyikan" : "Tampilkan"} yang diabaikan ({ignored.length})
                    </button>
                    {showIgnored && (
                        <ul className="wl-card wl-sub-card">
                            {ignored.map((it) => (
                                <Row key={it.key} it={it} onRestore={onRestore} busy={busy} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
