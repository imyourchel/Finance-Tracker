const mongoose = require("mongoose");

const recurringSchema = new mongoose.Schema(
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
        type: {
            type: String,
            enum: ["income", "expense"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        description: {
            type: String,
            default: "",
        },
        frequency: {
            type: String,
            enum: ["daily", "weekly", "monthly", "yearly"],
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            default: null, // null = tidak ada batas waktu
        },
        nextRunDate: {
            type: Date,
            required: true,
        },
        lastRunDate: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Recurring", recurringSchema);
