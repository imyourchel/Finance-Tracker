const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Category = require("../models/Category");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

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

// Wallet Cash + kategori default untuk user baru
const seedDefaults = async (userId) => {
    await Wallet.create({
        user: userId,
        name: "Cash",
        type: "cash",
        balance: 0,
        initialBalance: 0,
        icon: "wallet",
        color: "#10b981",
        isDefault: true,
    });
    await Category.insertMany(
        DEFAULT_CATEGORIES.map((cat) => ({ ...cat, user: userId })),
    );
};

const authPayload = (user, extra = {}) => ({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    dateOfBirth: user.dateOfBirth,
    monthlyIncome: user.monthlyIncome,
    monthlyBudget: user.monthlyBudget,
    theme: user.theme,
    authProvider: user.authProvider,
    hasPassword: Boolean(user.password),
    token: generateToken(user._id),
    ...extra,
});

const escapeHtml = (str = "") =>
    String(str).replace(
        /[&<>"']/g,
        (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

const clientUrl = () =>
    (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

const emailLayout = (title, body, buttonText, link) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#13221e">
  <div style="font-size:22px;font-family:Georgia,serif;margin-bottom:24px">DailyTrack</div>
  <h2 style="font-size:20px;margin:0 0 12px">${title}</h2>
  <p style="font-size:14px;line-height:1.6;color:#34443f;margin:0 0 24px">${body}</p>
  <a href="${link}" style="display:inline-block;background:#1e6e55;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">${buttonText}</a>
  <p style="font-size:12px;color:#66756f;margin:24px 0 0;line-height:1.6">Kalau tombol tidak bisa diklik, salin link ini ke browser:<br>${link}</p>
</div>`;

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
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashed,
            authProvider: "local",
            emailVerifyToken: verifyToken,
        });

        await seedDefaults(user._id);

        // Email verifikasi — kalau gagal (mis. EMAIL_USER belum diisi),
        // pendaftaran tetap berhasil, cukup dicatat di log.
        try {
            const link = `${clientUrl()}/verify-email?token=${verifyToken}`;
            await sendEmail({
                to: user.email,
                subject: "Verifikasi email DailyTrack kamu",
                html: emailLayout(
                    `Halo, ${escapeHtml(user.name)}`,
                    "Terima kasih sudah daftar. Klik tombol di bawah untuk memverifikasi email kamu.",
                    "Verifikasi email",
                    link,
                ),
            });
        } catch (mailErr) {
            console.error("Gagal kirim email verifikasi:", mailErr.message);
        }

        res.status(201).json(authPayload(user, { isNew: true }));
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

        if (!user.password)
            return res.status(401).json({
                message:
                    "Akun ini terdaftar lewat Google. Gunakan tombol Lanjutkan dengan Google, atau atur password lewat Lupa password.",
            });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res
                .status(401)
                .json({ message: "Username atau password salah" });

        user.lastLogin = new Date();
        await user.save();

        res.json(authPayload(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET PROFILE
const getProfile = async (req, res) => {
    const withPw = await User.findById(req.user._id).select("password").lean();
    res.json({ ...req.user.toObject(), hasPassword: Boolean(withPw?.password) });
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
            payday,
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
        if (payday !== undefined) {
            const d = Number(payday);
            user.payday = payday === null || payday === "" || !d ? null : Math.min(31, Math.max(1, Math.round(d)));
        }

        await user.save();
        // Jangan pernah kirim hash password / token rahasia ke client
        const safe = user.toObject();
        const hasPassword = Boolean(safe.password);
        delete safe.password;
        delete safe.resetPasswordToken;
        delete safe.resetPasswordExpires;
        delete safe.emailVerifyToken;
        delete safe.refreshToken;
        res.json({ ...safe, hasPassword });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GANTI PASSWORD
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);

        // Akun Google yang belum punya password boleh langsung membuat password
        if (user.password) {
            if (!currentPassword)
                return res
                    .status(400)
                    .json({ message: "Password lama wajib diisi" });
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match)
                return res.status(400).json({ message: "Password lama salah" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password berhasil diganti" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// LUPA PASSWORD
const forgotPassword = async (req, res) => {
    const genericMessage =
        "Jika email terdaftar, link reset password sudah dikirim";
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email)
            return res.status(400).json({ message: "Email wajib diisi" });

        const user = await User.findOne({ email });

        // Response sama agar tidak ketahuan email terdaftar atau tidak
        if (!user || !user.isActive) return res.json({ message: genericMessage });

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 menit
        await user.save();

        const link = `${clientUrl()}/reset-password?token=${resetToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: "Reset password DailyTrack",
                html: emailLayout(
                    "Buat password baru",
                    "Kami menerima permintaan reset password untuk akun kamu. Link ini berlaku 30 menit. Abaikan email ini kalau kamu tidak memintanya.",
                    "Buat password baru",
                    link,
                ),
            });
        } catch (mailErr) {
            console.error("Gagal kirim email reset:", mailErr.message);
            if (process.env.NODE_ENV !== "production") {
                // Mode dev: link tetap bisa dipakai dari log server
                console.log("Link reset (dev):", link);
            } else {
                return res.status(500).json({
                    message:
                        "Email reset belum bisa dikirim. Coba lagi beberapa menit lagi.",
                });
            }
        }

        res.json({ message: genericMessage });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || String(newPassword).length < 6)
            return res
                .status(400)
                .json({ message: "Password minimal 6 karakter" });

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
        // Bisa buka email = email terbukti milik user
        user.isVerified = true;
        await user.save();

        res.json({ message: "Password berhasil direset, silakan login" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// LOGIN / DAFTAR DENGAN GOOGLE
// Client mengirim access token dari Google Identity Services (token client).
const makeUniqueUsername = async (email) => {
    const base =
        email
            .split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "")
            .slice(0, 24) || "user";
    let candidate = base.length >= 3 ? base : `${base}user`;
    let i = 0;
    while (await User.exists({ username: candidate })) {
        i += 1;
        candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        if (i > 10) candidate = `${base}${Date.now().toString().slice(-6)}`;
    }
    return candidate;
};

const googleLogin = async (req, res) => {
    try {
        const { accessToken } = req.body;
        const clientId = process.env.GOOGLE_CLIENT_ID;

        if (!clientId)
            return res.status(500).json({
                message: "Login Google belum dikonfigurasi di server (GOOGLE_CLIENT_ID).",
            });
        if (!accessToken)
            return res.status(400).json({ message: "Token Google tidak ada" });

        // 1. Pastikan token memang diterbitkan untuk aplikasi ini
        const infoRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
        );
        const info = await infoRes.json();
        if (!infoRes.ok || info.aud !== clientId)
            return res
                .status(401)
                .json({ message: "Token Google tidak valid, coba lagi." });

        // 2. Ambil profil user
        const profileRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const profile = await profileRes.json();
        if (!profileRes.ok || !profile.sub || !profile.email)
            return res
                .status(401)
                .json({ message: "Gagal membaca profil Google." });
        if (!profile.email_verified)
            return res
                .status(401)
                .json({ message: "Email Google kamu belum terverifikasi." });

        const email = profile.email.toLowerCase();
        let isNew = false;

        let user = await User.findOne({ googleId: profile.sub });
        if (!user) {
            user = await User.findOne({ email });
            if (user) {
                // Akun lama dengan email yang sama → hubungkan ke Google
                user.googleId = profile.sub;
                user.isVerified = true;
                if (!user.avatar && profile.picture) user.avatar = profile.picture;
            } else {
                user = await User.create({
                    name: profile.name || email.split("@")[0],
                    email,
                    username: await makeUniqueUsername(email),
                    googleId: profile.sub,
                    authProvider: "google",
                    avatar: profile.picture || null,
                    isVerified: true,
                });
                await seedDefaults(user._id);
                isNew = true;
            }
        }

        if (!user.isActive)
            return res.status(403).json({ message: "Akun dinonaktifkan" });

        user.lastLogin = new Date();
        await user.save();

        res.json(authPayload(user, { isNew }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    googleLogin,
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
};
