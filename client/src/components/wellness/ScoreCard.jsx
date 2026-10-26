import { FiTrendingUp, FiShield, FiRepeat, FiTarget, FiEdit3 } from "react-icons/fi";

const ICONS = {
    saving: FiTrendingUp,
    emergency: FiShield,
    subscriptions: FiRepeat,
    budget: FiTarget,
    tracking: FiEdit3,
};

function tone(value) {
    if (value >= 80) return "great";
    if (value >= 60) return "good";
    if (value >= 40) return "warn";
    return "low";
}

/** Skor kesehatan finansial 0–100 beserta lima faktornya. */
export default function ScoreCard({ score }) {
    const r = 64;
    const c = 2 * Math.PI * r;
    const t = tone(score.value);
    const focus = score.factors.find((f) => f.key === score.focus);

    return (
        <section className={`wl-score is-${t}`} aria-label="Skor kesehatan finansial">
            <div className="wl-score-dial">
                <svg viewBox="0 0 160 160" aria-hidden>
                    <circle cx="80" cy="80" r={r} className="wl-dial-track" />
                    <circle
                        cx="80"
                        cy="80"
                        r={r}
                        className="wl-dial-fill"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - score.value / 100)}
                    />
                </svg>
                <div className="wl-dial-text">
                    <strong>{score.value}</strong>
                    <span>dari 100</span>
                </div>
            </div>

            <div className="wl-score-body">
                <span className="wl-kicker">Skor kesehatan finansial</span>
                <h2>{score.grade}</h2>
                {focus && (
                    <p className="wl-score-focus">
                        <strong>Fokus utama:</strong> {focus.label.toLowerCase()}. {focus.tip}
                    </p>
                )}
                <ul className="wl-factors">
                    {score.factors.map((f) => {
                        const Icon = ICONS[f.key] || FiTarget;
                        const pct = Math.round((f.score / f.max) * 100);
                        return (
                            <li key={f.key} title={f.tip}>
                                <span className="wl-factor-icon">
                                    <Icon aria-hidden />
                                </span>
                                <div className="wl-factor-main">
                                    <div className="wl-factor-top">
                                        <span>{f.label}</span>
                                        <em>
                                            {Math.round(f.score)}/{f.max}
                                        </em>
                                    </div>
                                    <div className="wl-factor-bar" aria-hidden>
                                        <span style={{ width: `${pct}%` }} className={`is-${tone(pct)}`} />
                                    </div>
                                    <span className="wl-factor-value">{f.value}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
