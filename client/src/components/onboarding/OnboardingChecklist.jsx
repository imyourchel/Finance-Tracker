import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck, FiChevronDown, FiChevronUp, FiArrowRight, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useFinance } from "../../context/FinanceContext";
import { getBudgetsAPI, getGoalsAPI } from "../../services/api";
import { openQuickAdd, QUICK_ADD_EVENT } from "../../utils/quickAddBus";
import { readOnb, writeOnb } from "./storage";

/** Checklist "Langkah awal" yang progresnya diambil dari data asli pengguna. */
export default function OnboardingChecklist({ uid, suspended }) {
    const { user } = useAuth();
    const { wallets, gamification, loadingData } = useFinance();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [st, setSt] = useState(() => readOnb(uid));
    const [counts, setCounts] = useState({ budgets: null, goals: null });

    const save = (patch) => setSt(writeOnb(uid, patch));

    // Tandai "coba catat cepat" saat palet dibuka (tombol atau Ctrl/⌘+K)
    useEffect(() => {
        const mark = () => setSt(writeOnb(uid, { triedQuickAdd: true }));
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") mark();
        };
        window.addEventListener(QUICK_ADD_EVENT, mark);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener(QUICK_ADD_EVENT, mark);
            window.removeEventListener("keydown", onKey);
        };
    }, [uid]);

    // Jumlah budget & goal: ambil ringan, ulangi saat pindah halaman kalau belum terpenuhi
    const needCounts = !st.hidden && (!(counts.budgets > 0) || !(counts.goals > 0));
    useEffect(() => {
        if (!needCounts) return;
        let alive = true;
        const now = new Date();
        Promise.allSettled([getBudgetsAPI({ month: now.getMonth() + 1, year: now.getFullYear() }), getGoalsAPI()]).then(
            ([b, g]) => {
                if (!alive) return;
                const len = (r) => {
                    if (r.status !== "fulfilled") return null;
                    const d = r.value.data;
                    return Array.isArray(d) ? d.length : Array.isArray(d?.budgets) ? d.budgets.length : Array.isArray(d?.goals) ? d.goals.length : 0;
                };
                setCounts({ budgets: len(b), goals: len(g) });
            },
        );
        return () => {
            alive = false;
        };
    }, [pathname, needCounts]);

    const stats = gamification?.stats;
    const items = useMemo(
        () => [
            { id: "wallet", label: "Siapkan wallet", hint: "Dompet, rekening, atau e-wallet", done: wallets.length > 0, to: "/wallets" },
            { id: "tx", label: "Catat transaksi pertama", hint: "Satu kalimat sudah cukup", done: (stats?.totalTx || 0) > 0, action: openQuickAdd },
            { id: "quick", label: "Coba catat cepat", hint: "Ctrl+K dari mana saja", done: Boolean(st.triedQuickAdd), action: openQuickAdd },
            { id: "payday", label: "Atur tanggal gajian", hint: "Untuk jatah aman per hari", done: Boolean(user?.payday), to: "/settings#keuangan" },
            { id: "budget", label: "Buat budget pertama", hint: "Batas per kategori", done: counts.budgets > 0, to: "/budgets" },
            { id: "goal", label: "Buat goal tabungan", hint: "Liburan, gadget, dana darurat", done: counts.goals > 0, to: "/goals" },
            { id: "quest", label: "Klaim misi pertama", hint: "Dapat XP dari misi harian", done: (stats?.questsClaimed || 0) > 0, to: "/pencapaian?tab=misi" },
        ],
        [wallets.length, stats?.totalTx, stats?.questsClaimed, st.triedQuickAdd, user?.payday, counts],
    );

    const doneCount = items.filter((i) => i.done).length;
    const allDone = doneCount === items.length;
    const pct = Math.round((doneCount / items.length) * 100);
    const open = st.checklistOpen !== false;

    if (!uid || st.hidden || suspended || loadingData || !gamification) return null;

    const go = (it) => {
        if (it.action) it.action();
        else navigate(it.to);
    };

    if (!open) {
        return (
            <button
                type="button"
                className={`onb-check onb-pill ${allDone ? "is-done" : ""}`}
                onClick={() => save({ checklistOpen: true })}
                aria-label={`Langkah awal, ${doneCount} dari ${items.length} selesai`}
            >
                <span className="onb-ring" style={{ "--p": `${pct}%` }}>
                    <span>{doneCount}</span>
                </span>
                <span className="onb-pill-label">Langkah awal</span>
                <FiChevronUp aria-hidden />
            </button>
        );
    }

    return (
        <section className={`onb-check onb-panel ${allDone ? "is-done" : ""}`} aria-label="Langkah awal">
            <header>
                <div>
                    <strong>{allDone ? "Semua siap!" : "Langkah awal"}</strong>
                    <span>
                        {doneCount} dari {items.length} selesai
                    </span>
                </div>
                <button type="button" className="onb-icon-btn" onClick={() => save({ checklistOpen: false })} aria-label="Ciutkan">
                    <FiChevronDown />
                </button>
            </header>
            <div className="onb-bar" aria-hidden>
                <span style={{ width: `${pct}%` }} />
            </div>

            {allDone ? (
                <div className="onb-complete">
                    <div className="onb-burst" aria-hidden>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <i key={i} style={{ "--i": i }} />
                        ))}
                    </div>
                    <p>DailyTrack sudah siap menemanimu. Jaga streak-mu dan biarkan maskotmu tumbuh.</p>
                    <button type="button" className="onb-btn is-primary is-sm" onClick={() => save({ hidden: true })}>
                        Tutup checklist
                    </button>
                </div>
            ) : (
                <ul>
                    {items.map((it) => (
                        <li key={it.id} className={it.done ? "is-done" : ""}>
                            <span className="onb-tick" aria-hidden>
                                {it.done && <FiCheck />}
                            </span>
                            <div>
                                <strong>{it.label}</strong>
                                <span>{it.hint}</span>
                            </div>
                            {!it.done && (
                                <button type="button" className="onb-go" onClick={() => go(it)} aria-label={it.label}>
                                    <FiArrowRight />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!allDone && (
                <button type="button" className="onb-hide" onClick={() => save({ hidden: true })}>
                    <FiX aria-hidden /> Sembunyikan
                </button>
            )}
        </section>
    );
}
