const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

// GET semua wallet milik user
const getWallets = async (req, res) => {
    try {
        const wallets = await Wallet.find({
            user: req.user._id,
            isArchived: false, // jangan tampilkan yang sudah diarsipkan
        }).sort({ isDefault: -1, createdAt: 1 });
        // isDefault: -1 → wallet default muncul paling atas

        // Hitung total saldo semua wallet
        const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

        res.json({ wallets, totalBalance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET satu wallet
const getWalletById = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!wallet)
            return res.status(404).json({ message: "Wallet tidak ditemukan" });
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST buat wallet baru
const createWallet = async (req, res) => {
    try {
        const { name, type, balance, icon, color, note } = req.body;

        // Cek apakah ini wallet pertama user (kalau iya, jadikan default)
        const count = await Wallet.countDocuments({ user: req.user._id });

        const wallet = await Wallet.create({
            user: req.user._id,
            name,
            type: type || "cash",
            balance: balance || 0,
            initialBalance: balance || 0,
            icon: icon || "wallet",
            color: color || "#4f46e5",
            isDefault: count === 0, // default kalau ini wallet pertama
            note: note || "",
        });

        res.status(201).json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT update wallet
const updateWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!wallet)
            return res.status(404).json({ message: "Wallet tidak ditemukan" });

        const {
            name,
            type,
            icon,
            color,
            note,
            isDefault,
            balance,
            initialBalance,
        } = req.body;

        if (name) wallet.name = name;
        if (type) wallet.type = type;
        if (icon) wallet.icon = icon;
        if (color) wallet.color = color;
        if (note !== undefined) wallet.note = note;
        if (balance !== undefined) wallet.balance = balance;
        if (initialBalance !== undefined)
            wallet.initialBalance = initialBalance;

        // Kalau jadikan default, hapus default dari wallet lain
        if (isDefault) {
            await Wallet.updateMany(
                { user: req.user._id, _id: { $ne: wallet._id } },
                { isDefault: false },
            );
            wallet.isDefault = true;
        } else if (isDefault === false && wallet.isDefault) {
            // Cek apakah ini satu-satunya default wallet
            const defaultCount = await Wallet.countDocuments({
                user: req.user._id,
                isDefault: true,
            });
            if (defaultCount === 1) {
                return res.status(400).json({
                    message: "Minimal satu wallet harus default.",
                });
            }
            wallet.isDefault = false;
        }

        await wallet.save();
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE arsipkan wallet (soft delete)
const archiveWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!wallet)
            return res.status(404).json({ message: "Wallet tidak ditemukan" });

        if (wallet.isDefault)
            return res
                .status(400)
                .json({ message: "Wallet default tidak bisa diarsipkan" });

        wallet.isArchived = true;
        await wallet.save();

        res.json({ message: "Wallet diarsipkan" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getWallets,
    getWalletById,
    createWallet,
    updateWallet,
    archiveWallet,
};
