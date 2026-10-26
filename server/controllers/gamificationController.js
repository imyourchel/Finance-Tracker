const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Wallet = require("../models/Wallet");
const QuestClaim = require("../models/QuestClaim");
const Challenge = require("../models/Challenge");

/*
 * Gamifikasi DailyTrack
 * ─────────────────────
 * - Persona (maskot foto profil) ditentukan dari kebiasaan 30 hari terakhir.
 *   Naik tingkat kalau semua syarat tingkat berikutnya terpenuhi, dan bisa
 *   turun lagi kalau kebiasaannya kendor.
 * - XP & level dihitung dari seluruh riwayat, jadi tidak pernah turun.
 * - Streak harian dilindungi perisai: tiap 7 hari beruntun dapat 1 perisai
 *   (maks. 2) yang otomatis menyelamatkan streak saat lupa mencatat sehari.
 * - Misi harian & mingguan: dihitung dari data, XP didapat saat diklaim.
 * - Tantangan menabung: diikuti secara sadar, dinilai otomatis dari transaksi.
 *
 * Catatan data: setoran ke goal tersimpan sebagai pengeluaran ber-goalId dan
 * penarikan sebagai pemasukan ber-goalId. Keduanya bukan jajan/pemasukan,
 * melainkan uang yang disisihkan, jadi tidak ikut dihitung sebagai pengeluaran.
 */

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHIELDS = 2;
const SHIELD_EVERY = 7;
const MAX_ACTIVE_CHALLENGES = 3;

// ── Util tanggal (semua dalam WIB, kunci "YYYY-MM-DD") ──────────────
const dayKey = (d) => new Date(new Date(d).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
const monthKey = (d) => dayKey(d).slice(0, 7);
const addDays = (key, n) => new Date(Date.parse(key) + n * DAY_MS).toISOString().slice(0, 10);
const weekday = (key) => new Date(Date.parse(key)).getUTCDay(); // 0 = Minggu
const mondayOf = (key) => addDays(key, -((weekday(key) + 6) % 7));
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const monthEndKey = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
// Awal hari WIB berikutnya → Date (untuk hitung mundur reset misi)
const startOfKey = (key) => new Date(Date.parse(key) - TZ_OFFSET_MS);

// PRNG sederhana supaya misi berganti tiap periode tapi stabil dalam periode itu
const hashString = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};
const seededPick = (items, n, seed) => {
    let x = hashString(seed) || 1;
    const rand = () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    };
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
};

const PERSONAS = ["semut", "tupai", "celengan-ayam", "burung-hantu", "koi"];

const LEVEL_TITLES = [
    [1, "Pemula Hemat"],
    [3, "Pencatat Rajin"],
    [5, "Penjaga Anggaran"],
    [8, "Ahli Tabungan"],
    [12, "Maestro Finansial"],
    [18, "Legenda DailyTrack"],
];
const levelTitle = (L) => LEVEL_TITLES.filter(([min]) => L >= min).pop()[1];

// Syarat tiap tingkat (tingkat 1 / semut tidak punya syarat)
const buildRequirements = (s) => ({
    tupai: [
        req("activeDays", "Aktif mencatat dalam 30 hari terakhir", s.activeDays30, 10, "hari"),
        req("savingRate", "Sisa uang dari pemasukan (30 hari)", s.savingRate30, 10, "%"),
    ],
    "celengan-ayam": [
        req("activeDays", "Aktif mencatat dalam 30 hari terakhir", s.activeDays30, 18, "hari"),
        req("savingRate", "Sisa uang dari pemasukan (30 hari)", s.savingRate30, 20, "%"),
        req("hasGoal", "Punya goal tabungan", s.goalsTotal, 1, "goal"),
    ],
    "burung-hantu": [
        req("activeDays", "Aktif mencatat dalam 30 hari terakhir", s.activeDays30, 22, "hari"),
        req("savingRate", "Sisa uang dari pemasukan (30 hari)", s.savingRate30, 25, "%"),
        req("budgets", "Budget kategori bulan ini", s.budgetsThisMonth, 3, "budget"),
        req("budgetsSafe", "Semua budget bulan ini masih aman", s.budgetsThisMonth > 0 && s.budgetsOverThisMonth === 0 ? 1 : 0, 1, "", true),
    ],
    koi: [
        req("activeDays", "Aktif mencatat dalam 30 hari terakhir", s.activeDays30, 25, "hari"),
        req("frugalStreak", "Bulan hemat beruntun (sisa ≥ 20%)", s.frugalMonthStreak, 3, "bulan"),
        req("goalDone", "Goal tabungan tercapai", s.goalsCompleted, 1, "goal"),
    ],
});

