const mongoose = require("mongoose");

// Satu catatan utang/piutang dengan riwayat pembayaran (cicilan)
const paymentSchema = new mongoose.Schema(
    {
        amount: { type: Number, required: true, min: 1 },
        date: { type: Date, default: Date.now },
        wallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
        transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
        note: { type: String, default: "", trim: true, maxlength: 200 },
    },
    { timestamps: true },
);

const debtSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        // owed_to_me = piutang (orang berutang ke aku), i_owe = utang (aku berutang)
        direction: { type: String, enum: ["owed_to_me", "i_owe"], required: true },
        person: { type: String, required: true, trim: true, maxlength: 60 },
        personKey: { type: String, required: true, index: true }, // nama huruf kecil untuk pengelompokan
        amount: { type: Number, required: true, min: 1 },
        paid: { type: Number, default: 0, min: 0 },
        note: { type: String, default: "", trim: true, maxlength: 300 },
        date: { type: Date, default: Date.now },
        dueDate: { type: Date, default: null },
        // Wallet saat uang awal berpindah (opsional) + transaksi pembukanya
        wallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
        openingTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
        splitBill: { type: mongoose.Schema.Types.ObjectId, ref: "SplitBill", default: null },
        status: { type: String, enum: ["open", "settled"], default: "open" },
        settledAt: { type: Date, default: null },
        payments: { type: [paymentSchema], default: [] },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Debt", debtSchema);
