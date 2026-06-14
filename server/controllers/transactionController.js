const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Budget = require("../models/Budget");
const fs = require("fs");
const path = require("path");

// ============================================================
// Helper: update saldo wallet
// ============================================================
const updateWalletBalance = async (
    walletId,
    type,
    amount,
    reverse = false,
    userId = null,
) => {
    const filter = { _id: walletId };
    if (userId) filter.user = userId;

    const wallet = await Wallet.findOne(filter);
    if (!wallet) return;

    // reverse = true artinya kita undo transaksi (saat delete)
    const multiplier = reverse ? -1 : 1;

    if (type === "income") {
        wallet.balance += amount * multiplier;
    } else if (type === "expense") {
        wallet.balance -= amount * multiplier;
    }
    await wallet.save();
};

const applyTransferBalance = async (
    sourceWalletId,
    destinationWalletId,
    amount,
    userId,
    reverse = false,
    fee = 0,
) => {
    const sourceWallet = await Wallet.findOne({
        _id: sourceWalletId,
        user: userId,
    });
    if (!sourceWallet) return;

    const destinationWallet = await Wallet.findOne({
        _id: destinationWalletId,
        user: userId,
    });
    if (!destinationWallet) return;

    const amountValue = Number(amount) || 0;
    const feeValue = Number(fee) || 0;

    if (reverse) {
        sourceWallet.balance += amountValue + feeValue;
        destinationWallet.balance -= amountValue;
    } else {
        sourceWallet.balance -= amountValue + feeValue;
        destinationWallet.balance += amountValue;
    }

    await sourceWallet.save();
    await destinationWallet.save();
};

// Helper: update spent di Budget
const updateBudgetSpent = async (
    userId,
    categoryId,
    amount,
    date,
    reverse = false,
) => {
    const d = new Date(date);
    const budget = await Budget.findOne({
        user: userId,
        category: categoryId,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
    });

    if (budget) {
        budget.spent += reverse ? -amount : amount;
        if (budget.spent < 0) budget.spent = 0;
        await budget.save();
    }
};

