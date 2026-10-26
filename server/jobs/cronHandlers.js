const Recurring = require("../models/Recurring");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const User = require("../models/User");
const { getBudgets } = require("../controllers/budgetController");
const { _internal: gami } = require("../controllers/gamificationController");
const callHandler = require("./callHandler");
const { claimSent, releaseSent } = require("./state");
const { layout, send, rupiah, esc, emailConfigured } = require("./email");
const { wib, dayKey, startOfKey, addDays, toMinutes, DAY_MS } = require("./time");

/*
 * Job terjadwal DailyTrack
 * ────────────────────────
 * Semua job idempoten: aman dijalankan berkali-kali.
 * - Lokal: dijalankan oleh utils/scheduler.js tiap menit (lihat jadwalnya di sana).
 * - Vercel: dipanggil lewat /api/cron/* sesuai vercel.json.
 * Waktu "hari ini" dan jam pengingat selalu WIB.
 */

const log = (job, msg) => console.log(`[${job}] ${msg}`);

// ── Tagihan & pemasukan rutin ───────────────────────────────────────
function advance(date, frequency) {
    const d = new Date(date);
    if (frequency === "daily") d.setUTCDate(d.getUTCDate() + 1);
    else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
    else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
    else {
        // bulanan: tanggal 31 → akhir bulan berikutnya, bukan meloncat ke bulan depannya lagi
        const day = d.getUTCDate();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() + 1);
        const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(day, last));
    }
    return d;
}

async function runRecurringJob(now = new Date()) {
    const due = await Recurring.find({ isActive: true, nextRunDate: { $lte: now } }).lean();
    let created = 0;
    for (const rec of due) {
        let runDate = new Date(rec.nextRunDate);
        // Kejar ketinggalan (mis. server mati beberapa hari), maksimal 62 kali per rutin
        for (let i = 0; i < 62 && runDate <= now; i += 1) {
            if (rec.endDate && runDate > new Date(rec.endDate)) {
                await Recurring.updateOne({ _id: rec._id }, { $set: { isActive: false } });
                break;
            }
            const next = advance(runDate, rec.frequency);
            const ended = rec.endDate && next > new Date(rec.endDate);
            // Klaim atomik: hanya satu proses yang berhasil memajukan nextRunDate ini
            const claimed = await Recurring.findOneAndUpdate(
                { _id: rec._id, isActive: true, nextRunDate: runDate },
                { $set: { nextRunDate: next, lastRunDate: runDate, ...(ended && { isActive: false }) } },
                { new: true },
            );
            if (!claimed) break;

            await Transaction.create({
                user: rec.user,
                wallet: rec.wallet,
                type: rec.type,
                amount: rec.amount,
                category: rec.category,
                description: rec.description || "",
                date: runDate,
                isRecurring: true,
                recurringId: rec._id,
            });
            await Wallet.updateOne(
                { _id: rec.wallet, user: rec.user },
                { $inc: { balance: rec.type === "income" ? rec.amount : -rec.amount } },
            );
            created += 1;
            if (ended) break;
            runDate = next;
        }
    }
    if (created) log("recurring", `${created} transaksi rutin dibuat dari ${due.length} jadwal`);
    return { due: due.length, created };
}

// ── Rollover budget ─────────────────────────────────────────────────
// Rollover sekarang dihitung langsung saat budget dibuka (lihat budgetController),
// jadi job ini sengaja tidak mengubah limit lagi supaya tidak terhitung dua kali.
async function runRolloverJob() {
    return { skipped: true, reason: "Rollover dihitung otomatis di budgetController" };
}

// ── Budget hampir habis / jebol ─────────────────────────────────────
async function budgetStatusFor(userId, t) {
    const list = await callHandler(getBudgets, { user: userId, query: { month: t.month, year: t.year } });
    return Array.isArray(list) ? list : [];
}

async function runBudgetAlertJob(now = new Date()) {
    const t = wib(now);
    const userIds = await Budget.distinct("user", { month: t.month, year: t.year });
    let sent = 0;
    for (const uid of userIds) {
        const user = await User.findById(uid).select("name email notifications isActive").lean();
        if (!user?.email || user.isActive === false || user.notifications?.budgetAlert === false) continue;

        const budgets = await budgetStatusFor(uid, t);
        const alerts = [];
        for (const b of budgets) {
            const over = b.spent > (b.effectiveLimit ?? b.limit);
            const pct = b.percentage ?? 0;
            if (!over && pct < (b.alertThreshold || 80)) continue;
            const key = `budget:${b._id}:${over ? "over" : "warn"}:${t.year}-${t.month}`;
            if (await claimSent(uid, key)) alerts.push({ b, over, pct, key });
        }
        if (!alerts.length) continue;

        const anyOver = alerts.some((a) => a.over);
        const subject = anyOver
            ? `Budget ${alerts.find((a) => a.over).b.category?.name || ""} sudah jebol`
            : `Budget ${alerts[0].b.category?.name || ""} sudah ${alerts[0].pct}%`;
        const html = layout({
            kicker: "Peringatan budget",
            title: anyOver ? "Ada budget yang jebol" : "Budget hampir habis",
            intro: `Halo <strong>${esc(user.name)}</strong>, ini kondisi budget bulan ini yang perlu kamu perhatikan.`,
            rows: alerts.map(({ b, over, pct }) => [
                b.category?.name || "Kategori",
                `${rupiah(b.spent)} / ${rupiah(b.effectiveLimit ?? b.limit)} (${pct}%)`,
                over ? "#c2453b" : "#b06c12",
            ]),
            note: "Tips: lihat sisa aman per hari di halaman Budget supaya sisa bulan tetap terkendali.",
            cta: { label: "Buka Budget", path: "/budgets" },
        });
        try {
            await send(user.email, subject, html);
            sent += 1;
        } catch (e) {
            for (const a of alerts) await releaseSent(uid, a.key);
            log("budgetAlert", `gagal kirim ke ${user.email}: ${e.message}`);
        }
    }
    return { users: userIds.length, sent };
}

// ── Goal: tenggat dekat / tercapai ──────────────────────────────────
async function runGoalAlertJob(now = new Date()) {
    const t = wib(now);
    const in7 = startOfKey(addDays(t.key, 8));
    const recentDone = new Date(now.getTime() - 2 * DAY_MS);
    const goals = await Goal.find({
        $or: [
            { status: "active", deadline: { $ne: null, $gte: startOfKey(t.key), $lt: in7 } },
            { status: "completed", completedAt: { $gte: recentDone } },
        ],
    }).lean();

    const byUser = new Map();
    for (const g of goals) {
        const list = byUser.get(String(g.user)) || [];
        list.push(g);
        byUser.set(String(g.user), list);
    }

    let sent = 0;
    for (const [uid, list] of byUser) {
        const user = await User.findById(uid).select("name email notifications isActive").lean();
        if (!user?.email || user.isActive === false || user.notifications?.goalAlert === false) continue;
        const items = [];
        for (const g of list) {
            if (g.status === "completed") {
                const key = `goal:${g._id}:done`;
                if (await claimSent(uid, key)) items.push({ g, key, done: true });
                continue;
            }
            const daysLeft = Math.round((Date.parse(dayKey(g.deadline)) - Date.parse(t.key)) / DAY_MS);
            const stage = daysLeft <= 1 ? "d1" : "d7";
            const key = `goal:${g._id}:${stage}:${dayKey(g.deadline)}`;
            if (await claimSent(uid, key)) items.push({ g, key, daysLeft });
        }
        if (!items.length) continue;

        const done = items.filter((i) => i.done);
        const subject = done.length ? `Selamat! Goal "${done[0].g.name}" tercapai` : `Tenggat goal "${items[0].g.name}" tinggal ${items[0].daysLeft} hari`;
        const html = layout({
            kicker: "Goal tabungan",
            title: done.length ? "Goal tercapai!" : "Tenggat goal mendekat",
            intro: `Halo <strong>${esc(user.name)}</strong>, ${done.length ? "kerja kerasmu terbayar." : "yuk kejar target sebelum tenggatnya."}`,
            rows: items.map(({ g, done: d, daysLeft }) => [
                g.name,
                d
                    ? `${rupiah(g.currentAmount)} ✓`
                    : `${rupiah(g.currentAmount)} / ${rupiah(g.targetAmount)} · ${daysLeft <= 0 ? "hari ini" : `${daysLeft} hari lagi`}`,
                d ? "#1f8a5b" : "#13221e",
            ]),
            cta: { label: "Buka Goals", path: "/goals" },
        });
        try {
            await send(user.email, subject, html);
            sent += 1;
        } catch (e) {
            for (const i of items) await releaseSent(uid, i.key);
            log("goalAlert", `gagal kirim ke ${user.email}: ${e.message}`);
        }
    }
    return { goals: goals.length, sent };
}

// ── Pengingat harian ────────────────────────────────────────────────
// Hanya dikirim kalau pengguna belum mencatat apa pun hari ini (WIB).
// windowMinutes: kirim ke pengguna yang jam pengingatnya jatuh dalam jendela ini
// (lokal: 15 menit; Vercel yang hanya jalan sekali sehari: seharian).
async function streakInfo(userId, todayKey) {
    const since = startOfKey(addDays(todayKey, -400));
    const rows = await Transaction.find({ user: userId, isDeleted: false, createdAt: { $gte: since } })
        .select("createdAt")
        .lean();
    const days = new Set(rows.map((r) => dayKey(r.createdAt)));
    return gami.computeStreak(days, todayKey);
}