function req(key, label, current, target, unit, boolean = false) {
    const value = Number.isFinite(current) ? current : 0;
    return {
        key,
        label,
        current: Math.round(value * 10) / 10,
        target,
        unit,
        boolean,
        met: value >= target,
        progress: Math.max(0, Math.min(1, target ? value / target : 1)),
    };
}

const BADGES = (s) => [
    badge("first-tx", "Catatan pertama", "Mencatat transaksi pertamamu.", s.totalTx, 1),
    badge("streak-7", "Seminggu konsisten", "Mencatat 7 hari berturut-turut.", s.bestStreak, 7),
    badge("streak-30", "Sebulan penuh", "Mencatat 30 hari berturut-turut.", s.bestStreak, 30),
    badge("streak-100", "Seratus hari", "Streak 100 hari tanpa putus.", s.bestStreak, 100),
    badge("shield", "Diselamatkan perisai", "Streak-mu pernah diselamatkan perisai.", s.shieldSaves, 1),
    badge("tx-100", "100 catatan", "Total 100 transaksi tercatat.", s.totalTx, 100),
    badge("quest-25", "Pemburu misi", "Mengklaim 25 misi harian atau mingguan.", s.questsClaimed, 25),
    badge("challenge-1", "Penantang", "Menyelesaikan tantangan menabung pertama.", s.challengesCompleted, 1),
    badge("challenge-5", "Juara tantangan", "Menyelesaikan 5 tantangan menabung.", s.challengesCompleted, 5),
    badge("frugal-month", "Bulan hemat", "Satu bulan dengan sisa uang minimal 20%.", s.frugalMonths12, 1),
    badge("frugal-3", "Hemat 3 bulan beruntun", "Tiga bulan berturut-turut sisa uang minimal 20%.", s.frugalMonthStreak, 3),
    badge("budget-safe", "Budget terjaga", "Melewati satu bulan penuh tanpa budget yang jebol.", s.safeBudgetMonths, 1),
    badge("goal-1", "Goal tercapai", "Menyelesaikan goal tabungan pertama.", s.goalsCompleted, 1),
    badge("gold", "Investor emas", "Punya wallet emas.", s.hasGold ? 1 : 0, 1),
];

function badge(id, title, description, current, target) {
    const value = Number.isFinite(current) ? current : 0;
    return { id, title, description, unlocked: value >= target, current: Math.min(value, target), target };
}

// XP untuk mencapai level L: 50 × L × (L − 1)  → L2=100, L3=300, L4=600, L5=1000 …
const xpForLevel = (L) => 50 * L * (L - 1);
const levelFromXp = (xp) => {
    let L = 1;
    while (xp >= xpForLevel(L + 1)) L += 1;
    return L;
};

// ── Katalog tantangan ───────────────────────────────────────────────
const SISA_REWARD = { 20: 120, 30: 180, 40: 250 };
const CHALLENGE_CATALOG = [
    {
        type: "batas-harian",
        title: "Batas jajan harian",
        description: "Selama 7 hari, pengeluaran harianmu tidak boleh melewati batas yang kamu tentukan.",
        duration: "7 hari",
        xp: 150,
        param: { key: "dailyLimit", label: "Batas per hari", kind: "money", options: [50000, 100000, 150000, 250000] },
    },
    {
        type: "tanpa-jajan-3",
        title: "3 hari tanpa jajan",
        description: "Dalam 7 hari, kumpulkan 3 hari tanpa pengeluaran sama sekali. Tagihan rutin tidak dihitung.",
        duration: "7 hari",
        xp: 120,
    },
    {
        type: "akhir-pekan",
        title: "Akhir pekan hemat",
        description: "Sabtu dan Minggu tanpa pengeluaran. Tagihan rutin tidak dihitung.",
        duration: "2 hari",
        xp: 100,
    },
    {
        type: "sisa-bulan",
        title: "Sisa bulan ini",
        description: "Akhiri bulan dengan sisa uang minimal sekian persen dari pemasukan. Setoran ke goal dihitung sebagai sisa.",
        duration: "1 bulan",
        xp: SISA_REWARD[30],
        param: { key: "targetRate", label: "Target sisa", kind: "percent", options: [20, 30, 40], rewards: SISA_REWARD },
    },
    {
        type: "52-minggu",
        title: "Tantangan 52 minggu",
        description: "Minggu ke-n, sisihkan n × nominal dasar ke goal tabungan. Dalam setahun terkumpul 1.378 × nominal dasar.",
        duration: "52 minggu",
        xp: 1000,
        param: { key: "baseAmount", label: "Nominal dasar", kind: "money", options: [5000, 10000, 20000, 50000] },
    },
];
const catalogByType = Object.fromEntries(CHALLENGE_CATALOG.map((c) => [c.type, c]));

