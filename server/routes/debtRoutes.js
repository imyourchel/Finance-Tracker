const router = require("express").Router();
const {
    getDebts,
    createDebt,
    updateDebt,
    deleteDebt,
    addPayment,
    deletePayment,
    createSplit,
    deleteSplit,
} = require("../controllers/debtController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getDebts);
router.post("/", createDebt);
// Patungan didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id
router.post("/splits", createSplit);
router.delete("/splits/:id", deleteSplit);
router.put("/:id", updateDebt);
router.delete("/:id", deleteDebt);
router.post("/:id/payments", addPayment);
router.delete("/:id/payments/:paymentId", deletePayment);

module.exports = router;
