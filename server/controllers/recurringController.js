const Recurring = require("../models/Recurring");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

// GET semua recurring
const getRecurrings = async (req, res) => {
    try {
        const recurrings = await Recurring.find({ user: req.user._id })
            .populate("wallet", "name icon color")
            .populate("category", "name icon color")
            .sort({ createdAt: -1 });

        res.json(recurrings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST buat recurring baru
const createRecurring = async (req, res) => {
    try {
        const {
            walletId,
            type,
            amount,
            categoryId,
            description,
            frequency,
            startDate,
            endDate,
        } = req.body;

        if (endDate && new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({
                message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
            });
        }

        const recurring = await Recurring.create({
            user: req.user._id,
            wallet: walletId,
            type,
            amount,
            category: categoryId,
            description: description || "",
            frequency,
            startDate,
            endDate: endDate || null,
            nextRunDate: new Date(startDate),
        });

        res.status(201).json(recurring);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT toggle aktif / nonaktif
const toggleRecurring = async (req, res) => {
    try {
        const recurring = await Recurring.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!recurring)
            return res
                .status(404)
                .json({ message: "Recurring tidak ditemukan" });

        recurring.isActive = !recurring.isActive;
        await recurring.save();

        res.json({
            message: `Recurring ${recurring.isActive ? "diaktifkan" : "dinonaktifkan"}`,
            recurring,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT update recurring
const updateRecurring = async (req, res) => {
    try {
        const recurring = await Recurring.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!recurring)
            return res
                .status(404)
                .json({ message: "Recurring tidak ditemukan" });

        const { amount, description, frequency, endDate } = req.body;
        if (amount !== undefined) recurring.amount = amount;
        if (description !== undefined) recurring.description = description;
        if (frequency !== undefined) recurring.frequency = frequency;
        if (endDate !== undefined) {
            if (endDate && new Date(endDate) < new Date(recurring.startDate)) {
                return res.status(400).json({
                    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
                });
            }
            recurring.endDate = endDate || null;
        }

        await recurring.save();
        res.json(recurring);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE hapus recurring
const deleteRecurring = async (req, res) => {
    try {
        const recurring = await Recurring.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!recurring)
            return res
                .status(404)
                .json({ message: "Recurring tidak ditemukan" });

        res.json({ message: "Recurring dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getRecurrings,
    createRecurring,
    toggleRecurring,
    updateRecurring,
    deleteRecurring,
};