// ── Kumpulkan data mentah ───────────────────────────────────────────
async function loadData(userId, now) {
    const since400 = new Date(now.getTime() - 400 * DAY_MS);
    const challenges = await Challenge.find({ user: userId }).sort({ createdAt: -1 }).lean();
    const oldestActive = challenges
        .filter((c) => c.status === "active")
        .reduce((min, c) => (c.startKey < min ? c.startKey : min), dayKey(since400));
    const sinceDate = startOfKey(oldestActive) < since400 ? startOfKey(oldestActive) : since400;

    const [allTx, datedTx, budgets, goals, goldCount, claims] = await Promise.all([
        // Hari aktif, streak & misi dihitung dari kapan transaksi dicatat (createdAt)
        Transaction.find({ user: userId, isDeleted: false })
            .select("createdAt isTransfer type description tags mood goalId")
            .lean(),
        // Arus uang dihitung dari tanggal transaksi
        Transaction.find({
            user: userId,
            isDeleted: false,
            isTransfer: { $ne: true },
            type: { $in: ["income", "expense"] },
            date: { $gte: sinceDate },
        })
            .select("type amount date goalId debtId isRecurring")
            .lean(),
        Budget.find({ user: userId }).select("limit spent month year").lean(),
        Goal.find({ user: userId, status: { $ne: "cancelled" } }).select("status").lean(),
        Wallet.countDocuments({ user: userId, type: "gold", isArchived: false }),
        QuestClaim.find({ user: userId }).select("questId period xp createdAt").lean(),
    ]);
    return { allTx, datedTx, budgets, goals, goldCount, claims, challenges };
}

// ── Streak dengan perisai ───────────────────────────────────────────
function computeStreak(days, todayKey) {
    const sorted = [...days].sort();
    const result = {
        current: 0,
        best: 0,
        shields: 0,
        maxShields: MAX_SHIELDS,
        activeToday: days.has(todayKey),
        savedDays: [],
        nextShieldIn: SHIELD_EVERY,
    };
    if (!sorted.length) return result;

    let streak = 0;
    let shields = 0;
    let best = 0;
    // Batasi simulasi ke 2 tahun terakhir supaya tetap ringan
    let d = sorted[0] < addDays(todayKey, -730) ? addDays(todayKey, -730) : sorted[0];
    while (d <= todayKey) {
        if (days.has(d)) {
            streak += 1;
            best = Math.max(best, streak);
            if (streak % SHIELD_EVERY === 0 && shields < MAX_SHIELDS) shields += 1;
        } else if (d < todayKey) {
            if (streak > 0 && shields > 0) {
                shields -= 1;
                result.savedDays.push(d);
            } else {
                streak = 0;
            }
        }
        d = addDays(d, 1);
    }
    result.current = streak;
    result.best = best;
    result.shields = shields;
    result.nextShieldIn = shields >= MAX_SHIELDS ? 0 : SHIELD_EVERY - (streak % SHIELD_EVERY);
    result.atRisk = streak > 0 && !result.activeToday;
    // Jejak 7 hari terakhir untuk ditampilkan
    const saved = new Set(result.savedDays);
    result.recent = Array.from({ length: 7 }, (_, i) => {
        const k = addDays(todayKey, i - 6);
        let state = days.has(k) ? "active" : saved.has(k) ? "saved" : k === todayKey ? "today" : "missed";
        if (k === todayKey && days.has(k)) state = "active";
        return { key: k, state, today: k === todayKey };
    });
    result.savedDays = result.savedDays.slice(-5);
    return result;
}

// ── Misi ────────────────────────────────────────────────────────────
function questDef(id, scope, title, description, xp, current, target, unit, extra = {}) {
    const value = Number.isFinite(current) ? current : 0;
    return {
        id,
        scope,
        title,
        description,
        xp,
        current: Math.round(value),
        target,
        unit,
        progress: Math.max(0, Math.min(1, target ? value / target : 0)),
        complete: extra.complete ?? value >= target,
        lockedUntil: extra.lockedUntil || null,
        moneyCompare: extra.moneyCompare || null,
    };
}

