const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // === IDENTITAS ===
        name: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        // Password boleh kosong untuk akun yang daftar lewat Google
        password: {
            type: String,
            required: function () {
                return !this.googleId;
            },
            minlength: 6,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        authProvider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
        },
        avatar: {
            type: String,
            default: null,
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },

        // === PREFERENSI KEUANGAN ===
        monthlyIncome: {
            type: Number,
            default: 0,
        },
        monthlyBudget: {
            type: Number,
            default: 0,
        },
        // Tanggal gajian (1–31). Dipakai untuk "sisa aman sampai gajian"
        payday: {
            type: Number,
            min: 1,
            max: 31,
            default: null,
        },

        // === PREFERENSI APP ===
        notifications: {
            dailyReminder: { type: Boolean, default: true },
            budgetAlert: { type: Boolean, default: true },
            goalAlert: { type: Boolean, default: true },
            reminderTime: { type: String, default: "20:00" },
        },
        theme: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system",
        },

        // === AUTH & KEAMANAN ===
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        refreshToken: {
            type: String,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpires: {
            type: Date,
            default: null,
        },
        emailVerifyToken: {
            type: String,
            default: null,
        },
        lastLogin: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
