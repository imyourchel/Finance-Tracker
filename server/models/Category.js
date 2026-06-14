const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null, // null = kategori default sistem, ada ObjectId = milik user
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["income", "expense"],
            required: true,
        },
        icon: {
            type: String,
            default: "tag",
        },
        color: {
            type: String,
            default: "#4f46e5",
        },
        isDefault: {
            type: Boolean,
            default: false, // true = bawaan sistem, false = buatan user
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0, // urutan tampil di UI
        },
    },
    { timestamps: true },
);

categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
