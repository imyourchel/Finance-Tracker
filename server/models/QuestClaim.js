const mongoose = require("mongoose");

// Misi harian/mingguan yang sudah diklaim (satu kali per periode)
const questClaimSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        questId: { type: String, required: true },
        scope: { type: String, enum: ["daily", "weekly"], required: true },
        period: { type: String, required: true }, // "2026-10-26" (harian) atau Senin minggu itu (mingguan)
        xp: { type: Number, required: true, min: 0 },
    },
    { timestamps: true },
);

questClaimSchema.index({ user: 1, questId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("QuestClaim", questClaimSchema);
