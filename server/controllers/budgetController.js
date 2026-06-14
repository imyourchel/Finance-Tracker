const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");

// GET semua budget bulan ini
const getBudgets = async (req, res) => {
    try {
        const now = new Date();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const year = Number(req.query.year) || now.getFullYear();

        const budgets = await Budget.find({
            user: req.user._id,
            month,
            year,
        }).populate("category", "name icon color");

        // Hitung persentase tiap budget
        const result = budgets.map((b) => ({
            ...b.toObject(),
            percentage: b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0,
            remaining: b.limit - b.spent,
            isOverBudget: b.spent > b.limit,
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST buat budget baru
const createBudget = async (req, res) => {
    try {
        const {
            categoryId,
            limit,
            month,
            year,
            alertThreshold,
            rollover,
            note,
        } = req.body;

        // Cek duplikat
        const exists = await Budget.findOne({
            user: req.user._id,
            category: categoryId,
            month,
            year,
        });
        if (exists)
            return res
                .status(400)
                .json({ message: "Budget kategori ini sudah ada" });

        // Hitung spent yang sudah terjadi di bulan ini
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        const existing = await Transaction.aggregate([
            {
                $match: {
                    user: req.user._id,
                    category: categoryId,
                    type: "expense",
                    isDeleted: false,
                    date: { $gte: start, $lte: end },
                },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        const alreadySpent = existing[0]?.total || 0;

        const budget = await Budget.create({
            user: req.user._id,
            category: categoryId,
            limit,
            spent: alreadySpent,
            month,
            year,
            alertThreshold: alertThreshold || 80,
            rollover: rollover || false,
            note: note || "",
        });

        await budget.populate("category", "name icon color");
        res.status(201).json(budget);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT update limit budget
const updateBudget = async (req, res) => {
    try {
        const budget = await Budget.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!budget)
            return res.status(404).json({ message: "Budget tidak ditemukan" });

        const { limit, alertThreshold, rollover, note } = req.body;
        if (limit !== undefined) budget.limit = limit;
        if (alertThreshold !== undefined)
            budget.alertThreshold = alertThreshold;
        if (rollover !== undefined) budget.rollover = rollover;
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
        const budget = await Budget.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!budget)
            return res.status(404).json({ message: "Budget tidak ditemukan" });
        res.json({ message: "Budget dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget };
