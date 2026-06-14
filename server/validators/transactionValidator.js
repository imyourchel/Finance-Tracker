const { body } = require("express-validator");

const MOOD_VALUES = [
    "senang",
    "sedih",
    "biasa",
    "self_reward",
    "terpaksa",
    "bangga",
    "bersalah",
];

const createTransactionRules = [
    body("walletId")
        .notEmpty().withMessage("Wallet wajib dipilih")
        .isMongoId().withMessage("Wallet ID tidak valid"),

    body("categoryId")
        .optional()
        .isMongoId().withMessage("Category ID tidak valid"),

    body("type")
        .notEmpty().withMessage("Tipe transaksi wajib diisi")
        .isIn(["income", "expense", "transfer"])
        .withMessage("Tipe harus income, expense, atau transfer"),

    body("amount")
        .notEmpty().withMessage("Jumlah wajib diisi")
        .isFloat({ min: 1 }).withMessage("Jumlah harus lebih dari 0"),

    body("mood")
        .optional()
        .isIn(MOOD_VALUES)
        .withMessage("Mood tidak valid"),

    body("tags")
        .optional()
        .customSanitizer((value) => {
            if (typeof value === "string") {
                return value.split(",").map(t => t.trim()).filter(Boolean);
            }
            return value;
        })
        .custom(value => Array.isArray(value))
        .withMessage("Tags harus berupa array")
];

const updateTransactionRules = [
    body("amount")
        .optional()
        .isFloat({ min: 1 }).withMessage("Jumlah harus lebih dari 0"),

    body("type")
        .optional()
        .isIn(["income", "expense", "transfer"])
        .withMessage("Tipe tidak valid"),

    body("walletId")
        .optional()
        .isMongoId().withMessage("Wallet ID tidak valid"),

    body("categoryId")
        .custom((value, { req }) => {
            if (req.body.type === "transfer") return true;
            if (!value) return true;
            return /^[0-9a-fA-F]{24}$/.test(value);
        })
        .withMessage("Category ID tidak valid"),

    body("date")
        .optional()
        .isISO8601().withMessage("Format tanggal tidak valid"),

    body("description")
        .optional()
        .isLength({ max: 500 }).withMessage("Deskripsi maksimal 500 karakter"),

    body("mood")
        .optional()
        .isIn(MOOD_VALUES)
        .withMessage("Mood tidak valid"),
];

module.exports = { createTransactionRules, updateTransactionRules };