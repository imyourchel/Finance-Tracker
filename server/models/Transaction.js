const mongoose = require("mongoose");

const MOOD_VALUES = [
    "senang",
    "sedih",
    "biasa",
    "self_reward",
    "terpaksa",
    "bangga",
    "bersalah",
];

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
        },

        // === TIPE & JUMLAH ===
        type: {
            type: String,
            enum: ["income", "expense", "transfer"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        // === TRANSFER (diisi hanya jika type = 'transfer') ===
        transferTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            default: null,
        },
        transferFee: {
            type: Number,
            default: 0,
        },
        isTransfer: {
            type: Boolean,
            default: false,
        },
        transferPairId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            default: null,
        },

        // === DETAIL ===
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },
        subCategory: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: "",
        },
        date: {
            type: Date,
            default: Date.now,
        },
        receiptImage: {
            type: String,
            default: null,
        },
        location: {
            type: String,
            default: null,
        },

        // === FITUR TAMBAHAN ===
        mood: {
            type: String,
            enum: MOOD_VALUES,
            default: null,
        },
        tags: {
            type: [String],
            default: [],
        },
        isRecurring: {
            type: Boolean,
            default: false,
        },
        recurringId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Recurring",
            default: null,
        },
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Goal",
            default: null,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
