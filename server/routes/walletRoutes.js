const router = require("express").Router();
const {
    getWallets,
    getWalletById,
    createWallet,
    updateWallet,
    archiveWallet,
} = require("../controllers/walletController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getWallets);
router.get("/:id", getWalletById);
router.post("/", createWallet);
router.put("/:id", updateWallet);
router.delete("/:id", archiveWallet);

module.exports = router;
