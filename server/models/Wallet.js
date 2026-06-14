const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
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
        type: {
            type: String,
            enum: ["cash", "bank", "e-wallet", "investment", "other"],
            default: "cash",
        },
        balance: {
            type: Number,
            default: 0,
        },
        initialBalance: {
            type: Number,
            default: 0,
        },

        icon: {
            type: String,
            default: "wallet",
        },
        color: {
            type: String,
            default: "#4f46e5",
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        note: {
            type: String,
            default: "",
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Wallet", walletSchema);
