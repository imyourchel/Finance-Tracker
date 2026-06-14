const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Category = require("../models/Category");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const DEFAULT_CATEGORIES = [
    {
        name: "Gaji",
        type: "income",
        icon: "cash",
        color: "#10b981",
        isDefault: true,
        order: 1,
    },
    {
        name: "Freelance",
        type: "income",
        icon: "laptop",
        color: "#3b82f6",
        isDefault: true,
        order: 2,
    },
    {
        name: "Investasi",
        type: "income",
        icon: "trending-up",
        color: "#8b5cf6",
        isDefault: true,
        order: 3,
    },
    {
        name: "Lainnya",
        type: "income",
        icon: "more-horizontal",
        color: "#9ca3af",
        isDefault: true,
        order: 4,
    },
    {
        name: "Makan",
        type: "expense",
        icon: "utensils",
        color: "#f59e0b",
        isDefault: true,
        order: 5,
    },
    {
        name: "Transport",
        type: "expense",
        icon: "car",
        color: "#ef4444",
        isDefault: true,
        order: 6,
    },
    {
        name: "Belanja",
        type: "expense",
        icon: "shopping-bag",
        color: "#ec4899",
        isDefault: true,
        order: 7,
    },
    {
        name: "Hiburan",
        type: "expense",
        icon: "music",
        color: "#6366f1",
        isDefault: true,
        order: 8,
    },
    {
        name: "Kesehatan",
        type: "expense",
        icon: "heart",
        color: "#14b8a6",
        isDefault: true,
        order: 9,
    },
    {
        name: "Pendidikan",
        type: "expense",
        icon: "book",
        color: "#0ea5e9",
        isDefault: true,
        order: 10,
    },
    {
        name: "Tagihan",
        type: "expense",
        icon: "file-text",
        color: "#f97316",
        isDefault: true,
        order: 11,
    },
    {
        name: "Kos / Sewa",
        type: "expense",
        icon: "home",
        color: "#84cc16",
        isDefault: true,
        order: 12,
    },
    {
        name: "Lainnya",
        type: "expense",
        icon: "more-horizontal",
        color: "#9ca3af",
        isDefault: true,
        order: 13,
    },
];

// REGISTER
const register = async (req, res) => {
    try {
        const { name, email, username, password } = req.body;

        if (!name || !email || !username || !password)
            return res.status(400).json({ message: "Semua field wajib diisi" });

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        const exists = await User.findOne({ email: normalizedEmail });
        if (exists)
            return res.status(400).json({ message: "Email sudah terdaftar" });

        const usernameExists = await User.findOne({
            username: normalizedUsername,
        });
        if (usernameExists)
            return res
                .status(400)
                .json({ message: "Username sudah terdaftar" });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashed,
        });

        await Wallet.create({
            user: user._id,
            name: "Cash",
            type: "cash",
            balance: 0,
            initialBalance: 0,
            icon: "wallet",
            color: "#10b981",
            isDefault: true,
        });

        const categories = DEFAULT_CATEGORIES.map((cat) => ({
            ...cat,
            user: user._id,
        }));
        await Category.insertMany(categories);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            dateOfBirth: user.dateOfBirth,
            monthlyIncome: user.monthlyIncome,
            monthlyBudget: user.monthlyBudget,
            theme: user.theme,
            token: generateToken(user._id),
        });

        const crypto = require("crypto");
        const sendEmail = require("../utils/sendEmail");

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");
        user.emailVerifyToken = token;
        await user.save();

        // Kirim email
        const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
        await sendEmail({
            to: user.email,
            subject: "Verifikasi email kamu",
            html: `<p>Klik link ini untuk verifikasi: <a href="${link}">${link}</a></p>`,
        });     
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// LOGIN
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ message: "Semua field wajib diisi" });

        const normalizedUsername = username.trim().toLowerCase();

        const user = await User.findOne({ username: normalizedUsername });
        if (!user)
            return res
                .status(401)
                .json({ message: "Username atau password salah" });

        if (!user.isActive)
            return res.status(403).json({ message: "Akun dinonaktifkan" });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res
                .status(401)
                .json({ message: "Username atau password salah" });

        user.lastLogin = new Date();
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            dateOfBirth: user.dateOfBirth,
            monthlyIncome: user.monthlyIncome,
            monthlyBudget: user.monthlyBudget,
            theme: user.theme,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET PROFILE
const getProfile = async (req, res) => {
    res.json(req.user);
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const {
            name,
            username,
            avatar,
            dateOfBirth,
            theme,
            notifications,
            monthlyIncome,
            monthlyBudget,
        } = req.body;

        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (username) {
            const normalizedUsername = username.trim().toLowerCase();
            const usernameExists = await User.findOne({
                username: normalizedUsername,
                _id: { $ne: req.user._id },
            });
            if (usernameExists)
                return res
                    .status(400)
                    .json({ message: "Username sudah terdaftar" });
            user.username = normalizedUsername;
        }
        // avatar can come from either a file upload or a string URL in body
        if (req.file) {
            // Delete old avatar file if exists
            if (user.avatar) {
                const fs = require("fs");
                const path = require("path");
                const oldFilename = user.avatar.split("/").pop();
                const oldAvatarPath = path.join(
                    __dirname,
                    "../uploads/avatars",
                    oldFilename,
                );
                if (fs.existsSync(oldAvatarPath)) {
                    fs.unlinkSync(oldAvatarPath);
                }
            }
            const avatarUrl = `${req.protocol}://${req.get("host")}/uploads/avatars/${req.file.filename}`;
            user.avatar = avatarUrl;
        } else if (avatar !== undefined) {
            user.avatar = avatar || null;
        }
        if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
        if (theme) user.theme = theme;
        if (notifications) {
            const parsed =
                typeof notifications === "string"
                    ? JSON.parse(notifications)
                    : notifications;
            user.notifications = { ...user.notifications, ...parsed };
        }
        if (monthlyIncome !== undefined) user.monthlyIncome = monthlyIncome;
        if (monthlyBudget !== undefined) user.monthlyBudget = monthlyBudget;

        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GANTI PASSWORD
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);
        const match = await bcrypt.compare(currentPassword, user.password);

        if (!match)
            return res.status(400).json({ message: "Password lama salah" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password berhasil diganti" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// LUPA PASSWORD
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        // Selalu kirim response yang sama agar tidak ketahuan email terdaftar atau tidak
        if (!user) {
            return res.json({
                message: "Jika email terdaftar, link reset akan dikirim",
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 menit
        await user.save();

        // TODO: kirim email dengan link berikut
        // Link: https://yourapp.com/reset-password?token=${resetToken}
        console.log("Reset token (dev only):", resetToken);

        res.json({ message: "Jika email terdaftar, link reset akan dikirim" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }, // belum expired
        });

        if (!user)
            return res
                .status(400)
                .json({ message: "Token tidak valid atau sudah expired" });

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: "Password berhasil direset, silakan login" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
};
