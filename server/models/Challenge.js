const mongoose = require("mongoose");

// Tantangan menabung yang diikuti pengguna
const challengeSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        type: {
            type: String,
            enum: ["batas-harian", "tanpa-jajan-3", "akhir-pekan", "sisa-bulan", "52-minggu"],
            required: true,
        },
        params: {
            dailyLimit: { type: Number, default: 0 },
            targetRate: { type: Number, default: 0 },
            baseAmount: { type: Number, default: 0 },
        },
        startKey: { type: String, required: true }, // hari mulai (WIB) "YYYY-MM-DD"
        endKey: { type: String, required: true }, // hari terakhir (WIB), inklusif
        status: {
            type: String,
            enum: ["active", "completed", "failed", "abandoned"],
            default: "active",
        },
        xpReward: { type: Number, default: 0 },
        finishedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Challenge", challengeSchema);
