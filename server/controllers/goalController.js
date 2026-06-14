const Goal = require("../models/Goal");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

// GET semua goal
const getGoals = async (req, res) => {
    try {
        const goals = await Goal.find({ user: req.user._id })
            .populate("wallet", "name icon color")
            .sort({ createdAt: -1 });

        const result = goals.map((g) => ({
            ...g.toObject(),
            percentage:
                g.targetAmount > 0
                    ? Math.round((g.currentAmount / g.targetAmount) * 100)
                    : 0,
            remaining: g.targetAmount - g.currentAmount,
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
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

        // Hitung target menabung per bulan
        let monthlyTarget = 0;
        if (deadline) {
            const now = new Date();
            const end = new Date(deadline);
            const months = Math.max(
                1,
                Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)),
            );
            monthlyTarget = Math.ceil(targetAmount / months);
        }

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

        await goal.save();
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
    getGoals,
    createGoal,
    addSavingToGoal,
    updateGoal,
    deleteGoal,
};