function buildQuests(ctx) {
    const { todayRows, weekRows, todayKey, weekKey, hourWib, userId } = ctx;
    const countBy = (rows, fn) => rows.filter(fn).length;

    // Harian
    const dailyPool = [
        questDef("tiga-catatan", "daily", "Catat 3 transaksi", "Kebiasaan kecil yang membuat laporanmu akurat.", 15, todayRows.length, 3, "transaksi"),
        questDef(
            "beri-catatan",
            "daily",
            "Beri keterangan di 2 transaksi",
            "Keterangan membantu kamu ingat uangnya untuk apa.",
            10,
            countBy(todayRows, (t) => (t.description || "").trim().length > 0),
            2,
            "transaksi",
        ),
        questDef("pakai-tag", "daily", "Pakai tag di 1 transaksi", "Tag memudahkan menelusuri pengeluaran sejenis.", 10, countBy(todayRows, (t) => t.tags?.length > 0), 1, "transaksi"),
        questDef("catat-mood", "daily", "Catat mood di 1 transaksi", "Kenali belanja yang dipicu perasaan.", 10, countBy(todayRows, (t) => Boolean(t.mood)), 1, "transaksi"),
    ];
    if (ctx.activeGoals > 0) {
        dailyPool.push(
            questDef("setor-goal", "daily", "Setor ke goal tabungan", "Sedikit demi sedikit, goal-mu makin dekat.", 20, countBy(todayRows, (t) => t.goalId && t.type === "expense"), 1, "setoran"),
        );
    }
    if (ctx.avgDailySpend > 0) {
        const ok = ctx.spendToday <= ctx.avgDailySpend;
        dailyPool.push(
            questDef("di-bawah-rata", "daily", "Jajan di bawah rata-rata", "Tutup hari dengan pengeluaran di bawah rata-rata harian 30 hari terakhir.", 20, ok ? 1 : 0, 1, "", {
                complete: ok && hourWib >= 18,
                lockedUntil: hourWib < 18 ? "Bisa diklaim mulai pukul 18.00" : null,
                moneyCompare: { current: ctx.spendToday, limit: Math.round(ctx.avgDailySpend) },
            }),
        );
    }
    const daily = [
        questDef("catat-hari-ini", "daily", "Catat 1 transaksi hari ini", "Jaga streak-mu tetap menyala.", 10, todayRows.length, 1, "transaksi"),
        ...seededPick(dailyPool, 2, `${userId}:${todayKey}`),
    ];

    // Mingguan
    const weekActiveDays = new Set(weekRows.map((t) => dayKey(t.createdAt))).size;
    const weeklyPool = [
        questDef("lima-belas", "weekly", "Catat 15 transaksi", "Pencatatan lengkap = analitik yang bisa dipercaya.", 50, weekRows.length, 15, "transaksi"),
    ];
    if (ctx.lastWeekSpend > 0) {
        const ok = ctx.weekSpend <= ctx.lastWeekSpend;
        const dow = weekday(todayKey);
        const weekend = dow === 6 || dow === 0;
        weeklyPool.push(
            questDef("lebih-hemat", "weekly", "Lebih hemat dari minggu lalu", "Pengeluaran minggu ini tidak melebihi minggu lalu.", 70, ok ? 1 : 0, 1, "", {
                complete: ok && weekend,
                lockedUntil: weekend ? null : "Bisa diklaim mulai Sabtu",
                moneyCompare: { current: ctx.weekSpend, limit: ctx.lastWeekSpend },
            }),
        );
    }
    if (ctx.budgetsThisMonth > 0) {
        weeklyPool.push(
            questDef("budget-aman", "weekly", "Semua budget aman", "Tidak ada budget bulan ini yang jebol.", 40, ctx.budgetsThisMonth - ctx.budgetsOverThisMonth, ctx.budgetsThisMonth, "budget"),
        );
    }
    if (ctx.activeGoals > 0) {
        weeklyPool.push(
            questDef("dua-setoran", "weekly", "Setor ke goal 2 kali", "Rutin menyisihkan lebih kuat daripada sekali besar.", 50, countBy(weekRows, (t) => t.goalId && t.type === "expense"), 2, "setoran"),
        );
    }
    weeklyPool.push(
        questDef("tujuh-tag", "weekly", "Pakai tag di 7 transaksi", "Rapikan catatanmu supaya mudah dicari.", 40, countBy(weekRows, (t) => t.tags?.length > 0), 7, "transaksi"),
    );
    const weekly = [
        questDef("lima-hari", "weekly", "Mencatat di 5 hari berbeda", "Konsistensi lebih penting dari jumlah.", 60, weekActiveDays, 5, "hari"),
        ...seededPick(weeklyPool, 2, `${userId}:${weekKey}`),
    ];

    const claimed = new Set(ctx.claims.map((c) => `${c.questId}@${c.period}`));
    const decorate = (q) => {
        const period = q.scope === "daily" ? todayKey : weekKey;
        const isClaimed = claimed.has(`${q.id}@${period}`);
        return { ...q, period, claimed: isClaimed, claimable: q.complete && !isClaimed };
    };
    return {
        daily: daily.map(decorate),
        weekly: weekly.map(decorate),
        dailyResetsAt: startOfKey(addDays(todayKey, 1)).toISOString(),
        weeklyResetsAt: startOfKey(addDays(weekKey, 7)).toISOString(),
    };
}

