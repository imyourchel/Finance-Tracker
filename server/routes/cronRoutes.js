const express = require("express");
const router = express.Router();

const { runRecurring } = require("../jobs/cronHandlers");
const { runBudgetAlert } = require("../jobs/cronHandlers");
const { runGoalAlert } = require("../jobs/cronHandlers");
const { runRollover } = require("../jobs/cronHandlers");
const { runDailyReminder } = require("../jobs/cronHandlers");

// Middleware: hanya izinkan request dari Vercel Cron
const verifyCron = (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    if (process.env.NODE_ENV === "production" && !ua.includes("vercel-cron/1.0")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

router.get("/recurring", verifyCron, runRecurring);
router.get("/budget-alert", verifyCron, runBudgetAlert);
router.get("/goal-alert", verifyCron, runGoalAlert);
router.get("/rollover", verifyCron, runRollover);
router.get("/daily-reminder", verifyCron, runDailyReminder);

module.exports = router;