function dueReminderUsers(users, now, windowMinutes) {
    const t = wib(now);
    return users.filter((u) => {
        const m = toMinutes(u.notifications?.reminderTime || "20:00");
        return m !== null && m <= t.minutes && t.minutes - m <= windowMinutes;
    });
}

async function runDailyReminderJob(now = new Date(), { windowMinutes = 15 } = {}) {
    const t = wib(now);
    const users = await User.find({ "notifications.dailyReminder": { $ne: false }, isActive: { $ne: false }, email: { $ne: null } })
        .select("name email notifications")
        .lean();
    const due = dueReminderUsers(users, now, windowMinutes);
    let sent = 0;
    let skippedLogged = 0;
    for (const user of due) {
        const loggedToday = await Transaction.exists({
            user: user._id,
            isDeleted: false,
            createdAt: { $gte: startOfKey(t.key) },
        });
        if (loggedToday) {
            skippedLogged += 1;
            continue;
        }
        const key = `daily:${t.key}`;
        if (!(await claimSent(user._id, key))) continue;

        try {
            const streak = await streakInfo(user._id, t.key);
            let budgets = [];
            try {
                budgets = (await budgetStatusFor(user._id, t)).filter(
                    (b) => b.spent > (b.effectiveLimit ?? b.limit) || (b.percentage ?? 0) >= (b.alertThreshold || 80),
                );
            } catch {
                budgets = [];
            }
            const subject =
                streak.current > 0
                    ? `Streak ${streak.current} hari-mu menunggu catatan hari ini`
                    : "Belum ada catatan hari ini";
            const rows = [];
            if (streak.current > 0) rows.push(["Streak sekarang", `${streak.current} hari`, "#e0672b"]);
            if (streak.current > 0)
                rows.push([
                    "Perisai streak",
                    streak.shields > 0 ? `${streak.shields} siap menyelamatkan` : "Kosong — streak bisa putus",
                    streak.shields > 0 ? "#1f8a5b" : "#c2453b",
                ]);
            for (const b of budgets.slice(0, 3)) {
                rows.push([`Budget ${b.category?.name || ""}`, `${b.percentage}% terpakai`, b.spent > (b.effectiveLimit ?? b.limit) ? "#c2453b" : "#b06c12"]);
            }
            const html = layout({
                kicker: "Pengingat harian",
                title: streak.current > 0 ? "Jaga streak-mu tetap menyala" : "Yuk catat pengeluaran hari ini",
                intro: `Halo <strong>${esc(user.name)}</strong>, kamu belum mencatat transaksi hari ini. Cukup satu kalimat, misalnya <em>"kopi 18rb gopay"</em>, lewat Catat cepat (Ctrl+K).`,
                rows,
                note:
                    streak.current > 0 && streak.shields === 0
                        ? "Tanpa perisai, streak akan kembali ke 0 kalau hari ini terlewat."
                        : null,
                cta: { label: "Catat sekarang", path: "/" },
            });
            await send(user.email, subject, html);
            sent += 1;
        } catch (e) {
            await releaseSent(user._id, key);
            log("dailyReminder", `gagal kirim ke ${user.email}: ${e.message}`);
        }
    }
    return { candidates: due.length, sent, skippedLogged };
}

// ── Pembungkus Express untuk /api/cron/* (Vercel) ───────────────────
const wrap = (name, job, opts) => async (req, res) => {
    try {
        const result = await job(new Date(), opts);
        res.json({ ok: true, job: name, ...result });
    } catch (err) {
        console.error(`[${name}] Error:`, err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
};

module.exports = {
    runRecurringJob,
    runRolloverJob,
    runBudgetAlertJob,
    runGoalAlertJob,
    runDailyReminderJob,
    emailConfigured,
    runRecurring: wrap("recurring", runRecurringJob),
    runRollover: wrap("rollover", runRolloverJob),
    runBudgetAlert: wrap("budgetAlert", runBudgetAlertJob),
    runGoalAlert: wrap("goalAlert", runGoalAlertJob),
    // Vercel memanggil sekali sehari → kirim ke semua yang jam pengingatnya sudah lewat hari ini
    runDailyReminder: wrap("dailyReminder", runDailyReminderJob, { windowMinutes: 24 * 60 }),
    _internal: { advance, dueReminderUsers },
};
