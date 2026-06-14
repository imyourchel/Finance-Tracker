const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        limit: {
            type: Number,
            required: true,
        },
        spent: {
            type: Number,
            default: 0, // di-update tiap ada transaksi baru
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        alertThreshold: {
            type: Number,
            default: 80, // notif saat spent mencapai 80% dari limit
        },
        isAlertSent: {
            type: Boolean,
            default: false,
        },
        rollover: {
            type: Boolean,
            default: false, // sisa budget bulan lalu ditambahkan ke bulan ini
        },
        note: {
            type: String,
            default: "",
        },
    },
    { timestamps: true },
);

budgetSchema.index(
    { user: 1, category: 1, month: 1, year: 1 },
    { unique: true },
);

module.exports = mongoose.model("Budget", budgetSchema);
