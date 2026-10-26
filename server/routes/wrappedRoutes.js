const router = require("express").Router();
const { getWrapped } = require("../controllers/wrappedController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/wrapped?period=month&year=2026&month=10  atau  ?period=year&year=2026
router.get("/", protect, getWrapped);

module.exports = router;
