const router = require("express").Router();
const {
    exportTransactionsCsv,
    exportBackup,
    previewImport,
    importTransactions,
    undoImport,
} = require("../controllers/dataController");
const { protect } = require("../middleware/authMiddleware");

router.get("/export/transactions.csv", protect, exportTransactionsCsv);
router.get("/export/backup.json", protect, exportBackup);
router.post("/import/preview", protect, previewImport);
router.post("/import/transactions", protect, importTransactions);
router.post("/import/undo", protect, undoImport);

module.exports = router;
