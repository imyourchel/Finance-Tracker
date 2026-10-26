const router = require("express").Router();
const { getPayday } = require("../controllers/paydayController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getPayday);

module.exports = router;
