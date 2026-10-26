import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useFinance } from "../../context/FinanceContext";
import { personaById } from "../../utils/personas";

const KEY = "dt-persona-tier";

const readTier = () => {
    try {
        return Number(localStorage.getItem(KEY)) || 0;
    } catch {
        return 0;
    }
};
const saveTier = (t) => {
    try {
        localStorage.setItem(KEY, String(t));
    } catch {
        /* abaikan */
    }
};

/** Perayaan saat maskot naik tingkat. Dipasang sekali di layout aplikasi. */
export default function LevelUpCelebration() {
    const { gamification } = useFinance();
    const navigate = useNavigate();
    const [shown, setShown] = useState(null);

    useEffect(() => {
        if (!gamification) return;
        const prev = readTier();
        const tier = gamification.tier;
        if (prev && tier > prev) setShown(personaById(gamification.persona)); // eslint-disable-line react-hooks/set-state-in-effect
        saveTier(tier);
    }, [gamification]);

    if (!shown) return null;

    return createPortal(
        <div className="lu-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShown(null)}>
            <div className="lu-box" role="dialog" aria-modal="true" aria-labelledby="lu-title">
                <div className="lu-rays" aria-hidden />
                <img src={shown.image} alt="" className="lu-img" />
                <div className="lu-kicker">Naik tingkat!</div>
                <h2 id="lu-title">
                    Kamu sekarang {shown.name}, {shown.title}
                </h2>
                <p>{shown.meaning}</p>
                <div className="lu-actions">
                    <button type="button" className="btn-ghost" onClick={() => setShown(null)}>
                        Tutup
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                            setShown(null);
                            navigate("/pencapaian");
                        }}
                    >
                        Lihat pencapaian
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
