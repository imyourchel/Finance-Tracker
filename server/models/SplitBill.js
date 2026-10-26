const mongoose = require("mongoose");

// Patungan: aku bayar dulu, bagian orang lain jadi piutang
const splitBillSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 80 },
        total: { type: Number, required: true, min: 1 },
        date: { type: Date, default: Date.now },
        dueDate: { type: Date, default: null },
        mode: { type: String, enum: ["equal", "custom"], default: "equal" },
        includeMe: { type: Boolean, default: true },
        myShare: { type: Number, default: 0, min: 0 },
        wallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
        // Transaksi pengeluaran untuk bagianku sendiri (pengeluaran sungguhan)
        myTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
        note: { type: String, default: "", trim: true, maxlength: 300 },
        participants: [
            {
                name: { type: String, required: true, trim: true },
                share: { type: Number, required: true, min: 0 },
                debt: { type: mongoose.Schema.Types.ObjectId, ref: "Debt", default: null },
            },
        ],
    },
    { timestamps: true },
);

module.exports = mongoose.model("SplitBill", splitBillSchema);
