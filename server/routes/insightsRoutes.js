const router = require("express").Router();
const { getOverview, getAnalytics, getMood } = require("../controllers/insightsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/overview", protect, getOverview);
router.get("/analytics", protect, getAnalytics);
router.get("/mood", protect, getMood);

module.exports = router;