// ── Tantangan: penilaian ────────────────────────────────────────────
function rangeKeys(a, b) {
    const out = [];
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
    return out;
}

function evaluateChallenge(ch, ctx) {
    const meta = catalogByType[ch.type] || {};
    const { todayKey, spendByDay } = ctx;
    const started = todayKey >= ch.startKey;
    const ended = todayKey > ch.endKey;
    const base = {
        id: String(ch._id),
        type: ch.type,
        title: meta.title || ch.type,
        description: meta.description || "",
        params: ch.params || {},
        startKey: ch.startKey,
        endKey: ch.endKey,
        xpReward: ch.xpReward,
        status: ch.status,
        started,
        daysLeft: Math.max(0, daysBetween(todayKey, ch.endKey) + (started ? 1 : 0)),
        startsIn: started ? 0 : daysBetween(todayKey, ch.startKey),
        createdAt: ch.createdAt,
        finishedAt: ch.finishedAt,
    };
    const spendOf = (k) => spendByDay[k] || 0;
    let status = "active";
    let progress = 0;
    let summary = "";
    let days = null;

    if (ch.type === "batas-harian" || ch.type === "tanpa-jajan-3" || ch.type === "akhir-pekan") {
        const keys = rangeKeys(ch.startKey, ch.endKey);
        const limit = ch.type === "batas-harian" ? ch.params?.dailyLimit || 0 : 0;
        days = keys.map((k) => {
            const spend = spendOf(k);
            let state = "future";
            if (k < todayKey) state = spend <= limit ? "ok" : "fail";
            else if (k === todayKey) state = spend <= limit ? "today" : "fail";
            return { key: k, spend, state };
        });

        if (ch.type === "tanpa-jajan-3") {
            // Hari tanpa jajan dihitung saat harinya selesai
            const zero = days.filter((d) => d.state === "ok").length;
            const remaining = days.filter((d) => d.state === "future" || d.state === "today").length;
            progress = Math.min(1, zero / 3);
            summary = `${Math.min(zero, 3)} dari 3 hari tanpa jajan`;
            if (zero >= 3) status = "completed";
            else if (ended || zero + remaining < 3) status = "failed";
            // Hari ini dengan pengeluaran tidak menggagalkan, cuma tidak dihitung
            days = days.map((d) => (d.state === "fail" ? { ...d, state: "miss" } : d));
        } else {
            const failed = days.some((d) => d.state === "fail");
            const ok = days.filter((d) => d.state === "ok").length;
            progress = ok / keys.length;
            summary =
                ch.type === "batas-harian"
                    ? `${ok} dari ${keys.length} hari di bawah batas`
                    : started
                      ? `${ok} dari 2 hari tanpa pengeluaran`
                      : `Mulai Sabtu, ${base.startsIn} hari lagi`;
            if (failed) status = "failed";
            else if (ended) status = "completed";
        }
    } else if (ch.type === "sisa-bulan") {
        const mk = ch.startKey.slice(0, 7);
        const m = ctx.monthFlow[mk] || { income: 0, expense: 0 };
        const rate = m.income > 0 ? ((m.income - m.expense) / m.income) * 100 : 0;
        const target = ch.params?.targetRate || 20;
        progress = Math.max(0, Math.min(1, rate / target));
        summary = m.income > 0 ? `Sisa ${Math.round(rate)}% dari target ${target}%` : `Belum ada pemasukan bulan ini · target ${target}%`;
        base.current = Math.round(rate * 10) / 10;
        base.target = target;
        if (ended) status = rate >= target && m.income > 0 ? "completed" : "failed";
    } else if (ch.type === "52-minggu") {
        const amount = ch.params?.baseAmount || 10000;
        const saved = ctx.goalNetSince(ch.startKey);
        const week = Math.min(52, Math.floor(daysBetween(ch.startKey, todayKey) / 7) + 1);
        const finalTarget = amount * 1378;
        const dueSoFar = (amount * week * (week + 1)) / 2;
        progress = Math.max(0, Math.min(1, saved / finalTarget));
        base.week = week;
        base.saved = saved;
        base.dueSoFar = dueSoFar;
        base.thisWeek = amount * week;
        base.finalTarget = finalTarget;
        base.onTrack = saved >= dueSoFar;
        summary = `Minggu ${week} dari 52`;
        if (saved >= finalTarget) status = "completed";
        else if (ended) status = "failed";
    }

    return { ...base, status: ch.status === "active" ? status : ch.status, progress, summary, days };
}

