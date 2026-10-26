/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { FiCheck, FiLock } from "react-icons/fi";
import { PiFlameFill, PiShieldCheckFill, PiShieldFill } from "react-icons/pi";
import { formatRupiah } from "../../utils/format";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

/** Jam sekarang yang diperbarui berkala (untuk hitung mundur). */
export function useNow(intervalMs = 60000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

export function timeLeft(iso, now) {
    const ms = Math.max(0, new Date(iso).getTime() - now);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 48) return `${Math.floor(h / 24)} hari`;
    if (h >= 1) return `${h} j ${m} m`;
    return `${m} m`;
}

/** Cincin progres kecil. */
export function Ring({ value = 0, size = 38, stroke = 4, done = false, children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <span className={`gm-ring ${done ? "is-done" : ""}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden>
                <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="gm-ring-track" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    strokeWidth={stroke}
                    className="gm-ring-fill"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
                />
            </svg>
            <span className="gm-ring-inner">{children}</span>
        </span>
    );
}

/** Satu baris misi. `compact` untuk kartu dashboard. */
export function QuestItem({ q, onClaim, busy, compact = false }) {
    const progressText = compact
        ? q.target > 1 && !q.claimed
            ? `${fmt(Math.min(q.current, q.target))}/${fmt(q.target)} ${q.unit}`
            : null
        : q.moneyCompare
        ? `${formatRupiah(q.moneyCompare.current)} dari batas ${formatRupiah(q.moneyCompare.limit)}`
        : q.target > 1
          ? `${fmt(Math.min(q.current, q.target))} / ${fmt(q.target)} ${q.unit}`
          : null;

    return (
        <li
            className={`gm-quest ${q.claimed ? "is-claimed" : ""} ${q.claimable ? "is-claimable" : ""}`}
            title={compact ? [q.description, q.lockedUntil].filter(Boolean).join(" ") : undefined}
        >
            <Ring value={q.claimed ? 1 : q.progress} done={q.claimed || q.claimable} size={compact ? 30 : 38} stroke={compact ? 3.5 : 4}>
                {q.claimed || q.claimable ? <FiCheck /> : q.lockedUntil && q.progress >= 1 ? <FiLock /> : null}
            </Ring>
            <div className="gm-quest-text">
                <strong>{q.title}</strong>
                {!compact && <span className="gm-quest-desc">{q.description}</span>}
                {(progressText || (!compact && q.lockedUntil && !q.claimed)) && (
                    <span className="gm-quest-meta">
                        {[progressText, !compact && !q.claimed && q.lockedUntil].filter(Boolean).join(" · ")}
                    </span>
                )}
            </div>
            {q.claimable ? (
                <button type="button" className="gm-claim" onClick={() => onClaim(q.id)} disabled={busy === q.id}>
                    {busy === q.id ? "..." : `Klaim +${q.xp}`}
                </button>
            ) : (
                <span className={`gm-xp ${q.claimed ? "is-claimed" : ""}`}>
                    {q.claimed ? "Diklaim" : `+${q.xp} XP`}
                </span>
            )}
        </li>
    );
}

/** Api streak + perisai. */
export function StreakFlame({ streak, size = "md" }) {
    if (!streak) return null;
    const cold = streak.current === 0;
    return (
        <div className={`gm-flame is-${size} ${cold ? "is-cold" : ""} ${streak.atRisk ? "is-risk" : ""}`}>
            <span className="gm-flame-icon" aria-hidden>
                <PiFlameFill />
            </span>
            <div className="gm-flame-text">
                <strong>{fmt(streak.current)}</strong>
                <span>hari streak</span>
            </div>
            <div className="gm-shields" title="Perisai streak menyelamatkan streak saat kamu lupa mencatat sehari">
                {Array.from({ length: streak.maxShields }).map((_, i) =>
                    i < streak.shields ? (
                        <PiShieldCheckFill key={i} className="is-on" aria-label="Perisai siap" />
                    ) : (
                        <PiShieldFill key={i} aria-label="Perisai kosong" />
                    ),
                )}
            </div>
        </div>
    );
}

export function streakHint(streak) {
    if (!streak) return "";
    if (streak.current === 0) return "Catat satu transaksi untuk menyalakan streak.";
    if (streak.atRisk)
        return streak.shields > 0
            ? "Belum mencatat hari ini. Perisai akan menyelamatkan streak kalau terlewat."
            : "Belum mencatat hari ini. Catat sebelum tengah malam supaya streak tidak putus.";
    if (streak.shields >= streak.maxShields) return "Perisai penuh. Streak-mu terlindungi.";
    return `${streak.nextShieldIn} hari lagi untuk perisai berikutnya.`;
}
