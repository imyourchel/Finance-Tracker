const { body } = require("express-validator");

const createBudgetRules = [
    body("categoryId")
        .notEmpty().withMessage("Kategori wajib dipilih")
        .isMongoId().withMessage("Category ID tidak valid"),

    body("limit")
        .notEmpty().withMessage("Limit wajib diisi")
        .isFloat({ min: 1 }).withMessage("Limit harus lebih dari 0"),

    body("month")
        .notEmpty().withMessage("Bulan wajib diisi")
        .isInt({ min: 1, max: 12 }).withMessage("Bulan harus antara 1–12"),

    body("year")
        .notEmpty().withMessage("Tahun wajib diisi")
        .isInt({ min: 2000, max: 2100 }).withMessage("Tahun tidak valid"),

    body("alertThreshold")
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage("Alert threshold harus 1–100"),

    body("rollover")
        .optional()
        .isBoolean().withMessage("Rollover harus true atau false"),
];

const updateBudgetRules = [
    body("limit")
        .optional()
        .isFloat({ min: 1 }).withMessage("Limit harus lebih dari 0"),

    body("alertThreshold")
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage("Alert threshold harus 1–100"),
];

module.exports = { createBudgetRules, updateBudgetRules };