// ── Hitung semuanya ─────────────────────────────────────────────────
async function computeGamification(userId) {
    const now = new Date();
    const todayKey = dayKey(now);
    const weekKey = mondayOf(todayKey);
    const hourWib = new Date(now.getTime() + TZ_OFFSET_MS).getUTCHours();
    const since30Key = addDays(todayKey, -30);

    const loaded = await loadData(userId, now);
    const { datedTx, budgets, goals, goldCount, claims, challenges } = loaded;
    // Transaksi hasil impor mutasi bank tetap dihitung untuk keuangan,
    // tapi tidak memberi XP, hari aktif, streak, atau progres misi.
    const allTx = loaded.allTx.filter((t) => !(t.tags || []).includes("impor"));

    // Transfer tercatat dua baris; hitung sebagai satu catatan
    const logical = allTx.filter((t) => !(t.isTransfer && t.type === "income"));

    // ── Hari aktif & streak ─────────────────────────────
    const days = new Set(allTx.map((t) => dayKey(t.createdAt)));
    const streak = computeStreak(days, todayKey);
    const activeDays30 = [...days].filter((d) => d > since30Key).length;

    // ── Arus uang (tanpa transfer & tanpa setoran goal) ──
    const spendByDay = {}; // jajan harian: tanpa tagihan rutin
    const monthFlow = {};
    const goalRows = [];
    let inc30 = 0;
    let exp30 = 0;
    for (const t of datedTx) {
        if (t.debtId) continue; // utang-piutang bukan jajan maupun pemasukan
        if (t.goalId) {
            goalRows.push(t);
            continue;
        }
        const dk = dayKey(t.date);
        const mk = dk.slice(0, 7);
        monthFlow[mk] = monthFlow[mk] || { income: 0, expense: 0 };
        monthFlow[mk][t.type] += t.amount;
        if (dk > since30Key) {
            if (t.type === "income") inc30 += t.amount;
            else exp30 += t.amount;
        }
        if (t.type === "expense" && !t.isRecurring) spendByDay[dk] = (spendByDay[dk] || 0) + t.amount;
    }
    const goalNetSince = (startKey) =>
        goalRows.reduce((sum, t) => {
            if (dayKey(t.date) < startKey) return sum;
            return sum + (t.type === "expense" ? t.amount : -t.amount);
        }, 0);

    const savingRate30 = inc30 > 0 ? ((inc30 - exp30) / inc30) * 100 : 0;
    const rateOf = (m) => (m && m.income > 0 ? ((m.income - m.expense) / m.income) * 100 : null);

    const currentMonthKey = todayKey.slice(0, 7);
    const pastMonths = [];
    {
        const [y, m] = currentMonthKey.split("-").map(Number);
        for (let i = 1; i <= 12; i += 1) pastMonths.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
    }
    let frugalMonthStreak = 0;
    for (const mk of pastMonths) {
        const r = rateOf(monthFlow[mk]);
        if (r !== null && r >= 20) frugalMonthStreak += 1;
        else break;
    }
    const frugalMonths12 = pastMonths.filter((mk) => (rateOf(monthFlow[mk]) ?? -1) >= 20).length;

    // ── Budget ─────────────────────────────────────────
    const [cy, cm] = currentMonthKey.split("-").map(Number);
    const budgetsThis = budgets.filter((b) => b.year === cy && b.month === cm);
    const budgetsOverThisMonth = budgetsThis.filter((b) => b.spent > b.limit).length;
    const budgetMonths = {};
    for (const b of budgets) {
        if (b.year > cy || (b.year === cy && b.month >= cm)) continue; // hanya bulan yang sudah lewat
        const k = `${b.year}-${b.month}`;
        budgetMonths[k] = budgetMonths[k] || { total: 0, over: 0 };
        budgetMonths[k].total += 1;
        if (b.spent > b.limit) budgetMonths[k].over += 1;
    }
    const safeBudgetMonths = Object.values(budgetMonths).filter((m) => m.total > 0 && m.over === 0).length;
    const budgetsKept = budgets.filter((b) => (b.year < cy || (b.year === cy && b.month < cm)) && b.spent <= b.limit).length;

    const goalsCompleted = goals.filter((g) => g.status === "completed").length;
    const activeGoals = goals.filter((g) => g.status === "active").length;

    // ── Tantangan: nilai & simpan perubahan status ─────
    const evalCtx = { todayKey, spendByDay, monthFlow, goalNetSince };
    const evaluated = challenges.map((c) => evaluateChallenge(c, evalCtx));
    const changed = evaluated.filter((e, i) => challenges[i].status === "active" && e.status !== "active");
    if (changed.length) {
        await Promise.all(
            changed.map((e) => Challenge.updateOne({ _id: e.id, status: "active" }, { status: e.status, finishedAt: now })),
        );
        changed.forEach((e) => {
            e.finishedAt = now;
            e.justFinished = true;
        });
    }
    const challengesCompleted = evaluated.filter((e) => e.status === "completed");

    const questsClaimed = claims.length;

    const stats = {
        totalTx: logical.length,
        activeDaysTotal: days.size,
        activeDays30,
        streak: streak.current,
        bestStreak: streak.best,
        shieldSaves: streak.savedDays.length,
        savingRate30: Math.round(savingRate30 * 10) / 10,
        frugalMonthStreak,
        frugalMonths12,
        budgetsThisMonth: budgetsThis.length,
        budgetsOverThisMonth,
        safeBudgetMonths,
        goalsTotal: goals.length,
        goalsCompleted,
        hasGold: goldCount > 0,
        questsClaimed,
        challengesCompleted: challengesCompleted.length,
    };

    // ── Persona ────────────────────────────────────────
    const requirements = buildRequirements(stats);
    let tier = 0;
    while (tier < PERSONAS.length - 1 && requirements[PERSONAS[tier + 1]].every((r) => r.met)) tier += 1;
    const nextPersona = PERSONAS[tier + 1] || null;

    // ── Misi ───────────────────────────────────────────
    const todayRows = logical.filter((t) => dayKey(t.createdAt) === todayKey);
    const weekRows = logical.filter((t) => dayKey(t.createdAt) >= weekKey);
    const past30 = rangeKeys(addDays(todayKey, -30), addDays(todayKey, -1));
    const avgDailySpend = past30.reduce((s, k) => s + (spendByDay[k] || 0), 0) / 30;
    const lastWeekKeys = rangeKeys(addDays(weekKey, -7), addDays(weekKey, -1));
    const thisWeekKeys = rangeKeys(weekKey, todayKey);
    const quests = buildQuests({
        userId: String(userId),
        todayKey,
        weekKey,
        hourWib,
        todayRows,
        weekRows,
        claims,
        activeGoals,
        avgDailySpend,
        spendToday: spendByDay[todayKey] || 0,
        weekSpend: thisWeekKeys.reduce((s, k) => s + (spendByDay[k] || 0), 0),
        lastWeekSpend: lastWeekKeys.reduce((s, k) => s + (spendByDay[k] || 0), 0),
        budgetsThisMonth: budgetsThis.length,
        budgetsOverThisMonth,
    });

    // ── XP & level ─────────────────────────────────────
    const xpBreakdown = {
        activeDays: days.size * 10,
        transactions: Math.min(logical.length, 2000) * 2,
        bestStreak: streak.best * 5,
        quests: claims.reduce((s, c) => s + c.xp, 0),
        challenges: challengesCompleted.reduce((s, c) => s + (c.xpReward || 0), 0),
        frugalMonths: frugalMonths12 * 100,
        budgetsKept: budgetsKept * 30,
        goalsCompleted: goalsCompleted * 150,
        gold: goldCount > 0 ? 50 : 0,
    };
    const xp = Object.values(xpBreakdown).reduce((a, b) => a + b, 0);
    const level = levelFromXp(xp);
    const xpToday =
        (streak.activeToday ? 10 : 0) +
        todayRows.length * 2 +
        claims.filter((c) => dayKey(c.createdAt) === todayKey).reduce((s, c) => s + c.xp, 0) +
        evaluated
            .filter((e) => e.status === "completed" && e.finishedAt && dayKey(e.finishedAt) === todayKey)
            .reduce((s, e) => s + (e.xpReward || 0), 0);

    const activeTypes = new Set(evaluated.filter((e) => e.status === "active").map((e) => e.type));

    return {
        persona: PERSONAS[tier],
        tier: tier + 1,
        nextPersona,
        nextRequirements: nextPersona ? requirements[nextPersona] : [],
        requirements,
        stats,
        streak,
        xp,
        xpToday,
        xpBreakdown,
        level,
        levelTitle: levelTitle(level),
        levelStartXp: xpForLevel(level),
        nextLevelXp: xpForLevel(level + 1),
        quests,
        challenges: {
            active: evaluated.filter((e) => e.status === "active"),
            history: evaluated.filter((e) => e.status !== "active").slice(0, 12),
            catalog: CHALLENGE_CATALOG.map((c) => ({ ...c, joined: activeTypes.has(c.type) })),
            maxActive: MAX_ACTIVE_CHALLENGES,
        },
        badges: BADGES(stats),
    };
}

