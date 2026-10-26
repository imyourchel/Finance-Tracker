const router = require("express").Router();
const {
    getWellness,
    updateProfile,
    ignoreSubscription,
    unignoreSubscription,
} = require("../controllers/wellnessController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getWellness);
router.put("/profile", protect, updateProfile);
router.post("/subscriptions/ignore", protect, ignoreSubscription);
router.post("/subscriptions/unignore", protect, unignoreSubscription);

module.exports = router;
