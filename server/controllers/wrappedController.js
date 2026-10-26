const Transaction = require("../models/Transaction");
const { fetchRows, _h } = require("./insightsController");

/*
 * DailyTrack Wrapped
 * ──────────────────
 * Rekap satu bulan atau satu tahun dalam bentuk "cerita".
 * Aturan uang sama seperti Insights: transfer, setoran goal (goalId) dan
 * utang-piutang (debtId) bukan pemasukan/pengeluaran. Semua waktu WIB.
 */

const {
    DAY,
    MONTH_LONG,
    MONTH_SHORT,
    DOW_LONG,
    MOODS,
    normMood,
    wib,
    wibHour,
    dayKey,
    monthStart,
    shiftMonth,
    round,
    pct,
    kindOf,
    sum,
    catInfo,
    categoryBreakdown,
    rupiah,
} = _h;

const FOOD_RE = /makan|minum|kopi|coffee|food|jajan|snack|resto|kuliner|cafe|kafe/i;

// ── Periode ─────────────────────────────────────────────────────
function resolvePeriod(q, now = new Date()) {
    const today = wib(now);
    const type = q.period === "year" ? "year" : "month";
    if (type === "year") {
        const y = parseInt(q.year, 10) || today.y;
        const start = monthStart(y, 1);
        const end = monthStart(y + 1, 1);
        const prevStart = monthStart(y - 1, 1);
        return {
            type,
            year: y,
            month: null,
            start,
            end,
            prevStart,
            label: `Tahun ${y}`,
            shortLabel: String(y),
            previousLabel: String(y - 1),
            isComplete: end.getTime() <= now.getTime(),
        };
    }
    // Default: bulan lalu kalau bulan ini baru berjalan seminggu
    let y = parseInt(q.year, 10);
    let m = parseInt(q.month, 10);
    if (!y || !m) {
        const base = today.d <= 7 ? shiftMonth(today.y, today.m, -1) : { y: today.y, m: today.m };
        y = base.y;
        m = base.m;
    }
    m = Math.min(12, Math.max(1, m));
    const next = shiftMonth(y, m, 1);
    const prev = shiftMonth(y, m, -1);
    return {
        type,
        year: y,
        month: m,
        start: monthStart(y, m),
        end: monthStart(next.y, next.m),
        prevStart: monthStart(prev.y, prev.m),
        label: `${MONTH_LONG[m - 1]} ${y}`,
        shortLabel: MONTH_LONG[m - 1],
        previousLabel: `${MONTH_LONG[prev.m - 1]} ${prev.y}`,
        isComplete: monthStart(next.y, next.m).getTime() <= now.getTime(),
    };
}

// ── Kepribadian belanja ─────────────────────────────────────────
function personality({ expenses, totals, categories, biggest, weekendShare }) {
    const n = expenses.length;
    const traits = [];
    const add = (score, id, title, emoji, description) => traits.push({ score, id, title, emoji, description });

    if (n >= 5) {
        const morningSmallFood = expenses.filter(
            (t) => wibHour(t.date) >= 5 && wibHour(t.date) < 11 && t.amount <= 60000 && FOOD_RE.test(catInfo(t).name + " " + (t.description || "")),
        ).length;
        if (morningSmallFood / n >= 0.25 && morningSmallFood >= 4)
            add(90, "kopi-pagi", "Si Kopi Pagi", "☕", "Harimu dimulai dengan jajan kecil di pagi hari. Kecil-kecil, tapi kalau dijumlah lumayan juga.");

        const late = expenses.filter((t) => wibHour(t.date) >= 21 || wibHour(t.date) < 3).length;
        if (late / n >= 0.25 && late >= 4)
            add(85, "tengah-malam", "Si Belanja Tengah Malam", "🌙", "Dompetmu paling aktif saat orang lain tidur. Checkout tengah malam memang menggoda.");

        const amounts = expenses.map((t) => t.amount).sort((a, b) => a - b);
        const median = amounts[Math.floor(amounts.length / 2)];
        if (n >= 30 && median <= 30000)
            add(70, "receh", "Si Receh Rajin", "🪙", "Banyak transaksi kecil yang rajin kamu catat. Detail adalah kekuatanmu.");
    }
    if (weekendShare >= 45 && n >= 6)
        add(80, "weekend", "Raja Akhir Pekan", "🎉", "Hampir separuh belanjamu terjadi Sabtu-Minggu. Weekday hemat, weekend bebas.");
    if (totals.savingRate !== null && totals.savingRate >= 30)
        add(95, "penabung", "Si Penabung Ulung", "🐷", "Sepertiga atau lebih pemasukanmu tetap utuh. Ini kebiasaan yang langka.");
    if (biggest && totals.expense > 0 && biggest.amount / totals.expense >= 0.3)
        add(75, "sekali-gesek", "Sultan Sekali Gesek", "💳", "Satu pembelian besar mendominasi pengeluaranmu. Semoga sepadan!");
    const recurring = expenses.filter((t) => t.isRecurring).reduce((a, t) => a + t.amount, 0);
    if (totals.expense > 0 && recurring / totals.expense >= 0.5)
        add(65, "langganan", "Si Tagihan Tertib", "🧾", "Sebagian besar uangmu keluar untuk tagihan rutin. Teratur dan bisa diprediksi.");
    if (categories[0] && categories[0].share >= 45 && FOOD_RE.test(categories[0].name))
        add(78, "kuliner", "Penjelajah Kuliner", "🍜", `Hampir separuh pengeluaranmu untuk ${categories[0].name.toLowerCase()}. Lidahmu yang pegang kendali.`);

    traits.sort((a, b) => b.score - a.score);
    const main = traits[0] || {
        id: "seimbang",
        title: "Si Seimbang",
        emoji: "⚖️",
        description: "Tidak ada pola ekstrem. Pengeluaranmu tersebar wajar di banyak hal.",
    };
    return { ...main, score: undefined, others: traits.slice(1, 3).map((t) => ({ id: t.id, title: t.title, emoji: t.emoji })) };
}