// ── Handler ─────────────────────────────────────────────────────────
const getGamification = async (req, res) => {
    try {
        res.json(await computeGamification(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const claimQuest = async (req, res) => {
    try {
        const g = await computeGamification(req.user._id);
        const quest = [...g.quests.daily, ...g.quests.weekly].find((q) => q.id === req.params.questId);
        if (!quest) return res.status(404).json({ message: "Misi ini tidak ada di periode sekarang." });
        if (quest.claimed) return res.status(409).json({ message: "Misi ini sudah diklaim." });
        if (!quest.complete) return res.status(400).json({ message: quest.lockedUntil || "Misi belum selesai." });

        try {
            await QuestClaim.create({
                user: req.user._id,
                questId: quest.id,
                scope: quest.scope,
                period: quest.period,
                xp: quest.xp,
            });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ message: "Misi ini sudah diklaim." });
            throw e;
        }
        res.json({ gained: quest.xp, quest: { id: quest.id, title: quest.title }, gamification: await computeGamification(req.user._id) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const joinChallenge = async (req, res) => {
    try {
        const { type, params = {} } = req.body || {};
        const meta = catalogByType[type];
        if (!meta) return res.status(400).json({ message: "Jenis tantangan tidak dikenal." });

        const active = await Challenge.find({ user: req.user._id, status: "active" }).select("type").lean();
        if (active.some((c) => c.type === type)) return res.status(409).json({ message: "Kamu sedang mengikuti tantangan ini." });
        if (active.length >= MAX_ACTIVE_CHALLENGES)
            return res.status(400).json({ message: `Maksimal ${MAX_ACTIVE_CHALLENGES} tantangan aktif sekaligus.` });

        const todayKey = dayKey(new Date());
        let startKey = todayKey;
        let endKey;
        let xpReward = meta.xp;
        const clean = {};

        if (type === "batas-harian") {
            const limit = Math.round(Number(params.dailyLimit));
            if (!Number.isFinite(limit) || limit < 1000) return res.status(400).json({ message: "Batas harian minimal Rp1.000." });
            clean.dailyLimit = limit;
            endKey = addDays(startKey, 6);
        } else if (type === "tanpa-jajan-3") {
            endKey = addDays(startKey, 6);
        } else if (type === "akhir-pekan") {
            const dow = weekday(todayKey);
            if (dow === 6) startKey = todayKey;
            else if (dow === 0) startKey = addDays(todayKey, -1);
            else startKey = addDays(todayKey, 6 - dow);
            endKey = addDays(startKey, 1);
        } else if (type === "sisa-bulan") {
            const rate = Number(params.targetRate);
            if (!SISA_REWARD[rate]) return res.status(400).json({ message: "Pilih target 20%, 30%, atau 40%." });
            clean.targetRate = rate;
            xpReward = SISA_REWARD[rate];
            // Kalau bulan ini tinggal < 7 hari, tantangan berlaku untuk bulan depan
            if (daysBetween(todayKey, monthEndKey(todayKey)) < 6) startKey = addDays(monthEndKey(todayKey), 1);
            endKey = monthEndKey(startKey);
        } else if (type === "52-minggu") {
            const base = Math.round(Number(params.baseAmount));
            if (!Number.isFinite(base) || base < 1000) return res.status(400).json({ message: "Nominal dasar minimal Rp1.000." });
            clean.baseAmount = base;
            endKey = addDays(startKey, 52 * 7 - 1);
        }

        await Challenge.create({ user: req.user._id, type, params: clean, startKey, endKey, xpReward });
        res.status(201).json({ gamification: await computeGamification(req.user._id) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const abandonChallenge = async (req, res) => {
    try {
        const ch = await Challenge.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, status: "active" },
            { status: "abandoned", finishedAt: new Date() },
        );
        if (!ch) return res.status(404).json({ message: "Tantangan aktif tidak ditemukan." });
        res.json({ gamification: await computeGamification(req.user._id) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getGamification,
    claimQuest,
    joinChallenge,
    abandonChallenge,
    // diekspor untuk pengujian
    _internal: { computeStreak, evaluateChallenge, buildQuests, dayKey, addDays, mondayOf },
};
