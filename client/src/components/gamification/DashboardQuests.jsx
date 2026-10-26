import { Link } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { useFinance } from "../../context/FinanceContext";
import { personaById } from "../../utils/personas";
import useGameActions from "./useGameActions";
import { QuestItem, StreakFlame, streakHint, timeLeft, useNow } from "./GameParts";

/** Kartu ringkas di dashboard: level, streak, dan misi hari ini. */
export default function DashboardQuests() {
    const { gamification: g } = useFinance();
    const { claim, busy } = useGameActions();
    const now = useNow();

    if (!g?.quests) {
        return <section className="dq-card dq-skeleton" aria-busy />;
    }

    const persona = personaById(g.persona);
    const span = Math.max(1, g.nextLevelXp - g.levelStartXp);
    const pct = Math.min(100, Math.round(((g.xp - g.levelStartXp) / span) * 100));
    const daily = g.quests.daily;
    const done = daily.filter((q) => q.claimed).length;
    const claimable = [...daily, ...g.quests.weekly].filter((q) => q.claimable).length;

    return (
        <section className="dq-card">
            <div className="dq-top">
                <Link to="/pencapaian" className="dq-level" title="Lihat pencapaian">
                    <img src={persona.image} alt="" />
                    <div>
                        <span className="dq-level-kicker">Level {g.level}</span>
                        <strong>{g.levelTitle}</strong>
                        <div className="dq-bar" aria-label={`${pct}% menuju level ${g.level + 1}`}>
                            <span style={{ width: `${pct}%` }} />
                        </div>
                        <span className="dq-level-xp">
                            {(g.nextLevelXp - g.xp).toLocaleString("id-ID")} XP lagi
                            {g.xpToday > 0 && <em> · +{g.xpToday} hari ini</em>}
                        </span>
                    </div>
                </Link>
                <StreakFlame streak={g.streak} size="sm" />
            </div>
            {(g.streak?.atRisk || !g.streak?.current) && (
                <p className={`dq-hint ${g.streak?.atRisk ? "is-risk" : ""}`}>{streakHint(g.streak)}</p>
            )}

            <div className="dq-head">
                <h3>
                    Misi hari ini <span>{done}/{daily.length}</span>
                </h3>
                <span>Reset {timeLeft(g.quests.dailyResetsAt, now)}</span>
            </div>
            <ul className="gm-quests is-compact">
                {daily.map((q) => (
                    <QuestItem key={q.id} q={q} onClaim={claim} busy={busy} compact />
                ))}
            </ul>

            <Link to="/pencapaian?tab=misi" className="dq-more">
                {claimable > 0 ? `${claimable} misi siap diklaim` : "Misi mingguan & tantangan"}
                <FiArrowRight aria-hidden />
            </Link>
        </section>
    );
}