// ── Saran penutup ───────────────────────────────────────────────
function buildTips({ totals, categories, mood, noSpendDays, days }) {
    const tips = [];
    if (totals.savingRate === null) tips.push("Catat pemasukanmu juga, supaya rasio tabungan bisa dihitung.");
    else if (totals.savingRate < 20)
        tips.push(`Sisa uangmu ${Math.max(0, Math.round(totals.savingRate))}%. Coba sisihkan 20% di awal begitu gajian masuk.`);
    else tips.push(`Sisa uangmu ${Math.round(totals.savingRate)}%. Pindahkan sebagian ke goal supaya tidak terpakai.`);

    const top = categories[0];
    if (top && top.share >= 30)
        tips.push(`${top.name} menyerap ${Math.round(top.share)}% pengeluaran. Pasang budget untuk kategori ini.`);
    else if (mood && MOODS[mood.id]?.tone === "emotional")
        tips.push(`Mood paling sering saat belanja adalah "${mood.label.toLowerCase()}". Beri jeda 10 menit sebelum checkout.`);
    else if (days > 0 && noSpendDays / days < 0.15)
        tips.push("Tantang dirimu: 1 hari tanpa jajan setiap minggu.");
    return tips.slice(0, 2);
}

// ── Hitung Wrapped ──────────────────────────────────────────────
function computeWrapped(rows, createdRows, period, now = new Date()) {
    const startMs = period.start.getTime();
    const endMs = period.end.getTime();
    const inCur = (t) => {
        const ms = new Date(t.date).getTime();
        return ms >= startMs && ms < endMs;
    };
    const cur = rows.filter(inCur);
    const prev = rows.filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= period.prevStart.getTime() && ms < startMs;
    });

    const totals = sum(cur);
    const previous = sum(prev);
    const expenses = cur.filter((t) => kindOf(t) === "expense");
    const categories = categoryBreakdown(cur, prev).filter((c) => c.total > 0);

    // Hari
    const lastMs = Math.min(endMs, now.getTime());
    const days = Math.max(0, Math.ceil((lastMs - startMs) / DAY));
    const dayMap = new Map();
    for (const t of expenses) {
        const k = dayKey(t.date);
        const e = dayMap.get(k) || { date: k, total: 0, count: 0, rows: [] };
        e.total += t.amount;
        e.count += 1;
        e.rows.push(t);
        dayMap.set(k, e);
    }
    const busiest = [...dayMap.values()].sort((a, b) => b.total - a.total)[0] || null;
    const noSpendDays = Math.max(0, days - dayMap.size);

    // Hari dalam minggu
    const dow = Array.from({ length: 7 }, (_, i) => ({ dow: i, total: 0 }));
    expenses.forEach((t) => {
        dow[wib(t.date).dow].total += t.amount;
    });
    const favDow = [...dow].sort((a, b) => b.total - a.total)[0];
    const weekendShare = totals.expense ? round(((dow[0].total + dow[6].total) / totals.expense) * 100) : 0;

    // Transaksi terbesar (di luar tagihan rutin)
    const big = [...expenses].filter((t) => !t.isRecurring).sort((a, b) => b.amount - a.amount)[0] || null;
    const biggest = big && {
        amount: big.amount,
        description: big.description || "",
        date: big.date,
        category: catInfo(big),
        share: totals.expense ? round((big.amount / totals.expense) * 100) : 0,
    };

    // Aktivitas mencatat (kapan dicatat)
    const activeSet = new Set(createdRows.map((t) => dayKey(t.createdAt)));
    const sorted = [...activeSet].sort();
    let bestStreak = 0;
    let run = 0;
    let prevKey = null;
    for (const k of sorted) {
        run = prevKey && Date.parse(k) - Date.parse(prevKey) === DAY ? run + 1 : 1;
        bestStreak = Math.max(bestStreak, run);
        prevKey = k;
    }
    const logged = createdRows.filter((t) => !(t.isTransfer && t.type === "income")).length;

    // Mood
    const moodMap = new Map();
    for (const t of expenses) {
        const k = normMood(t.mood);
        if (!k) continue;
        const e = moodMap.get(k) || { id: k, ...MOODS[k], count: 0, total: 0 };
        e.count += 1;
        e.total += t.amount;
        moodMap.set(k, e);
    }
    const moodList = [...moodMap.values()].sort((a, b) => b.count - a.count || b.total - a.total);
    const taggedCount = moodList.reduce((a, x) => a + x.count, 0);
    const mood = moodList[0]
        ? {
              ...moodList[0],
              share: round((moodList[0].count / taggedCount) * 100),
              coverage: expenses.length ? round((taggedCount / expenses.length) * 100) : 0,
          }
        : null;

    const p = personality({ expenses, totals, categories, biggest, weekendShare });

    return {
        period: {
            type: period.type,
            year: period.year,
            month: period.month,
            label: period.label,
            shortLabel: period.shortLabel,
            previousLabel: period.previousLabel,
            isComplete: period.isComplete,
            start: dayKey(startMs),
            end: dayKey(endMs - DAY),
            days,
        },
        empty: cur.length === 0 && logged === 0,
        totals,
        previous,
        change: {
            income: pct(totals.income, previous.income),
            expense: pct(totals.expense, previous.expense),
        },
        topCategories: categories.slice(0, 3).map((c) => ({
            name: c.name,
            color: c.color,
            icon: c.icon,
            total: c.total,
            share: c.share,
            count: c.count,
            changePct: c.changePct,
        })),
        busiestDay: busiest && {
            date: busiest.date,
            total: busiest.total,
            count: busiest.count,
            dow: DOW_LONG[wib(Date.parse(busiest.date)).dow],
            topCategory: catInfo([...busiest.rows].sort((a, b) => b.amount - a.amount)[0]).name,
        },
        favoriteDay: favDow.total > 0 ? { dow: DOW_LONG[favDow.dow], total: favDow.total } : null,
        weekendShare,
        biggest,
        activity: {
            logged,
            activeDays: activeSet.size,
            bestStreak,
            noSpendDays,
            avgDailyExpense: days ? Math.round(totals.expense / days) : 0,
        },
        mood,
        moods: moodList.slice(0, 4).map((x) => ({ id: x.id, label: x.label, emoji: x.emoji, count: x.count })),
        personality: p,
        tips: buildTips({ totals, categories, mood, noSpendDays, days }),
    };
}

