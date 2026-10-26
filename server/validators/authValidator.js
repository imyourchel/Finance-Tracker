const { body } = require("express-validator");

const registerRules = [
    body("name")
        .trim()
        .notEmpty().withMessage("Nama wajib diisi")
        .isLength({ max: 100 }).withMessage("Nama maksimal 100 karakter"),

    body("email")
        .trim()
        .notEmpty().withMessage("Email wajib diisi")
        .isEmail().withMessage("Format email tidak valid")
        .toLowerCase(),

    body("username")
        .trim()
        .notEmpty().withMessage("Username wajib diisi")
        .isLength({ min: 3, max: 30 }).withMessage("Username 3–30 karakter")
        .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username hanya boleh huruf, angka, underscore"),

    body("password")
        .notEmpty().withMessage("Password wajib diisi")
        .isLength({ min: 6 }).withMessage("Password minimal 6 karakter"),
];

const loginRules = [
    body("username").trim().notEmpty().withMessage("Username wajib diisi"),
    body("password").notEmpty().withMessage("Password wajib diisi"),
];

// currentPassword boleh kosong untuk akun Google yang belum punya password —
// pengecekan wajib/tidaknya dilakukan di controller.
const changePasswordRules = [
    body("currentPassword").optional({ values: "falsy" }).isString(),
    body("newPassword")
        .notEmpty().withMessage("Password baru wajib diisi")
        .isLength({ min: 6 }).withMessage("Password baru minimal 6 karakter"),
];

const forgotPasswordRules = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email wajib diisi")
        .isEmail().withMessage("Format email tidak valid")
        .toLowerCase(),
];

const resetPasswordRules = [
    body("newPassword")
        .notEmpty().withMessage("Password baru wajib diisi")
        .isLength({ min: 6 }).withMessage("Password baru minimal 6 karakter"),
];

module.exports = {
    registerRules,
    loginRules,
    changePasswordRules,
    forgotPasswordRules,
    resetPasswordRules,
};