// ============================================================
// GET semua transaksi dengan filter
// ============================================================
const getTransactions = async (req, res) => {
    try {
        const {
            month,
            year,
            type,
            category,
            wallet,
            search,
            page = 1, limit = 20,           // default
            sort = "date_desc",           // default descending
        } = req.query;

        const filter = { user: req.user.id, isDeleted: false };

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: start, $lte: end };
        }
        if (type) {
            if (type === "transfer") {
                filter.isTransfer = true;
            }

            if (type === "income" || type === "expense") {
                filter.isTransfer = { $ne: true };
                filter.type = type;   // 🔥 INI YANG HILANG
            }
        }
        if (wallet) filter.wallet = wallet;
        if (category) filter.category = category;
        if (search) {
            filter.description = { $regex: search, $options: "i" };
        }

        const sortMap = {
            date_desc: { date: -1 },
            date_asc: { date: 1 },
            amount_desc: { amount: -1 },
            amount_asc: { amount: 1 },
        };
        const sortOption = sortMap[sort] || { date: -1 };

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;



        // Jalankan query dan count paralel supaya lebih cepat
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate("category", "name icon color")
                .populate("wallet", "name icon color")
                .populate("transferTo", "name icon color")
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Transaction.countDocuments(filter),
        ]);

        res.json({
            transactions,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                hasNext: pageNum < Math.ceil(total / limitNum),
                hasPrev: pageNum > 1,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// POST buat transaksi baru
// ============================================================
const createTransaction = async (req, res) => {
    try {
        const {
            walletId,
            type,
            amount,
            categoryId,
            description,
            date,
            mood,
            tags,
            transferTo,
            transferFee,
            goalId,
            subCategory,
            location,
            isRecurring,
        } = req.body;

        const parsedAmount = Number(amount);
        const parsedTransferFee = Number(transferFee || 0);

        // Normalize tags: accept array or comma/stringified JSON
        const normalizeTags = (t) => {
            if (!t) return [];
            if (Array.isArray(t)) return t;
            if (typeof t === "string") {
                try {
                    const parsed = JSON.parse(t);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    // fallback to comma-separated
                    return t
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
            }
            return [];
        };
        const baseTags = normalizeTags(tags);

        // Pastikan wallet milik user ini
        const wallet = await Wallet.findOne({
            _id: walletId,
            user: req.user._id,
        });
        if (!wallet)
            return res.status(404).json({ message: "Wallet tidak ditemukan" });

        const receiptUrl = req.file
            ? `${req.protocol}://${req.get("host")}/uploads/receipts/${req.file.filename}`
            : null;

        if (type === "transfer") {
            if (!transferTo)
                return res.status(400).json({
                    message: "Pilih wallet tujuan transfer",
                });

            if (String(walletId) === String(transferTo)) {
                return res.status(400).json({
                    message: "Wallet asal dan tujuan tidak boleh sama",
                });
            }

            const destWallet = await Wallet.findOne({
                _id: transferTo,
                user: req.user._id,
            });
            if (!destWallet)
                return res
                    .status(404)
                    .json({ message: "Wallet tujuan tidak ditemukan" });

            if (wallet.balance < parsedAmount + parsedTransferFee) {
                return res.status(400).json({ message: "Saldo tidak cukup" });
            }

            const baseDate = date || Date.now();
            const baseTags = tags || [];
            const baseDescription = description || "";

            const outTransaction = await Transaction.create({
                user: req.user._id,
                wallet: walletId,
                type: "expense",
                amount: parsedAmount + parsedTransferFee,
                category: null,
                subCategory,
                description:
                    baseDescription ||
                    `Transfer ke ${destWallet.name}${parsedTransferFee > 0 ? ` (fee ${parsedTransferFee})` : ""}`,
                date: baseDate,
                mood,
                tags: baseTags,
                transferTo,
                transferFee: parsedTransferFee,
                isTransfer: true,
                transferPairId: null,
                goalId: goalId || null,
                location,
                isRecurring: isRecurring || false,
                receiptImage: receiptUrl,
            });

            const inTransaction = await Transaction.create({
                user: req.user._id,
                wallet: transferTo,
                type: "income",
                amount: parsedAmount,
                category: null,
                subCategory,
                description: baseDescription || `Transfer dari ${wallet.name}`,
                date: baseDate,
                mood,
                tags: baseTags,
                transferTo: walletId,
                transferFee: 0,
                isTransfer: true,
                transferPairId: outTransaction._id,
                goalId: goalId || null,
                location,
                isRecurring: isRecurring || false,
            });

            outTransaction.transferPairId = inTransaction._id;
            await outTransaction.save();

            await updateWalletBalance(
                walletId,
                "expense",
                parsedAmount + parsedTransferFee,
                false,
                req.user._id,
            );

            await updateWalletBalance(
                transferTo,
                "income",
                parsedAmount,
                false,
                req.user._id,
            );

            const populated = await outTransaction
                .populate("wallet", "name icon color")
                .then((t) => t.populate("transferTo", "name icon color"))
                .then((t) => t.populate("category", "name icon color"));

            return res.status(201).json(populated);
        }

        // Cek saldo cukup untuk pengeluaran
        if (type === "expense" && wallet.balance < parsedAmount) {
            return res.status(400).json({ message: "Saldo tidak cukup" });
        }

        // Buat transaksi
        const transaction = await Transaction.create({
            user: req.user._id,
            wallet: walletId,
            type,
            amount: parsedAmount,
            category: categoryId || null,
            subCategory,
            description: description || "",
            date: date || Date.now(),
            mood,
            tags: baseTags,
            transferTo: null,
            transferFee: 0,
            goalId: goalId || null,
            location,
            isRecurring: isRecurring || false,
            receiptImage: receiptUrl,
        });

        // Update saldo wallet asal
        await updateWalletBalance(
            walletId,
            type,
            parsedAmount,
            false,
            req.user._id,
        );

        // Update budget spent kalau expense
        if (type === "expense") {
            await updateBudgetSpent(
                req.user._id,
                categoryId,
                parsedAmount,
                date || new Date(),
            );
        }

        const populated = await transaction
            .populate("wallet", "name icon color")
            .then((t) => t.populate("transferTo", "name icon color"))
            .then((t) => t.populate("category", "name icon color"));

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// PUT update transaksi
// ============================================================
const updateTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!transaction)
            return res
                .status(404)
                .json({ message: "Transaksi tidak ditemukan" });

        if (transaction.isTransfer) {
            return res.status(400).json({
                message:
                    "Edit transfer belum didukung. Hapus lalu buat ulang transfer.",
            });
        }

        const previousState = {
            wallet: transaction.wallet,
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            date: transaction.date,
            transferTo: transaction.transferTo,
            transferFee: transaction.transferFee || 0,
        };

        // Reverse saldo lama
        if (previousState.type === "transfer") {
            await applyTransferBalance(
                previousState.wallet,
                previousState.transferTo,
                previousState.amount,
                req.user._id,
                true,
                previousState.transferFee,
            );
        } else {
            await updateWalletBalance(
                previousState.wallet,
                previousState.type,
                previousState.amount,
                true,
                req.user._id,
            );
        }
        if (transaction.type === "expense") {
            await updateBudgetSpent(
                req.user._id,
                transaction.category,
                transaction.amount,
                transaction.date,
                true,
            );
        }

        // Terapkan data baru
        const {
            walletId,
            type,
            amount,
            categoryId,
            description,
            date,
            mood,
            tags,
            location,
            transferTo,
            transferFee,
            subCategory,
            goalId,
            isRecurring,
        } = req.body;

        const nextType = type || transaction.type;
        const nextWalletId = walletId || transaction.wallet;
        const nextAmount =
            amount !== undefined ? Number(amount) : transaction.amount;
        const nextTransferTo =
            nextType === "transfer"
                ? transferTo || transaction.transferTo
                : null;
        const nextTransferFee =
            transferFee !== undefined
                ? Number(transferFee)
                : previousState.transferFee;
        const nextCategory =
            nextType === "transfer" ? null : categoryId || transaction.category;

        const nextWallet = await Wallet.findOne({
            _id: nextWalletId,
            user: req.user._id,
        });
        if (!nextWallet)
            return res.status(404).json({ message: "Wallet tidak ditemukan" });

        if (nextType === "transfer") {
            if (!nextTransferTo)
                return res.status(400).json({
                    message: "Pilih wallet tujuan transfer",
                });

            if (String(nextWalletId) === String(nextTransferTo)) {
                return res.status(400).json({
                    message: "Wallet asal dan tujuan tidak boleh sama",
                });
            }

            const destWallet = await Wallet.findOne({
                _id: nextTransferTo,
                user: req.user._id,
            });
            if (!destWallet)
                return res
                    .status(404)
                    .json({ message: "Wallet tujuan tidak ditemukan" });

            if (nextWallet.balance < nextAmount + nextTransferFee) {
                return res.status(400).json({ message: "Saldo tidak cukup" });
            }
        } else if (nextType === "expense" && nextWallet.balance < nextAmount) {
            return res.status(400).json({ message: "Saldo tidak cukup" });
        }

        if (amount !== undefined) transaction.amount = nextAmount;
        if (walletId) transaction.wallet = nextWalletId;
        if (nextType) transaction.type = nextType;
        transaction.category = nextCategory;
        if (description !== undefined) transaction.description = description;
        if (date) transaction.date = date;
        if (mood !== undefined) transaction.mood = mood;
        if (tags) {
            if (Array.isArray(tags)) transaction.tags = tags;
            else if (typeof tags === "string") {
                try {
                    const parsed = JSON.parse(tags);
                    if (Array.isArray(parsed)) transaction.tags = parsed;
                    else
                        transaction.tags = tags
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                } catch (e) {
                    transaction.tags = tags
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
            }
        }
        if (subCategory !== undefined) transaction.subCategory = subCategory;
        if (location !== undefined) transaction.location = location;
        if (goalId !== undefined) transaction.goalId = goalId || null;
        if (isRecurring !== undefined) transaction.isRecurring = isRecurring;
        transaction.transferTo =
            nextType === "transfer" ? nextTransferTo : null;
        transaction.transferFee = nextType === "transfer" ? nextTransferFee : 0;

        // Handle receipt file upload / removal
        const receiptRemoved =
            req.body?.receiptRemoved === "true" ||
            req.body?.receiptRemoved === true;
        if (req.file) {
            // delete old file if exists
            if (transaction.receiptImage) {
                const oldFilename = transaction.receiptImage.split("/").pop();
                const oldPath = path.join(
                    __dirname,
                    "../uploads/receipts",
                    oldFilename,
                );
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            transaction.receiptImage = `${req.protocol}://${req.get("host")}/uploads/receipts/${req.file.filename}`;
        } else if (receiptRemoved) {
            if (transaction.receiptImage) {
                const oldFilename = transaction.receiptImage.split("/").pop();
                const oldPath = path.join(
                    __dirname,
                    "../uploads/receipts",
                    oldFilename,
                );
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            transaction.receiptImage = null;
        }

        await transaction.save();

        // Terapkan saldo baru
        if (transaction.type === "transfer") {
            await applyTransferBalance(
                transaction.wallet,
                transaction.transferTo,
                transaction.amount,
                req.user._id,
                false,
                transaction.transferFee || 0,
            );
        } else {
            await updateWalletBalance(
                transaction.wallet,
                transaction.type,
                transaction.amount,
                false,
                req.user._id,
            );
        }
        if (transaction.type === "expense") {
            await updateBudgetSpent(
                req.user._id,
                transaction.category,
                transaction.amount,
                transaction.date,
            );
        }

        const populated = await Transaction.findById(transaction._id)
            .populate("wallet", "name icon color")
            .populate("transferTo", "name icon color")
            .populate("category", "name icon color");

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// DELETE hapus transaksi (soft delete)
// ============================================================
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!transaction)
            return res
                .status(404)
                .json({ message: "Transaksi tidak ditemukan" });

        if (transaction.isTransfer) {
            const related = transaction.transferPairId
                ? await Transaction.findOne({
                    _id: transaction.transferPairId,
                    user: req.user._id,
                })
                : null;

            await updateWalletBalance(
                transaction.wallet,
                transaction.type,
                transaction.amount,
                true,
                req.user._id,
            );

            transaction.isDeleted = true;
            await transaction.save();

            if (related && !related.isDeleted) {
                await updateWalletBalance(
                    related.wallet,
                    related.type,
                    related.amount,
                    true,
                    req.user._id,
                );
                related.isDeleted = true;
                await related.save();
            }

            return res.json({ message: "Transfer dihapus" });
        }

        // Reverse saldo wallet
        if (transaction.type === "transfer") {
            await applyTransferBalance(
                transaction.wallet,
                transaction.transferTo,
                transaction.amount,
                req.user._id,
                true,
                transaction.transferFee || 0,
            );
        } else {
            await updateWalletBalance(
                transaction.wallet,
                transaction.type,
                transaction.amount,
                true,
                req.user._id,
            );
        }

        // Reverse budget
        if (transaction.type === "expense") {
            await updateBudgetSpent(
                req.user._id,
                transaction.category,
                transaction.amount,
                transaction.date,
                true,
            );
        }

        transaction.isDeleted = true;
        await transaction.save();

        res.json({ message: "Transaksi dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// GET summary untuk dashboard
// ============================================================
const getSummary = async (req, res) => {
    try {
        const { month, year } = req.query;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        const baseMatch = {
            user: req.user._id,
            isDeleted: false,
            isTransfer: { $ne: true },
            date: { $gte: start, $lte: end },
        };

        // Total income & expense bulan ini
        const summary = await Transaction.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$type", total: { $sum: "$amount" } } },
        ]);

        // Pengeluaran per kategori (untuk pie chart)
        const byCategory = await Transaction.aggregate([
            { $match: { ...baseMatch, type: "expense" } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
            { $limit: 10 },
        ]);

        // Populate nama kategori di byCategory
        const Category = require("../models/Category");
        const categoryIds = byCategory.map((b) => b._id);
        const categoryDocs = await Category.find({ _id: { $in: categoryIds } });
        const categoryMap = {};
        categoryDocs.forEach((c) => {
            categoryMap[c._id] = c;
        });

        const byCategoryPopulated = byCategory.map((b) => ({
            ...b,
            category: categoryMap[b._id] || {
                name: "Lainnya",
                color: "#9ca3af",
                icon: "tag",
            },
        }));

        // Tren harian dalam bulan (untuk bar chart)
        const dailyTrend = await Transaction.aggregate([
            { $match: { ...baseMatch, type: { $in: ["income", "expense"] } } },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: "$date" },
                        type: "$type",
                    },
                    total: { $sum: "$amount" },
                },
            },
            { $sort: { "_id.day": 1 } },
        ]);

        const income = summary.find((s) => s._id === "income")?.total || 0;
        const expense = summary.find((s) => s._id === "expense")?.total || 0;

        res.json({
            income,
            expense,
            balance: income - expense,
            byCategory: byCategoryPopulated,
            dailyTrend,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// GET perbandingan bulan ini vs bulan lalu
// ============================================================
const getComparison = async (req, res) => {
    try {
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!month || !year) {
            return res.status(400).json({
                message: "month dan year wajib diisi",
            });
        }

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const getTotal = async (m, y) => {
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);

            const result = await Transaction.aggregate([
                {
                    $match: {
                        user: req.user._id,
                        isDeleted: false,
                        isTransfer: { $ne: true },
                        type: "expense",
                        date: { $gte: start, $lte: end },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$amount" },
                    },
                },
            ]);

            return result[0]?.total || 0;
        };

        const thisMonth = await getTotal(month, year);
        const lastMonth = await getTotal(prevMonth, prevYear);

        const diff = thisMonth - lastMonth;

        const percentage =
            lastMonth > 0 ? ((diff / lastMonth) * 100).toFixed(1) : 0;

        return res.json({
            thisMonth,
            lastMonth,
            diff,
            percentage: Number(percentage),
            isMoreExpensive: diff > 0,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const getYearRange = async (req, res) => {
    try {
        // Cari transaksi paling lama milik user ini
        const oldest = await Transaction.findOne(
            { user: req.user.id, isDeleted: false },
            { date: 1 },
        ).sort({ date: 1 });

        const startYear = oldest
            ? new Date(oldest.date).getFullYear()
            : new Date().getFullYear();

        const endYear = new Date().getFullYear();

        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }

        res.json({ years });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getSummary,
    getComparison,
    getYearRange,
};


