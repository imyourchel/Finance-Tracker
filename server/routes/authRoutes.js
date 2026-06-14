const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const User = require("../models/User");
const {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { registerRules, loginRules, changePasswordRules } = require("../validators/authValidator");
const validate = require("../middleware/validate");

// rate limiter
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: "Terlalu banyak percobaan, coba lagi sebentar." },
    standardHeaders: true,
    legacyHeaders: false,
});

// multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "..", "uploads", "avatars"));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, name);
    },
});
const upload = multer({ storage });

// routes
router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login", authLimiter, loginRules, validate, login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, upload.single("avatar"), updateProfile);
router.put("/password", protect, changePasswordRules, validate, changePassword);

router.get("/verify-email", async (req, res) => {
    try {
        const { token } = req.query;
        const user = await User.findOne({ emailVerifyToken: token });
        if (!user) return res.status(400).json({ message: "Token tidak valid" });

        user.isVerified = true;
        user.emailVerifyToken = null;
        await user.save();

        res.json({ message: "Email berhasil diverifikasi" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;