const Goal = require("../models/Goal");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

/*
 * Analitik goal
 * ─────────────
 * Setoran = transaksi EXPENSE dengan goalId, penarikan = INCOME dengan goalId
 * (lihat addSavingToGoal). Dari riwayat itu dihitung:
 * - laju setoran bersih (90 hari terakhir) → proyeksi tanggal tercapai
 * - setoran yang disarankan per minggu/bulan supaya tepat waktu
 * - health: tercapai / on-track / tertinggal / lewat deadline / belum mulai
 *   (nama 'health' supaya tidak menimpa field status milik model)
 * - milestone 25/50/75/100% beserta tanggal tercapainya
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const MILESTONES = [25, 50, 75, 100];

function analyzeGoal(goal, rows, now = new Date()) {
    const target = goal.targetAmount || 0;
    const saved = goal.currentAmount || 0;
    const remaining = Math.max(0, target - saved);
    const percentage = target > 0 ? Math.round((saved / target) * 100) : 0;
    const createdAt = new Date(goal.createdAt || now);

    // Riwayat kronologis (setor +, tarik −)
    const entries = rows
        .filter((t) => !/^Pengembalian dana/i.test(t.description || ""))
        .map((t) => ({
            _id: t._id,
            date: t.date || t.createdAt,
            amount: t.amount,
            kind: t.type === "expense" ? "deposit" : "withdraw",
            signed: t.type === "expense" ? t.amount : -t.amount,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Milestone: kapan akumulasi pertama kali melewati tiap ambang
    let running = 0;
    const reachedAt = {};
    for (const e of entries) {
        running += e.signed;
        for (const m of MILESTONES) {
            if (!reachedAt[m] && target > 0 && running >= (target * m) / 100) reachedAt[m] = e.date;
        }
    }
    const milestones = MILESTONES.map((m) => ({
        pct: m,
        amount: Math.round((target * m) / 100),
        reached: percentage >= m,
        reachedAt: percentage >= m ? reachedAt[m] || null : null,
    }));

    // Laju setoran bersih 90 hari terakhir (minimal rentang 14 hari supaya tidak meledak)
    const windowStart = new Date(Math.max(createdAt.getTime(), now.getTime() - 90 * DAY_MS));
    const net90 = entries
        .filter((e) => new Date(e.date) >= windowStart)
        .reduce((a, e) => a + e.signed, 0);
    const windowDays = Math.max(14, (now - windowStart) / DAY_MS);
    const perDay = net90 > 0 ? net90 / windowDays : 0;
    const pacePerMonth = Math.round(perDay * 30.44);
    const pacePerWeek = Math.round(perDay * 7);

    const projectedDate =
        remaining === 0 ? null : perDay > 0 ? new Date(now.getTime() + (remaining / perDay) * DAY_MS) : null;

    // Kebutuhan supaya tepat waktu
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline - now) / DAY_MS) : null;
    const weeksLeft = daysLeft !== null ? Math.max(1, daysLeft / 7) : null;
    const monthsLeft = daysLeft !== null ? Math.max(1, daysLeft / 30.44) : null;
    const neededPerWeek = deadline && remaining > 0 ? Math.ceil(remaining / weeksLeft) : 0;
    const neededPerMonth = deadline && remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;

    // Seharusnya sudah terkumpul berapa kalau menabung rata sejak dibuat
    let expectedNow = null;
    if (deadline && deadline > createdAt) {
        const frac = Math.min(1, Math.max(0, (now - createdAt) / (deadline - createdAt)));
        expectedNow = Math.round(target * frac);
    }

    let status;
    if (goal.status === "completed" || (target > 0 && saved >= target)) status = "completed";
    else if (goal.status === "paused") status = "paused";
    else if (deadline && daysLeft < 0) status = "overdue";
    else if (entries.length === 0) status = "not-started";
    else if (!deadline) status = perDay > 0 ? "steady" : "stalled";
    else if ((projectedDate && projectedDate <= deadline) || (expectedNow !== null && saved >= expectedNow))
        status = "on-track";
    else status = "behind";

    const gap = expectedNow !== null ? Math.max(0, expectedNow - saved) : 0;

    // 6 bulan terakhir: setoran bersih per bulan (untuk grafik kecil)
    const monthly = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const net = entries
            .filter((e) => {
                const x = new Date(e.date);
                return x.getFullYear() === y && x.getMonth() === m;
            })
            .reduce((a, e) => a + e.signed, 0);
        monthly.push({ year: y, month: m + 1, net });
    }

    const deposits = entries.filter((e) => e.kind === "deposit");
    return {
        percentage,
        remaining,
        health: status,
        milestones,
        nextMilestone: milestones.find((m) => !m.reached) || null,
        pacePerWeek,
        pacePerMonth,
        projectedDate,
        daysLeft,
        neededPerWeek,
        neededPerMonth,
        expectedNow,
        gap,
        monthly,
        depositCount: deposits.length,
        lastDepositAt: deposits.length ? deposits[deposits.length - 1].date : null,
        recent: entries.slice(-6).reverse().map(({ signed, ...e }) => e),
    };
}

// GET semua goal + analitiknya
const getGoals = async (req, res) => {
    try {
        const goals = await Goal.find({ user: req.user._id })
            .populate("wallet", "name icon color")
            .sort({ createdAt: -1 });

        const rows = await Transaction.find({
            user: req.user._id,
            isDeleted: false,
            goalId: { $in: goals.map((g) => g._id) },
        })
            .select("goalId type amount date createdAt description")
            .lean();
        const byGoal = new Map();
        for (const r of rows) {
            const k = String(r.goalId);
            if (!byGoal.has(k)) byGoal.set(k, []);
            byGoal.get(k).push(r);
        }

        const now = new Date();
        const result = goals.map((g) => {
            const obj = g.toObject();
            return { ...obj, ...analyzeGoal(obj, byGoal.get(String(g._id)) || [], now) };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Target per bulan dari sisa dana & sisa waktu
const monthlyTargetOf = (targetAmount, currentAmount, deadline) => {
    if (!deadline) return 0;
    const months = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / (DAY_MS * 30.44)));
    return Math.ceil(Math.max(0, targetAmount - (currentAmount || 0)) / months);
};

// POST buat goal baru
const createGoal = async (req, res) => {
    try {
        const {
            name,
            targetAmount,
            deadline,
            priority,
            walletId,
            icon,
            color,
            note,
        } = req.body;

        if (!name || !Number(targetAmount) || Number(targetAmount) <= 0)
            return res.status(400).json({ message: "Nama dan target wajib diisi" });
        const monthlyTarget = monthlyTargetOf(Number(targetAmount), 0, deadline);

        const goal = await Goal.create({
            user: req.user._id,
            name,
            targetAmount,
            currentAmount: 0,
            deadline: deadline || null,
            priority: priority || "medium",
            wallet: walletId || null,
            monthlyTarget,
            icon: icon || "target",
            color: color || "#10b981",
            note: note || "",
        });

        res.status(201).json(goal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST tambah/ambil tabungan ke/dari goal
const addSavingToGoal = async (req, res) => {
    try {
        const { amount, walletId, action } = req.body; // action: 'deposit' or 'withdraw'
        const parsed = Number(amount);
        if (Number.isNaN(parsed) || parsed <= 0)
            return res.status(400).json({ message: "Amount tidak valid" });

        const goal = await Goal.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!goal)
            return res.status(404).json({ message: "Goal tidak ditemukan" });

        if (action === "withdraw") {
            // tarik dari goal ke wallet
            if (!walletId)
                return res.status(400).json({ message: "Pilih dompet tujuan" });
            if (goal.currentAmount < parsed)
                return res
                    .status(400)
                    .json({ message: "Saldo goal tidak cukup" });

            const wallet = await Wallet.findOne({
                _id: walletId,
                user: req.user._id,
            });
            if (!wallet)
                return res
                    .status(404)
                    .json({ message: "Dompet tidak ditemukan" });

            // buat transaksi pemasukan ke wallet
            await Transaction.create({
                user: req.user._id,
                wallet: wallet._id,
                type: "income",
                amount: parsed,
                goalId: goal._id,
                description: `Tarik dari goal ${goal.name}`,
            });

            wallet.balance = (wallet.balance || 0) + parsed;
            goal.currentAmount = Math.max(0, goal.currentAmount - parsed);

            // update status jika perlu
            if (goal.currentAmount < goal.targetAmount) {
                goal.status = "active";
                goal.completedAt = null;
            }

            await wallet.save();
            await goal.save();
        } else {
            // default: deposit (tarik dari wallet ke goal)
            if (!walletId)
                return res.status(400).json({ message: "Pilih dompet sumber" });
            const wallet = await Wallet.findOne({
                _id: walletId,
                user: req.user._id,
            });
            if (!wallet)
                return res
                    .status(404)
                    .json({ message: "Dompet tidak ditemukan" });
            if ((wallet.balance || 0) < parsed)
                return res
                    .status(400)
                    .json({ message: "Saldo dompet tidak cukup" });

            // buat transaksi pengeluaran dari wallet
            await Transaction.create({
                user: req.user._id,
                wallet: wallet._id,
                type: "expense",
                amount: parsed,
                goalId: goal._id,
                description: `Setor ke goal ${goal.name}`,
            });

            wallet.balance = (wallet.balance || 0) - parsed;
            goal.currentAmount = (goal.currentAmount || 0) + parsed;

            // cek tercapai
            if (goal.currentAmount >= goal.targetAmount) {
                goal.status = "completed";
                goal.completedAt = new Date();
            }

            await wallet.save();
            await goal.save();
        }

        res.json({
            ...goal.toObject(),
            percentage: goal.targetAmount
                ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                : 0,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT update goal
const updateGoal = async (req, res) => {
    try {
        const goal = await Goal.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!goal)
            return res.status(404).json({ message: "Goal tidak ditemukan" });

        const {
            name,
            targetAmount,
            deadline,
            priority,
            status,
            icon,
            color,
            note,
        } = req.body;
        if (name !== undefined) goal.name = name;
        if (targetAmount !== undefined) goal.targetAmount = targetAmount;
        if (deadline !== undefined) goal.deadline = deadline;
        if (priority) goal.priority = priority;
        if (status) goal.status = status;
        if (icon) goal.icon = icon;
        if (color) goal.color = color;
        if (note !== undefined) goal.note = note;
        if (req.body.walletId !== undefined) goal.wallet = req.body.walletId || null;

        // Status ikut menyesuaikan kalau target diubah
        if (goal.status !== "cancelled" && goal.status !== "paused") {
            if (goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount) {
                if (goal.status !== "completed") goal.completedAt = new Date();
                goal.status = "completed";
            } else if (goal.status === "completed") {
                goal.status = "active";
                goal.completedAt = null;
            }
        }
        goal.monthlyTarget = monthlyTargetOf(goal.targetAmount, goal.currentAmount, goal.deadline);

        await goal.save();
        await goal.populate("wallet", "name icon color");
        res.json(goal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE hapus goal (opsional transfer sisa dana ke wallet)
const deleteGoal = async (req, res) => {
    try {
        const { walletId } = req.body || {};
        const goal = await Goal.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!goal)
            return res.status(404).json({ message: "Goal tidak ditemukan" });

        const remaining = goal.currentAmount || 0;
        if (remaining > 0) {
            if (!walletId)
                return res
                    .status(400)
                    .json({
                        message: "Pilih dompet tujuan untuk mengembalikan dana",
                    });
            const wallet = await Wallet.findOne({
                _id: walletId,
                user: req.user._id,
            });
            if (!wallet)
                return res
                    .status(404)
                    .json({ message: "Dompet tidak ditemukan" });

            // buat transaksi pemasukan ke wallet
            await Transaction.create({
                user: req.user._id,
                wallet: wallet._id,
                type: "income",
                amount: remaining,
                goalId: goal._id,
                description: `Pengembalian dana dari penghapusan goal ${goal.name}`,
            });

            wallet.balance = (wallet.balance || 0) + remaining;
            await wallet.save();
        }

        await Goal.findByIdAndDelete(goal._id);
        res.json({ message: "Goal dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    analyzeGoal,
    getGoals,
    createGoal,
    addSavingToGoal,
    updateGoal,
    deleteGoal,
};
