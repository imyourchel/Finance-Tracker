const express = require("express");
const router = express.Router();
const {
    runRecurring,
    runBudgetAlert,
    runGoalAlert,
    runRollover,
    runDailyReminder,
} = require("../jobs/cronHandlers");

// Hanya Vercel Cron (atau pemanggil dengan CRON_SECRET) yang boleh memicu job di production
const verifyCron = (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const ua = req.headers["user-agent"] || "";
    const secret = process.env.CRON_SECRET;
    const authorized =
        (secret && req.headers.authorization === `Bearer ${secret}`) || (!secret && ua.includes("vercel-cron/1.0"));
    if (!authorized) return res.status(401).json({ error: "Unauthorized" });
    next();
};

router.get("/recurring", verifyCron, runRecurring);
router.get("/budget-alert", verifyCron, runBudgetAlert);
router.get("/goal-alert", verifyCron, runGoalAlert);
router.get("/rollover", verifyCron, runRollover);
router.get("/daily-reminder", verifyCron, runDailyReminder);

module.exports = router;
