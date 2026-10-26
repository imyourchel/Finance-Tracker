const router = require("express").Router();
const { getNotifications, markRead, sendTestEmail } = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getNotifications);
router.post("/read", protect, markRead);
router.post("/test-email", protect, sendTestEmail);

module.exports = router;
