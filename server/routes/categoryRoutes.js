const router = require("express").Router();
const {
    getCategories,
    createCategory,
    deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getCategories);
router.post("/", createCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
