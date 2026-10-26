import { useCallback, useState } from "react";
import { useFinance } from "../../context/FinanceContext";
import { claimQuestAPI, joinChallengeAPI, abandonChallengeAPI } from "../../services/api";
import { confirmDialog } from "../../utils/confirm";

const fail = (err, title) =>
    confirmDialog({
        title,
        message: err.response?.data?.message || "Coba lagi sebentar.",
        alertOnly: true,
    });

/** Aksi gamifikasi: klaim misi, ikut & keluar tantangan. Hasil server langsung jadi state. */
export default function useGameActions() {
    const { setGamification } = useFinance();
    const [busy, setBusy] = useState(null);

    const claim = useCallback(
        async (questId) => {
            setBusy(questId);
            try {
                const res = await claimQuestAPI(questId);
                setGamification(res.data.gamification);
                return true;
            } catch (err) {
                await fail(err, "Misi belum bisa diklaim");
                return false;
            } finally {
                setBusy(null);
            }
        },
        [setGamification],
    );

    const join = useCallback(
        async (type, params) => {
            setBusy(type);
            try {
                const res = await joinChallengeAPI({ type, params });
                setGamification(res.data.gamification);
                return true;
            } catch (err) {
                await fail(err, "Gagal mengikuti tantangan");
                return false;
            } finally {
                setBusy(null);
            }
        },
        [setGamification],
    );

    const abandon = useCallback(
        async (challenge) => {
            const ok = await confirmDialog({
                title: `Keluar dari "${challenge.title}"?`,
                message: "Progres tantangan ini akan hilang dan XP hadiahnya tidak didapat.",
                confirmLabel: "Keluar",
                cancelLabel: "Tetap ikut",
            });
            if (!ok) return false;
            setBusy(challenge.id);
            try {
                const res = await abandonChallengeAPI(challenge.id);
                setGamification(res.data.gamification);
                return true;
            } catch (err) {
                await fail(err, "Gagal keluar dari tantangan");
                return false;
            } finally {
                setBusy(null);
            }
        },
        [setGamification],
    );

    return { claim, join, abandon, busy };
}
