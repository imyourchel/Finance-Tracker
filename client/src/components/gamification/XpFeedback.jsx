import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiZap, FiTarget, FiAward, FiX, FiTrendingUp, FiFlag } from "react-icons/fi";
import { useFinance } from "../../context/FinanceContext";
import useGameActions from "./useGameActions";

const REASONS = {
    activeDays: "Hari aktif",
    transactions: "Transaksi tercatat",
    bestStreak: "Rekor streak",
    quests: "Misi diklaim",
    challenges: "Tantangan selesai",
    frugalMonths: "Bulan hemat",
    budgetsKept: "Budget terjaga",
    goalsCompleted: "Goal tercapai",
    gold: "Wallet emas",
};

const pctOf = (g) => {
    const span = Math.max(1, g.nextLevelXp - g.levelStartXp);
    return Math.max(0, Math.min(100, ((g.xp - g.levelStartXp) / span) * 100));
};

let seq = 0;

/** Umpan balik instan: +XP, naik level, misi selesai, tantangan selesai. Dipasang sekali di layout. */
export default function XpFeedback() {
    const { gamification: g } = useFinance();
    const prev = useRef(null);
    const [toasts, setToasts] = useState([]);
    const navigate = useNavigate();
    const { claim, busy } = useGameActions();

    const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    useEffect(() => {
        if (!g) return;
        const p = prev.current;
        prev.current = g;
        if (!p) return;

        const next = [];
        const delta = g.xp - p.xp;
        if (delta > 0) {
            const reasons = Object.keys(REASONS)
                .map((k) => [k, (g.xpBreakdown?.[k] || 0) - (p.xpBreakdown?.[k] || 0)])
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${REASONS[k]} +${v}`);
            const levelUp = g.level > p.level;
            next.push({
                id: ++seq,
                kind: levelUp ? "level" : "xp",
                delta,
                reasons,
                level: g.level,
                levelTitle: g.levelTitle,
                from: levelUp ? 0 : pctOf(p),
                to: pctOf(g),
                streak: g.streak?.current > (p.streak?.current || 0) ? g.streak.current : null,
            });
        }

        const wasClaimable = new Set(
            [...(p.quests?.daily || []), ...(p.quests?.weekly || [])].filter((q) => q.claimable).map((q) => q.id),
        );
        for (const q of [...(g.quests?.daily || []), ...(g.quests?.weekly || [])]) {
            if (q.claimable && !wasClaimable.has(q.id)) next.push({ id: ++seq, kind: "quest", quest: q });
        }

        for (const c of g.challenges?.history || []) {
            if (c.justFinished) next.push({ id: ++seq, kind: "challenge", challenge: c });
        }

        if (next.length) setToasts((t) => [...t, ...next].slice(-4)); // eslint-disable-line react-hooks/set-state-in-effect
    }, [g]);

    if (!toasts.length) return null;

    return createPortal(
        <div className="xpf-stack" aria-live="polite">
            {toasts.map((t) => (
                <Toast key={t.id} t={t} onDismiss={dismiss}>
                    {t.kind === "xp" || t.kind === "level" ? (
                        <>
                            <span className={`xpf-icon ${t.kind === "level" ? "is-level" : ""}`}>
                                {t.kind === "level" ? <FiTrendingUp /> : <FiZap />}
                            </span>
                            <div className="xpf-body">
                                <div className="xpf-title">
                                    <strong className="xpf-delta">+{t.delta} XP</strong>
                                    {t.kind === "level" && (
                                        <span>
                                            Naik ke Level {t.level} · {t.levelTitle}
                                        </span>
                                    )}
                                </div>
                                {t.reasons.length > 0 && <div className="xpf-sub">{t.reasons.join(" · ")}</div>}
                                {t.streak && <div className="xpf-streak">Streak jadi {t.streak} hari</div>}
                                <div className="xpf-bar" style={{ "--from": `${t.from}%`, "--to": `${t.to}%` }}>
                                    <span />
                                </div>
                            </div>
                        </>
                    ) : t.kind === "quest" ? (
                        <>
                            <span className="xpf-icon is-quest">
                                <FiTarget />
                            </span>
                            <div className="xpf-body">
                                <div className="xpf-title">
                                    <span className="xpf-kicker">Misi selesai</span>
                                </div>
                                <div className="xpf-name">{t.quest.title}</div>
                                <button
                                    type="button"
                                    className="xpf-claim"
                                    disabled={busy === t.quest.id}
                                    onClick={async () => {
                                        if (await claim(t.quest.id)) dismiss(t.id);
                                    }}
                                >
                                    {busy === t.quest.id ? "Mengklaim..." : `Klaim +${t.quest.xp} XP`}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className={`xpf-icon ${t.challenge.status === "completed" ? "is-level" : "is-muted"}`}>
                                {t.challenge.status === "completed" ? <FiAward /> : <FiFlag />}
                            </span>
                            <div className="xpf-body">
                                <span className="xpf-kicker">
                                    {t.challenge.status === "completed" ? "Tantangan selesai!" : "Tantangan berakhir"}
                                </span>
                                <div className="xpf-name">{t.challenge.title}</div>
                                <div className="xpf-sub">
                                    {t.challenge.status === "completed"
                                        ? `Hadiah +${t.challenge.xpReward} XP sudah masuk.`
                                        : "Belum berhasil kali ini. Coba lagi dengan target yang lebih pas."}
                                </div>
                                <button
                                    type="button"
                                    className="xpf-link"
                                    onClick={() => {
                                        navigate("/pencapaian?tab=tantangan");
                                        setToasts([]);
                                    }}
                                >
                                    Lihat tantangan
                                </button>
                            </div>
                        </>
                    )}
                </Toast>
            ))}
        </div>,
        document.body,
    );
}

function Toast({ t, onDismiss, children }) {
    const { id, kind } = t;
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(id), kind === "quest" ? 9000 : kind === "level" ? 6500 : 4500);
        return () => clearTimeout(timer);
    }, [onDismiss, id, kind]);
    const onClose = () => onDismiss(id);

    return (
        <div className={`xpf-toast is-${t.kind}`} role="status">
            {children}
            <button type="button" className="xpf-close" onClick={onClose} aria-label="Tutup">
                <FiX />
            </button>
        </div>
    );
}
