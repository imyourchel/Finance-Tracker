const Recurring = require("../models/Recurring");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// ============================================================
// HELPER: Format Rupiah
// ============================================================
const formatRupiah = (n) =>
    "Rp " + Number(n).toLocaleString("id-ID");

// ============================================================
// JOB 1: Recurring transactions — setiap hari jam 00:05
// ============================================================
exports.runRecurring = async (req, res) => {
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const recurrings = await Recurring.find({
            isActive: true,
            nextRunDate: { $lte: todayStart },
        });

        for (const rec of recurrings) {
            await Transaction.create({
                user: rec.user,
                wallet: rec.wallet,
                type: rec.type,
                amount: rec.amount,
                category: rec.category,
                description: rec.description + " (recurring)",
                date: todayStart,
                isRecurring: true,
                recurringId: rec._id,
            });

            const wallet = await Wallet.findById(rec.wallet);
            if (wallet) {
                wallet.balance += rec.type === "income" ? rec.amount : -rec.amount;
                await wallet.save();
            }

            const next = new Date(rec.nextRunDate);
            if (rec.frequency === "daily") next.setDate(next.getDate() + 1);
            else if (rec.frequency === "weekly") next.setDate(next.getDate() + 7);
            else if (rec.frequency === "monthly") next.setMonth(next.getMonth() + 1);
            else if (rec.frequency === "yearly") next.setFullYear(next.getFullYear() + 1);

            rec.lastRunDate = todayStart;
            rec.nextRunDate = next;
            if (rec.endDate && next > rec.endDate) rec.isActive = false;
            await rec.save();
        }

        console.log(`[runRecurring] Selesai, ${recurrings.length} recurring diproses`);
        res.json({ ok: true, processed: recurrings.length });
    } catch (err) {
        console.error("[runRecurring] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================
// JOB 2: Rollover budget — tanggal 1 setiap bulan jam 00:10
// ============================================================
exports.runRollover = async (req, res) => {
    try {
        const now = new Date();
        const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const thisMonth = now.getMonth() + 1;
        const thisYear = now.getFullYear();

        const budgets = await Budget.find({ rollover: true, month: lastMonth, year: lastYear });

        let count = 0;
        for (const b of budgets) {
            const sisa = b.limit - b.spent;
            if (sisa <= 0) continue;

            const existing = await Budget.findOne({
                user: b.user,
                category: b.category,
                month: thisMonth,
                year: thisYear,
            });
            if (existing) {
                existing.limit += sisa;
                await existing.save();
                count++;
            }
        }

        console.log(`[runRollover] Selesai, ${count} budget di-rollover`);
        res.json({ ok: true, rolled: count });
    } catch (err) {
        console.error("[runRollover] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================
// JOB 3: Reset isAlertSent tiap awal bulan — tanggal 1 jam 00:15
// (digabung ke endpoint /budget-alert, dipanggil via vercel.json terpisah)
// ============================================================
exports.runBudgetAlert = async (req, res) => {
    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Reset isAlertSent kalau ini dipanggil di tanggal 1
        if (now.getDate() === 1) {
            await Budget.updateMany({}, { $set: { isAlertSent: false } });
            console.log("[runBudgetAlert] isAlertSent di-reset untuk bulan baru");
        }

        // Ambil semua budget bulan ini yang belum dikirim alert
        const budgets = await Budget.find({
            month,
            year,
            isAlertSent: false,
        }).populate("category", "name icon");

        let sent = 0;
        for (const budget of budgets) {
            if (budget.limit <= 0) continue;
            const pct = (budget.spent / budget.limit) * 100;
            if (pct < budget.alertThreshold) continue;

            const user = await User.findById(budget.user);
            if (!user || !user.notifications?.budgetAlert) continue;
            if (!user.email) continue;

            const isOver = budget.spent > budget.limit;
            const subject = isOver
                ? `🚨 Budget "${budget.category?.name}" Sudah Melebihi Limit!`
                : `⚠️ Budget "${budget.category?.name}" Hampir Habis (${Math.round(pct)}%)`;

            const html = `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:${isOver ? "#ef4444" : "#f59e0b"};padding:24px;text-align:center">
                        <h2 style="margin:0;color:white;font-size:20px">${isOver ? "🚨 Budget Terlampaui!" : "⚠️ Budget Hampir Habis"}</h2>
                    </div>
                    <div style="padding:24px">
                        <p style="margin:0 0 8px;color:#374151">Halo <strong>${user.name}</strong>,</p>
                        <p style="color:#6b7280;margin:0 0 20px">
                            ${isOver
                    ? `Budget kategori <strong>${budget.category?.name}</strong> kamu sudah <strong>melebihi limit</strong>!`
                    : `Budget kategori <strong>${budget.category?.name}</strong> kamu sudah mencapai <strong>${Math.round(pct)}%</strong> dari limit.`
                }
                        </p>
                        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
                            <tr style="background:#f3f4f6">
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Kategori</td>
                                <td style="padding:10px 14px;font-weight:600;color:#111827">${budget.category?.icon || ""} ${budget.category?.name}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Limit</td>
                                <td style="padding:10px 14px;font-weight:600;color:#111827">${formatRupiah(budget.limit)}</td>
                            </tr>
                            <tr style="background:#f3f4f6">
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Terpakai</td>
                                <td style="padding:10px 14px;font-weight:600;color:${isOver ? "#ef4444" : "#f59e0b"}">${formatRupiah(budget.spent)} (${Math.round(pct)}%)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Sisa</td>
                                <td style="padding:10px 14px;font-weight:600;color:${isOver ? "#ef4444" : "#10b981"}">${formatRupiah(Math.max(0, budget.limit - budget.spent))}</td>
                            </tr>
                        </table>
                        <p style="margin:20px 0 0;color:#6b7280;font-size:13px">
                            ${isOver ? "Pertimbangkan untuk mengurangi pengeluaran di kategori ini." : "Pantau pengeluaran kamu agar tetap dalam anggaran."}
                        </p>
                    </div>
                    <div style="padding:16px 24px;background:#f3f4f6;text-align:center">
                        <p style="margin:0;color:#9ca3af;font-size:12px">DailyTrack Finance Tracker</p>
                    </div>
                </div>
            `;

            try {
                await sendEmail({ to: user.email, subject, html });
                budget.isAlertSent = true;
                await budget.save();
                sent++;
                console.log(`[runBudgetAlert] Email terkirim ke ${user.email} — ${budget.category?.name} ${Math.round(pct)}%`);
            } catch (emailErr) {
                console.error(`[runBudgetAlert] Gagal kirim email ke ${user.email}:`, emailErr.message);
            }
        }

        res.json({ ok: true, sent });
    } catch (err) {
        console.error("[runBudgetAlert] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================
// JOB 4: Goal alert — setiap hari jam 08:00
// ============================================================
exports.runGoalAlert = async (req, res) => {
    try {
        const goals = await Goal.find({ status: "active" });

        let sent = 0;
        for (const goal of goals) {
            const user = await User.findById(goal.user);
            if (!user || !user.notifications?.goalAlert) continue;
            if (!user.email) continue;

            const pct = goal.targetAmount > 0
                ? (goal.currentAmount / goal.targetAmount) * 100
                : 0;

            const isJustCompleted = goal.currentAmount >= goal.targetAmount;

            let isDueSoon = false;
            let daysLeft = null;
            if (goal.deadline) {
                const now = new Date();
                const diff = goal.deadline - now;
                daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                isDueSoon = daysLeft > 0 && daysLeft <= 7;
            }

            if (!isJustCompleted && !isDueSoon) continue;

            let subject, bodyContent;

            if (isJustCompleted) {
                subject = `🎉 Goal "${goal.name}" Tercapai!`;
                bodyContent = `
                    <p style="color:#374151;margin:0 0 8px">Halo <strong>${user.name}</strong>, selamat! 🎊</p>
                    <p style="color:#6b7280;margin:0 0 20px">Goal <strong>"${goal.name}"</strong> kamu sudah <strong>tercapai</strong>! Kerja keras kamu terbayar.</p>
                `;
            } else {
                subject = `⏰ Goal "${goal.name}" Deadline dalam ${daysLeft} Hari!`;
                bodyContent = `
                    <p style="color:#374151;margin:0 0 8px">Halo <strong>${user.name}</strong>,</p>
                    <p style="color:#6b7280;margin:0 0 20px">Goal <strong>"${goal.name}"</strong> kamu akan berakhir dalam <strong>${daysLeft} hari</strong>. Yuk semangat!</p>
                `;
            }

            const html = `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:${isJustCompleted ? "#10b981" : "#6366f1"};padding:24px;text-align:center">
                        <h2 style="margin:0;color:white;font-size:20px">${isJustCompleted ? "🎉 Goal Tercapai!" : "⏰ Deadline Mendekat"}</h2>
                    </div>
                    <div style="padding:24px">
                        ${bodyContent}
                        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
                            <tr style="background:#f3f4f6">
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Goal</td>
                                <td style="padding:10px 14px;font-weight:600;color:#111827">${goal.name}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Target</td>
                                <td style="padding:10px 14px;font-weight:600;color:#111827">${formatRupiah(goal.targetAmount)}</td>
                            </tr>
                            <tr style="background:#f3f4f6">
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Terkumpul</td>
                                <td style="padding:10px 14px;font-weight:600;color:#10b981">${formatRupiah(goal.currentAmount)} (${Math.round(pct)}%)</td>
                            </tr>
                            ${goal.deadline ? `
                            <tr>
                                <td style="padding:10px 14px;color:#6b7280;font-size:13px">Deadline</td>
                                <td style="padding:10px 14px;font-weight:600;color:#111827">${new Date(goal.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
                            </tr>` : ""}
                        </table>
                    </div>
                    <div style="padding:16px 24px;background:#f3f4f6;text-align:center">
                        <p style="margin:0;color:#9ca3af;font-size:12px">DailyTrack Finance Tracker</p>
                    </div>
                </div>
            `;

            try {
                await sendEmail({ to: user.email, subject, html });
                if (isJustCompleted) {
                    goal.status = "completed";
                    goal.completedAt = new Date();
                    await goal.save();
                }
                sent++;
                console.log(`[runGoalAlert] Email terkirim ke ${user.email} — "${goal.name}"`);
            } catch (emailErr) {
                console.error(`[runGoalAlert] Gagal kirim email ke ${user.email}:`, emailErr.message);
            }
        }

        res.json({ ok: true, sent });
    } catch (err) {
        console.error("[runGoalAlert] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================
// JOB 5: Daily reminder — Vercel trigger jam tertentu (UTC)
// Karena Vercel tidak bisa per-menit, kirim ke semua user
// yang reminderTime-nya dalam window ±1 menit dari sekarang
// ============================================================
exports.runDailyReminder = async (req, res) => {
    try {
        const now = new Date();
        const currentHour = String(now.getUTCHours()).padStart(2, "0");
        const currentMinute = String(now.getUTCMinutes()).padStart(2, "0");
        const currentTime = `${currentHour}:${currentMinute}`;

        // Cari user yang reminderTime-nya cocok dengan waktu sekarang (UTC)
        const users = await User.find({
            "notifications.dailyReminder": true,
            "notifications.reminderTime": currentTime,
            isActive: true,
        });

        let sent = 0;
        for (const user of users) {
            if (!user.email) continue;

            const todayStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            const todayEnd = new Date(todayStart);
            todayEnd.setDate(todayEnd.getDate() + 1);

            const todayTransactions = await Transaction.find({
                user: user._id,
                type: "expense",
                isDeleted: false,
                date: { $gte: todayStart, $lt: todayEnd },
            });

            const totalHariIni = todayTransactions.reduce((s, t) => s + t.amount, 0);
            const jumlahTransaksi = todayTransactions.length;

            const subject = `📊 Rangkuman Keuangan Hari Ini — ${now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`;

            const html = `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center">
                        <h2 style="margin:0;color:white;font-size:20px">📊 Rangkuman Harian</h2>
                        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <div style="padding:24px">
                        <p style="margin:0 0 20px;color:#374151">Halo <strong>${user.name}</strong>! Ini rangkuman keuangan kamu hari ini 👇</p>
                        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
                            <tr style="background:#f3f4f6">
                                <td style="padding:12px 16px;color:#6b7280;font-size:13px">Total Pengeluaran Hari Ini</td>
                                <td style="padding:12px 16px;font-weight:700;color:#ef4444;text-align:right">${formatRupiah(totalHariIni)}</td>
                            </tr>
                            <tr>
                                <td style="padding:12px 16px;color:#6b7280;font-size:13px">Jumlah Transaksi</td>
                                <td style="padding:12px 16px;font-weight:600;color:#111827;text-align:right">${jumlahTransaksi} transaksi</td>
                            </tr>
                        </table>
                        <p style="margin:20px 0 0;color:#6b7280;font-size:13px;text-align:center">
                            ${jumlahTransaksi === 0
                    ? "Belum ada transaksi hari ini. Jangan lupa catat pengeluaranmu! 📝"
                    : "Tetap semangat menjaga keuangan kamu! 💪"
                }
                        </p>
                    </div>
                    <div style="padding:16px 24px;background:#f3f4f6;text-align:center">
                        <p style="margin:0;color:#9ca3af;font-size:12px">DailyTrack Finance Tracker — Notifikasi ini dikirim sesuai preferensi kamu</p>
                    </div>
                </div>
            `;

            try {
                await sendEmail({ to: user.email, subject, html });
                sent++;
                console.log(`[runDailyReminder] Email terkirim ke ${user.email} jam ${currentTime} UTC`);
            } catch (emailErr) {
                console.error(`[runDailyReminder] Gagal kirim email ke ${user.email}:`, emailErr.message);
            }
        }

        res.json({ ok: true, sent });
    } catch (err) {
        console.error("[runDailyReminder] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};