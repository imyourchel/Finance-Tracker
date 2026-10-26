const mongoose = require("mongoose");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");

/*
 * Budget DailyTrack
 * ─────────────────
 * - "spent" dihitung ulang langsung dari transaksi tiap kali budget dibuka,
 *   jadi tidak bisa melenceng walau ada transaksi yang diedit/dihapus.
 * - Rollover: sisa budget bulan lalu (kalau positif) ditambahkan ke batas
 *   bulan ini. Berantai — sisa bulan lalu sudah termasuk rollover sebelumnya.
 * - Analitik per budget: sisa per hari, laju harian, proyeksi akhir bulan,
 *   rata-rata 3 bulan terakhir, dan status (aman / waspada / bahaya / jebol).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const ymKey = (y, m) => `${y}-${m}`;

// Geser bulan: shift(2026, 1, -1) → { year: 2025, month: 12 }
const shift = (year, month, delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

// Total pengeluaran per kategori per bulan dalam rentang [from, to] (inklusif)
async function spendingByCategoryMonth(userId, from, to) {
    const start = new Date(from.year, from.month - 1, 1);
    const end = new Date(to.year, to.month, 0, 23, 59, 59, 999);
    const rows = await Transaction.aggregate([
        {
            $match: {
                user: oid(userId),
                type: "expense",
                isDeleted: false,
                isTransfer: { $ne: true },
                category: { $ne: null },
                date: { $gte: start, $lte: end },
            },
        },
        {
            $group: {
                _id: {
                    category: "$category",
                    year: { $year: { date: "$date", timezone: "+07:00" } },
                    month: { $month: { date: "$date", timezone: "+07:00" } },
                },
                total: { $sum: "$amount" },
            },
        },
    ]);
    const map = new Map();
    for (const r of rows) {
        map.set(`${r._id.category}|${ymKey(r._id.year, r._id.month)}`, r.total);
    }
    return (categoryId, year, month) => map.get(`${categoryId}|${ymKey(year, month)}`) || 0;
}

// Info kalender bulan yang dilihat, relatif ke hari ini (WIB)
function monthClock(year, month) {
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const ty = nowWib.getUTCFullYear();
    const tm = nowWib.getUTCMonth() + 1;
    const td = nowWib.getUTCDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    let phase = "current";
    if (year < ty || (year === ty && month < tm)) phase = "past";
    else if (year > ty || (year === ty && month > tm)) phase = "future";
    const daysElapsed = phase === "past" ? daysInMonth : phase === "future" ? 0 : td;
    const daysLeft = phase === "past" ? 0 : phase === "future" ? daysInMonth : daysInMonth - td + 1;
    return { phase, daysInMonth, daysElapsed, daysLeft, today: td };
}

const roundUp = (n, step = 10000) => Math.ceil(n / step) * step;

// GET /budgets?month&year — daftar budget + analitik per budget
const getBudgets = async (req, res) => {
    try {
        const now = new Date();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const year = Number(req.query.year) || now.getFullYear();
        const userId = req.user._id;

        const budgets = await Budget.find({ user: userId, month, year }).populate(
            "category",
            "name icon color",
        );
        if (budgets.length === 0) return res.json([]);

        // 12 bulan ke belakang cukup untuk rantai rollover & rata-rata 3 bulan
        const from = shift(year, month, -12);
        const spentOf = await spendingByCategoryMonth(userId, from, { year, month });

        const categoryIds = budgets.map((b) => b.category?._id || b.category);
        const history = await Budget.find({
            user: userId,
            category: { $in: categoryIds },
            $or: [{ year: { $gt: from.year } }, { year: from.year, month: { $gte: from.month } }],
        })
            .select("category limit month year rollover")
            .lean();
        const histMap = new Map(history.map((h) => [`${h.category}|${ymKey(h.year, h.month)}`, h]));

        // Sisa yang terbawa ke bulan (y, m) untuk kategori c
        const carryInto = (c, y, m, depth = 0) => {
            const cur = histMap.get(`${c}|${ymKey(y, m)}`);
            if (!cur || !cur.rollover || depth > 11) return 0;
            const prev = shift(y, m, -1);
            const p = histMap.get(`${c}|${ymKey(prev.year, prev.month)}`);
            if (!p) return 0;
            const prevLimit = p.limit + carryInto(c, prev.year, prev.month, depth + 1);
            return Math.max(0, prevLimit - spentOf(c, prev.year, prev.month));
        };

        const clock = monthClock(year, month);
        const updates = [];

        const result = budgets.map((b) => {
            const cId = String(b.category?._id || b.category);
            const spent = spentOf(cId, year, month);
            if (spent !== b.spent) updates.push({ updateOne: { filter: { _id: b._id }, update: { spent } } });

            const carryIn = carryInto(cId, year, month);
            const effectiveLimit = b.limit + carryIn;
            const remaining = effectiveLimit - spent;
            const percentage = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 0;

            const dailyRate = clock.daysElapsed > 0 ? spent / clock.daysElapsed : 0;
            const projected = clock.phase === "current" ? Math.round(dailyRate * clock.daysInMonth) : spent;
            const perDayLeft = clock.daysLeft > 0 ? Math.max(0, remaining) / clock.daysLeft : 0;

            const last3 = [1, 2, 3].map((i) => {
                const p = shift(year, month, -i);
                return spentOf(cId, p.year, p.month);
            });
            const avg3 = Math.round(last3.reduce((a, v) => a + v, 0) / 3);

            let status = "safe";
            if (spent > effectiveLimit) status = "over";
            else if (clock.phase === "current" && projected > effectiveLimit && clock.daysElapsed >= 3) status = "danger";
            else if (percentage >= (b.alertThreshold || 80)) status = "warn";

            return {
                ...b.toObject(),
                spent,
                carryIn,
                effectiveLimit,
                remaining,
                percentage,
                isOverBudget: spent > effectiveLimit,
                dailyRate: Math.round(dailyRate),
                projected,
                projectedOver: Math.max(0, projected - effectiveLimit),
                perDayLeft: Math.round(perDayLeft),
                avg3,
                last3,
                status,
                clock,
            };
        });

        if (updates.length) await Budget.bulkWrite(updates);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /budgets/suggestions?month&year — saran batas dari rata-rata 3 bulan terakhir
const getSuggestions = async (req, res) => {
    try {
        const now = new Date();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const year = Number(req.query.year) || now.getFullYear();
        const userId = req.user._id;

        const from = shift(year, month, -3);
        const to = shift(year, month, -1);
        const start = new Date(from.year, from.month - 1, 1);
        const end = new Date(to.year, to.month, 0, 23, 59, 59, 999);

        const [rows, existing] = await Promise.all([
            Transaction.aggregate([
                {
                    $match: {
                        user: oid(userId),
                        type: "expense",
                        isDeleted: false,
                        isTransfer: { $ne: true },
                        category: { $ne: null },
                        date: { $gte: start, $lte: end },
                    },
                },
                {
                    $group: {
                        _id: {
                            category: "$category",
                            month: { $month: { date: "$date", timezone: "+07:00" } },
                        },
                        total: { $sum: "$amount" },
                    },
                },
                {
                    $group: {
                        _id: "$_id.category",
                        total: { $sum: "$total" },
                        months: { $sum: 1 },
                        peak: { $max: "$total" },
                    },
                },
                { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
                { $unwind: "$category" },
                { $sort: { total: -1 } },
            ]),
            Budget.find({ user: userId, month, year }).select("category").lean(),
        ]);

        const has = new Set(existing.map((b) => String(b.category)));
        const suggestions = rows.map((r) => {
            const average = Math.round(r.total / 3);
            return {
                category: {
                    _id: r.category._id,
                    name: r.category.name,
                    icon: r.category.icon,
                    color: r.category.color,
                },
                average,
                peak: r.peak,
                monthsWithSpending: r.months,
                // Sedikit di bawah rata-rata supaya tetap ada dorongan berhemat
                suggested: Math.max(10000, roundUp(average * 0.95)),
                hasBudget: has.has(String(r._id)),
            };
        });

        res.json({ from, to, suggestions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Hitung pengeluaran kategori pada bulan tertentu (dipakai saat membuat budget)
async function spentForMonth(userId, categoryId, year, month) {
    const getter = await spendingByCategoryMonth(userId, { year, month }, { year, month });
    return getter(String(categoryId), year, month);
}

// POST buat budget baru
const createBudget = async (req, res) => {
    try {
        const { categoryId, limit, month, year, alertThreshold, rollover, note } = req.body;

        const exists = await Budget.findOne({ user: req.user._id, category: categoryId, month, year });
        if (exists) return res.status(400).json({ message: "Budget kategori ini sudah ada" });

        const alreadySpent = await spentForMonth(req.user._id, categoryId, Number(year), Number(month));

        const budget = await Budget.create({
            user: req.user._id,
            category: categoryId,
            limit,
            spent: alreadySpent,
            month,
            year,
            alertThreshold: alertThreshold || 80,
            rollover: Boolean(rollover),
            note: note || "",
        });

        await budget.populate("category", "name icon color");
        res.status(201).json(budget);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /budgets/copy-previous { month, year } — salin budget bulan lalu ke bulan ini
const copyPreviousBudgets = async (req, res) => {
    try {
        const month = Number(req.body.month);
        const year = Number(req.body.year);
        if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun wajib diisi" });

        const prev = shift(year, month, -1);
        const [source, existing] = await Promise.all([
            Budget.find({ user: req.user._id, month: prev.month, year: prev.year }).lean(),
            Budget.find({ user: req.user._id, month, year }).select("category").lean(),
        ]);
        if (source.length === 0)
            return res.status(404).json({ message: "Bulan lalu belum punya budget untuk disalin" });

        const has = new Set(existing.map((b) => String(b.category)));
        const getter = await spendingByCategoryMonth(req.user._id, { year, month }, { year, month });
        const docs = source
            .filter((b) => !has.has(String(b.category)))
            .map((b) => ({
                user: req.user._id,
                category: b.category,
                limit: b.limit,
                spent: getter(String(b.category), year, month),
                month,
                year,
                alertThreshold: b.alertThreshold || 80,
                rollover: Boolean(b.rollover),
                note: b.note || "",
            }));
        if (docs.length) await Budget.insertMany(docs);
        res.status(201).json({ created: docs.length, skipped: source.length - docs.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT update budget
const updateBudget = async (req, res) => {
    try {
        const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
        if (!budget) return res.status(404).json({ message: "Budget tidak ditemukan" });

        const { limit, alertThreshold, rollover, note } = req.body;
        if (limit !== undefined) budget.limit = limit;
        if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;
        if (rollover !== undefined) budget.rollover = Boolean(rollover);
        if (note !== undefined) budget.note = note;

        await budget.save();
        await budget.populate("category", "name icon color");
        res.json(budget);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE hapus budget
const deleteBudget = async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!budget) return res.status(404).json({ message: "Budget tidak ditemukan" });
        res.json({ message: "Budget dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getBudgets,
    getSuggestions,
    createBudget,
    copyPreviousBudgets,
    updateBudget,
    deleteBudget,
    // diekspor untuk pengujian
    _internal: { shift, monthClock, DAY_MS },
};
