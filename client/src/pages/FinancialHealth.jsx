import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import PageHeader from "../components/Layout/PageHeader";
import { useFinance } from "../context/FinanceContext";
import { createGoalAPI, createRecurringAPI } from "../services/api";
import {
    getWellnessAPI,
    updateWellnessProfileAPI,
    ignoreSubscriptionAPI,
    unignoreSubscriptionAPI,
} from "../services/wellnessApi";
import { confirmDialog } from "../utils/confirm";
import ScoreCard from "../components/wellness/ScoreCard";
import EmergencyFund from "../components/wellness/EmergencyFund";
import Subscriptions from "../components/wellness/Subscriptions";
import { rp, dateLabel } from "../components/wellness/helpers";
import "../styles/wellness.css";

const FREQ_WORD = { weekly: "setiap minggu", monthly: "setiap bulan", yearly: "setiap tahun" };
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Kesehatan Finansial: skor, dana darurat, dan langganan. */
export default function FinancialHealth() {
    const { wallets, refresh } = useFinance();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let alive = true;
        getWellnessAPI()
            .then((res) => {
                if (!alive) return;
                setData(res.data);
                setError("");
            })
            .catch((err) => alive && setError(err.response?.data?.message || "Data kesehatan finansial gagal dimuat."));
        return () => {
            alive = false;
        };
    }, [tick]);

    const fail = (err, title) =>
        confirmDialog({ title, message: err.response?.data?.message || "Coba lagi sebentar.", alertOnly: true });

    const run = useCallback(async (tag, fn, title) => {
        setBusy(tag);
        try {
            await fn();
        } catch (err) {
            await fail(err, title);
        } finally {
            setBusy(null);
        }
    }, []);

    const saveProfile = (payload) =>
        run(
            "profile",
            async () => {
                const res = await updateWellnessProfileAPI(payload);
                setData(res.data);
            },
            "Gagal menyimpan profil",
        );

    const makeGoal = async () => {
        const e = data.emergency;
        const ok = await confirmDialog({
            title: "Buat goal Dana darurat?",
            message: `Goal baru dengan target ${rp(e.target)} (${e.multiplier}× pengeluaran bulanan). Setoranmu ke goal ini akan dihitung sebagai dana darurat.`,
            confirmLabel: "Buat goal",
            danger: false,
        });
        if (!ok) return;
        await run(
            "goal",
            async () => {
                const res = await createGoalAPI({
                    name: "Dana darurat",
                    targetAmount: e.target,
                    priority: "high",
                    icon: "shield",
                    color: "#1e6e55",
                    note: `Target ${e.multiplier}× rata-rata pengeluaran bulanan.`,
                });
                const goalId = res.data?._id;
                const upd = await updateWellnessProfileAPI({
                    household: data.profile.household,
                    multiplier: e.multiplier,
                    fundWallets: e.sources.wallets,
                    fundGoals: goalId ? [...e.sources.goals, goalId] : e.sources.goals,
                });
                setData(upd.data);
                refresh();
            },
            "Gagal membuat goal",
        );
    };

    const makeRecurring = async (it) => {
        const walletId =
            it.walletId ||
            wallets.find((w) => w.isDefault && w.type !== "gold")?._id ||
            wallets.find((w) => w.type !== "gold")?._id;
        const categoryId = it.categoryId || data.subscriptions.fallbackCategoryId;
        if (!walletId || !categoryId) {
            await confirmDialog({
                title: "Belum bisa dibuat",
                message: "Butuh wallet dan kategori pengeluaran. Buat dulu di menu Tagihan Rutin.",
                alertOnly: true,
            });
            return;
        }
        const start = it.nextKey && it.nextKey >= todayKey() ? it.nextKey : todayKey();
        const walletName = wallets.find((w) => w._id === walletId)?.name || "wallet utama";
        const ok = await confirmDialog({
            title: `Jadikan ${it.name} tagihan rutin?`,
            message: `${rp(it.amount)} akan tercatat otomatis ${FREQ_WORD[it.frequency]} dari ${walletName}, mulai ${dateLabel(start, true)}. Setelah ini kamu tidak perlu mencatatnya manual.`,
            confirmLabel: "Jadikan rutin",
            danger: false,
        });
        if (!ok) return;
        await run(
            it.key,
            async () => {
                await createRecurringAPI({
                    walletId,
                    type: "expense",
                    amount: it.amount,
                    categoryId,
                    description: it.name,
                    frequency: it.frequency,
                    startDate: start,
                });
                setTick((n) => n + 1);
            },
            "Gagal membuat tagihan rutin",
        );
    };

    const ignore = (it) =>
        run(
            it.key,
            async () => {
                const res = await ignoreSubscriptionAPI(it.key);
                setData(res.data);
            },
            "Gagal mengabaikan",
        );
    const restore = (it) =>
        run(
            it.key,
            async () => {
                const res = await unignoreSubscriptionAPI(it.key);
                setData(res.data);
            },
            "Gagal memulihkan",
        );

    return (
        <div className="wl-page">
            <PageHeader
                title="Kesehatan Finansial"
                subtitle="Seberapa siap keuanganmu menghadapi kejutan, dan ke mana uang langgananmu pergi."
            />

            {error && !data ? (
                <div className="wl-card wl-empty">
                    <FiAlertCircle aria-hidden />
                    <div>
                        <strong>{error}</strong>
                        <button type="button" className="btn-ghost" onClick={() => setTick((n) => n + 1)}>
                            Coba lagi
                        </button>
                    </div>
                </div>
            ) : !data ? (
                <div className="wl-skeleton" aria-busy>
                    <div />
                    <div />
                    <div />
                </div>
            ) : (
                <>
                    <ScoreCard score={data.score} />

                    <section className="wl-section">
                        <div className="wl-section-head">
                            <h2>Dana darurat</h2>
                            <p>Tabungan yang siap dipakai saat kehilangan pemasukan, sakit, atau kebutuhan mendadak.</p>
                        </div>
                        <EmergencyFund
                            key={JSON.stringify([data.profile, data.emergency.sources, data.emergency.multiplier])}
                            emergency={data.emergency}
                            profile={data.profile}
                            sources={data.sources}
                            onSave={saveProfile}
                            onMakeGoal={makeGoal}
                            busy={busy}
                        />
                    </section>

                    <section className="wl-section">
                        <div className="wl-section-head">
                            <h2>Langganan & tagihan</h2>
                            <p>
                                Terdeteksi otomatis dari pengeluaran yang berulang, ditambah tagihan rutin yang sudah kamu
                                buat.
                            </p>
                        </div>
                        <Subscriptions
                            data={data.subscriptions}
                            onRecurring={makeRecurring}
                            onIgnore={ignore}
                            onRestore={restore}
                            busy={busy}
                        />
                    </section>
                </>
            )}
        </div>
    );
}
