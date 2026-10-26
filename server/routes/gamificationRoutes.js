const router = require("express").Router();
const {
    getGamification,
    claimQuest,
    joinChallenge,
    abandonChallenge,
} = require("../controllers/gamificationController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getGamification);
router.post("/quests/:questId/claim", protect, claimQuest);
router.post("/challenges", protect, joinChallenge);
router.delete("/challenges/:id", protect, abandonChallenge);

module.exports = router;
