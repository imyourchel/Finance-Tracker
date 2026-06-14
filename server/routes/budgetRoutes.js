const router = require("express").Router();
const {
    getBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
} = require("../controllers/budgetController");
const { protect } = require("../middleware/authMiddleware");

const { createBudgetRules, updateBudgetRules } = require("../validators/budgetValidator");
const validate = require("../middleware/validate");


router.use(protect);

router.get("/", getBudgets);
// router.post("/", createBudget);
// router.put("/:id", updateBudget);

router.post("/", createBudgetRules, validate, createBudget);
router.put("/:id", updateBudgetRules, validate, updateBudget);
router.delete("/:id", deleteBudget);

module.exports = router;


