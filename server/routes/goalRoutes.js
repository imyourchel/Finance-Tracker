const router = require("express").Router();
const {
    getGoals,
    createGoal,
    addSavingToGoal,
    updateGoal,
    deleteGoal,
} = require("../controllers/goalController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getGoals);
router.post("/", createGoal);
router.post("/:id/saving", addSavingToGoal);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

module.exports = router;
