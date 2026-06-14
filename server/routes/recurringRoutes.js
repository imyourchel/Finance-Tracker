const router = require("express").Router();
const {
    getRecurrings,
    createRecurring,
    toggleRecurring,
    updateRecurring,
    deleteRecurring,
} = require("../controllers/recurringController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getRecurrings);
router.post("/", createRecurring);
router.put("/:id/toggle", toggleRecurring);
router.put("/:id", updateRecurring);
router.delete("/:id", deleteRecurring);

module.exports = router;
