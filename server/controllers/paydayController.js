const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Recurring = require("../models/Recurring");
const Transaction = require("../models/Transaction");

/*
 * Sisa aman sampai gajian
 * ───────────────────────
 * Uang yang bisa dipakai = saldo wallet likuid (cash, bank, e-wallet, lainnya)
 *   − tagihan rutin yang jatuh sebelum gajian berikutnya.
 * Jatah harian = uang yang bisa dipakai ÷ sisa hari sampai gajian.
 * Belanja harian dihitung tanpa transfer, setoran goal, utang-piutang, dan tagihan rutin.
 */

const TZ = 7 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const LIQUID = ["cash", "bank", "e-wallet", "other"];

const keyOf = (d) => new Date(new Date(d).getTime() + TZ).toISOString().slice(0, 10);
const startOf = (key) => new Date(Date.parse(key) - TZ);
const addDays = (key, n) => new Date(Date.parse(key) + n * DAY).toISOString().slice(0, 10);
const between = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // m: 0-11
const payKey = (y, m, day) => {
    const yy = y + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    const d = Math.min(day, daysInMonth(yy, mm));
    return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

function cycleFor(todayKey, day) {
    const [y, m] = todayKey.split("-").map(Number);
    const thisMonth = payKey(y, m - 1, day);
    if (todayKey < thisMonth) return { last: payKey(y, m - 2, day), next: thisMonth };
    return { last: thisMonth, next: payKey(y, m, day) };
}

function advance(date, frequency) {
    const d = new Date(date);
    if (frequency === "daily") d.setUTCDate(d.getUTCDate() + 1);
    else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
    else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
}

const isSpending = (t) => t.type === "expense" && !t.isTransfer && !t.goalId && !t.debtId && !t.isRecurring;

function computePayday({ payday, todayKey, wallets, recurrings, cycleTx }) {
    const { last, next } = cycleFor(todayKey, payday);
    const daysLeft = Math.max(1, between(todayKey, next)); // hari ini ikut dihitung
    const cycleLength = between(last, next);
    const dayOfCycle = between(last, todayKey) + 1;

    const liquidWallets = wallets.filter((w) => LIQUID.includes(w.type) && !w.isArchived);
    const liquid = liquidWallets.reduce((s, w) => s + (w.balance || 0), 0);

    // Tagihan rutin sampai sebelum gajian (bisa lebih dari sekali untuk mingguan/harian)
    const nextStart = startOf(next);
    const todayStart = startOf(todayKey);
    const bills = [];
    for (const r of recurrings) {
        if (r.type !== "expense" || !r.isActive) continue;
        let d = new Date(r.nextRunDate);
        let guard = 0;
        while (d < nextStart && guard < 62) {
            if (d >= todayStart && (!r.endDate || d <= new Date(r.endDate))) {
                bills.push({
                    id: String(r._id),
                    name: r.description || r.category?.name || "Tagihan rutin",
                    amount: r.amount,
                    date: keyOf(d),
                });
            }
            d = advance(d, r.frequency);
            guard += 1;
        }
    }
    bills.sort((a, b) => a.date.localeCompare(b.date));
    const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

    // Belanja harian di siklus ini
    const byDay = {};
    for (const t of cycleTx) {
        if (!isSpending(t)) continue;
        const k = keyOf(t.date);
        byDay[k] = (byDay[k] || 0) + t.amount;
    }
    const spentToday = byDay[todayKey] || 0;
    const series = [];
    for (let k = last; k < next; k = addDays(k, 1)) {
        series.push({ key: k, spend: k <= todayKey ? byDay[k] || 0 : null, future: k > todayKey });
    }
    const pastDays = series.filter((s) => s.key < todayKey);
    const spentCycle = series.reduce((s, x) => s + (x.spend || 0), 0);
    const avgDaily = pastDays.length ? pastDays.reduce((s, x) => s + x.spend, 0) / pastDays.length : spentToday;

    const spendable = liquid - billsTotal;
    // Saldo sekarang sudah dipotong belanja hari ini; jatah hari ini dihitung dari awal hari
    const dailyAllowance = Math.max(0, (spendable + spentToday) / daysLeft);
    const leftToday = dailyAllowance - spentToday;
    const projectedLeft = spendable - avgDaily * Math.max(0, daysLeft - 1);

    let status = "aman";
    if (spendable <= 0) status = "minus";
    else if (projectedLeft < 0 || leftToday < 0) status = "waspada";

    return {
        configured: true,
        payday,
        lastPayday: last,
        nextPayday: next,
        daysLeft,
        cycleLength,
        dayOfCycle,
        liquid,
        liquidWallets: liquidWallets.map((w) => ({ id: String(w._id), name: w.name, balance: w.balance || 0 })),
        bills,
        billsTotal,
        spendable,
        dailyAllowance: Math.round(dailyAllowance),
        spentToday,
        leftToday: Math.round(leftToday),
        isPayday: todayKey === last,
        avgDaily: Math.round(avgDaily),
        spentCycle,
        projectedLeft: Math.round(projectedLeft),
        status,
        series,
    };
}

const getPayday = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("payday").lean();
        if (!user?.payday) return res.json({ configured: false });
        const todayKey = keyOf(new Date());
        const { last } = cycleFor(todayKey, user.payday);
        const [wallets, recurrings, cycleTx] = await Promise.all([
            Wallet.find({ user: req.user._id }).select("name type balance isArchived").lean(),
            Recurring.find({ user: req.user._id, isActive: true }).populate("category", "name").lean(),
            Transaction.find({ user: req.user._id, isDeleted: false, date: { $gte: startOf(last) } })
                .select("type amount date isTransfer goalId debtId isRecurring")
                .lean(),
        ]);
        res.json(computePayday({ payday: user.payday, todayKey, wallets, recurrings, cycleTx }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getPayday, _internal: { computePayday, cycleFor } };
