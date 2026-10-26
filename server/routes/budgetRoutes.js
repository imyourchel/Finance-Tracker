const router = require("express").Router();
const {
    getBudgets,
    getSuggestions,
    createBudget,
    copyPreviousBudgets,
    updateBudget,
    deleteBudget,
} = require("../controllers/budgetController");
const { protect } = require("../middleware/authMiddleware");

const { createBudgetRules, updateBudgetRules } = require("../validators/budgetValidator");
const validate = require("../middleware/validate");

router.use(protect);

router.get("/", getBudgets);
router.get("/suggestions", getSuggestions);
router.post("/", createBudgetRules, validate, createBudget);
router.post("/copy-previous", copyPreviousBudgets);
router.put("/:id", updateBudgetRules, validate, updateBudget);
router.delete("/:id", deleteBudget);

module.exports = router;
