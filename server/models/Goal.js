const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        targetAmount: {
            type: Number,
            required: true,
        },
        currentAmount: {
            type: Number,
            default: 0,
        },
        deadline: {
            type: Date,
            default: null,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium",
        },
        status: {
            type: String,
            enum: ["active", "completed", "cancelled", "paused"],
            default: "active",
        },
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            default: null,
        },
        monthlyTarget: {
            type: Number,
            default: 0, // auto-hitung: (targetAmount - currentAmount) / sisa bulan
        },
        icon: {
            type: String,
            default: "target",
        },
        color: {
            type: String,
            default: "#10b981",
        },
        note: {
            type: String,
            default: "",
        },
        completedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Goal", goalSchema);
