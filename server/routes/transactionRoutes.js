const router = require("express").Router();
const {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getSummary,
    getComparison,
} = require("../controllers/transactionController");
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../uploads/receipts"));
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

router.use(protect);

router.get("/summary", getSummary);
router.get("/comparison", getComparison);
router.get("/", getTransactions);
// router.post("/", upload.single("receipt"), createTransaction);
// router.put("/:id", upload.single("receipt"), updateTransaction);
router.delete("/:id", deleteTransaction);

module.exports = router;


const { createTransactionRules, updateTransactionRules } = require("../validators/transactionValidator");
const validate = require("../middleware/validate");

router.post("/",    upload.single("receipt"), createTransactionRules, validate, createTransaction);
router.put("/:id",  upload.single("receipt"), updateTransactionRules, validate, updateTransaction);

const { getYearRange } = require("../controllers/transactionController");

router.get("/year-range", getYearRange);   // taruh sebelum router.get("/", ...)