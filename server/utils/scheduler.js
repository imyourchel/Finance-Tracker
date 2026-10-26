const mongoose = require("mongoose");
const jobs = require("../jobs/cronHandlers");
const { claimJob } = require("../jobs/state");
const { wib } = require("../jobs/time");

/*
 * Penjadwal lokal (bukan Vercel). Berdetak tiap menit, semua waktu WIB.
 *  - Transaksi rutin : tiap jam di menit ke-5 (dan langsung mengejar yang terlewat)
 *  - Alert goal      : sekali sehari mulai 08.00
 *  - Alert budget    : sekali sehari mulai 09.00
 *  - Pengingat harian: tiap menit, untuk pengguna yang jam pengingatnya baru lewat (≤15 menit)
 * Tiap jadwal diklaim di koleksi JobRun, jadi tidak dobel walau server restart
 * atau ada lebih dari satu proses.
 */

const TASKS = [
    { name: "recurring", key: (t) => (t.minute >= 5 ? `${t.key}T${t.hour}` : null), run: jobs.runRecurringJob },
    { name: "goalAlert", key: (t) => (t.hour >= 8 ? t.key : null), run: jobs.runGoalAlertJob },
    { name: "budgetAlert", key: (t) => (t.hour >= 9 ? t.key : null), run: jobs.runBudgetAlertJob },
    {
        name: "dailyReminder",
        key: (t) => `${t.key}T${t.hhmm}`,
        run: (now) => jobs.runDailyReminderJob(now, { windowMinutes: 15 }),
        needsEmail: true,
    },
];

// Daftar task yang jatuh tempo pada waktu ini (dipisah supaya mudah dites)
function dueTasks(now = new Date()) {
    const t = wib(now);
    return TASKS.map((task) => ({ task, key: task.key(t) })).filter((x) => x.key);
}

let running = false;
let timer = null;

async function tick(now = new Date()) {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
        for (const { task, key } of dueTasks(now)) {
            if (task.needsEmail && !jobs.emailConfigured()) continue;
            if (!(await claimJob(task.name, key))) continue;
            try {
                await task.run(now);
            } catch (e) {
                console.error(`[scheduler] ${task.name} gagal:`, e.message);
            }
        }
    } finally {
        running = false;
    }
}

function start() {
    if (timer) return;
    console.log(
        `[scheduler] aktif (WIB). Email ${jobs.emailConfigured() ? "siap" : "belum dikonfigurasi — pengingat email dilewati"}.`,
    );
    setTimeout(() => tick().catch(() => {}), 10 * 1000);
    timer = setInterval(() => tick().catch(() => {}), 60 * 1000);
}

function stop() {
    if (timer) clearInterval(timer);
    timer = null;
}

module.exports = { start, stop, tick, dueTasks };
