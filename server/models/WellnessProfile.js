const mongoose = require("mongoose");

// Pengaturan halaman Kesehatan Finansial (dana darurat & langganan)
const wellnessProfileSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        household: {
            type: String,
            enum: ["lajang", "menikah", "tanggungan", "freelancer"],
            default: null,
        },
        multiplier: { type: Number, min: 1, max: 24, default: null },
        fundWallets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Wallet" }],
        fundGoals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Goal" }],
        ignoredSubs: [{ type: String }],
        configured: { type: Boolean, default: false },
    },
    { timestamps: true },
);

module.exports = mongoose.model("WellnessProfile", wellnessProfileSchema);