// Bulan & tahun yang punya data (untuk pemilih periode)
async function availablePeriods(userId) {
    const rows = await Transaction.aggregate([
        { $match: { user: userId, isDeleted: false } },
        {
            $group: {
                _id: {
                    y: { $year: { date: "$date", timezone: "+07:00" } },
                    m: { $month: { date: "$date", timezone: "+07:00" } },
                },
                n: { $sum: 1 },
            },
        },
        { $sort: { "_id.y": -1, "_id.m": -1 } },
        { $limit: 36 },
    ]);
    const months = rows.map((r) => ({
        year: r._id.y,
        month: r._id.m,
        label: `${MONTH_LONG[r._id.m - 1]} ${r._id.y}`,
        short: `${MONTH_SHORT[r._id.m - 1]} ${r._id.y}`,
        count: r.n,
    }));
    const years = [...new Set(months.map((x) => x.year))].sort((a, b) => b - a);
    return { months, years };
}

const getWrapped = async (req, res) => {
    try {
        const period = resolvePeriod(req.query);
        const [rows, createdRows, available] = await Promise.all([
            fetchRows(req.user._id, period.prevStart, period.end),
            Transaction.find({
                user: req.user._id,
                isDeleted: false,
                createdAt: { $gte: period.start, $lt: period.end },
            })
                .select("createdAt isTransfer type")
                .lean(),
            availablePeriods(req.user._id),
        ]);
        res.json({ ...computeWrapped(rows, createdRows, period), available });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getWrapped, computeWrapped, resolvePeriod };
