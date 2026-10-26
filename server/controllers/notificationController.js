const User = require("../models/User");
const Recurring = require("../models/Recurring");
const Goal = require("../models/Goal");
const Debt = require("../models/Debt");
const NotificationState = require("../models/NotificationState");
const { getBudgets } = require("./budgetController");
const { getGamification } = require("./gamificationController");
const callHandler = require("../jobs/callHandler");
const { layout, send, esc, emailConfigured } = require("../jobs/email");
const { wib, dayKey, startOfKey, addDays, toMinutes, DAY_MS } = require("../jobs/time");

/*
 * Pusat notifikasi (lonceng di aplikasi).
 * Notifikasi dihitung langsung dari data saat diminta — tidak ada yang disimpan
 * selain daftar id yang sudah dibaca. Id dibuat dari isi + periodenya, jadi
 * kejadian yang sama tidak muncul ulang sebagai "baru", tapi kejadian baru
 * (mis. budget yang tadinya 80% lalu jebol) dapat id baru.
 */

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const TONE_ORDER = { danger: 0, warn: 1, info: 2, good: 3 };
const daysBetweenKeys = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const relDay = (n) => (n < 0 ? `lewat ${-n} hari` : n === 0 ? "hari ini" : n === 1 ? "besok" : `${n} hari lagi`);

// Fungsi murni: susun daftar notifikasi dari data mentah (dipisah supaya mudah dites)
function buildNotifications({ now, user, gamification, budgets, recurrings, debts, goals }) {
    const t = wib(now);
    const items = [];
    const push = (it) => items.push({ priority: "normal", ...it });

    // Streak
    const s = gamification?.streak;
    if (s && !s.activeToday) {
        const remind = toMinutes(user?.notifications?.reminderTime || "20:00") ?? 1200;
        const late = t.minutes >= remind;
        if (s.current > 0) {
            push({
                id: `streak:${t.key}`,
                kind: "streak",
                tone: late ? "danger" : "warn",
                priority: late ? "high" : "normal",
                title: `Streak ${s.current} hari belum menyala hari ini`,
                body:
                    s.shields > 0
                        ? `Catat satu transaksi sebelum tengah malam. Kalau terlewat, 1 dari ${s.shields} perisai akan dipakai.`
                        : "Catat satu transaksi sebelum tengah malam supaya streak tidak kembali ke 0.",
                link: "/",
                action: "quickadd",
            });
        } else if (late) {
            push({
                id: `streak-start:${t.key}`,
                kind: "streak",
                tone: "info",
                title: "Belum ada catatan hari ini",
                body: "Mulai streak baru dengan satu catatan kecil.",
                link: "/",
                action: "quickadd",
            });
        }
    }

    // Misi siap diklaim
    const claimable = [...(gamification?.quests?.daily || []), ...(gamification?.quests?.weekly || [])].filter((q) => q.claimable);
    if (claimable.length) {
        const xp = claimable.reduce((a, q) => a + (q.xp || 0), 0);
        push({
            id: `quests:${t.key}:${claimable.map((q) => q.id).sort().join(",")}`,
            kind: "quest",
            tone: "good",
            title: `${claimable.length} misi siap diklaim`,
            body: `${claimable.map((q) => q.title).slice(0, 2).join(", ")}${claimable.length > 2 ? ", …" : ""} · total +${xp} XP`,
            link: "/pencapaian?tab=misi",
        });
    }

    // Tantangan yang baru selesai (2 hari terakhir)
    for (const c of gamification?.challenges?.history || []) {
        if (!c.finishedAt || now - new Date(c.finishedAt) > 2 * DAY_MS || c.status === "abandoned") continue;
        push({
            id: `challenge:${c.id}:${c.status}`,
            kind: "challenge",
            tone: c.status === "completed" ? "good" : "info",
            title: c.status === "completed" ? `Tantangan selesai: ${c.title}` : `Tantangan berakhir: ${c.title}`,
            body: c.status === "completed" ? `Hadiah +${c.xpReward} XP sudah masuk.` : "Belum berhasil kali ini. Coba lagi dengan target yang lebih pas.",
            link: "/pencapaian?tab=tantangan",
        });
    }

    // Budget ≥ ambang / jebol
    for (const b of budgets || []) {
        const limit = b.effectiveLimit ?? b.limit;
        const over = b.spent > limit;
        const pct = b.percentage ?? (limit ? Math.round((b.spent / limit) * 100) : 0);
        if (!over && pct < (b.alertThreshold || 80)) continue;
        const name = b.category?.name || "Kategori";
        push({
            id: `budget:${b._id}:${over ? "over" : "warn"}:${t.year}-${t.month}`,
            kind: "budget",
            tone: over ? "danger" : "warn",
            priority: over ? "high" : "normal",
            title: over ? `Budget ${name} jebol` : `Budget ${name} sudah ${pct}%`,
            body: over
                ? `Lewat ${rp(b.spent - limit)} dari batas ${rp(limit)}.`
                : `Sisa ${rp(limit - b.spent)}${b.perDayLeft ? ` · aman ${rp(b.perDayLeft)}/hari` : ""}.`,
            link: "/budgets",
        });
    }

    // Tagihan rutin ≤ 3 hari
    for (const r of recurrings || []) {
        const k = dayKey(r.nextRunDate);
        const d = daysBetweenKeys(t.key, k);
        if (d < 0 || d > 3) continue;
        push({
            id: `recurring:${r._id}:${k}`,
            kind: "bill",
            tone: d <= 1 ? "warn" : "info",
            title: `${r.description || r.category?.name || "Tagihan rutin"} ${relDay(d)}`,
            body: `${rp(r.amount)} akan dicatat otomatis.`,
            link: "/recurring",
        });
    }

    // Utang / piutang jatuh tempo (≤ 3 hari atau lewat)
    for (const debt of debts || []) {
        if (!debt.dueDate) continue;
        const k = dayKey(debt.dueDate);
        const d = daysBetweenKeys(t.key, k);
        if (d > 3) continue;
        const remaining = Math.max(0, (debt.amount || 0) - (debt.paid || 0));
        if (remaining <= 0) continue;
        const owedToMe = debt.direction === "owed_to_me";
        push({
            id: `debt:${debt._id}:${k}:${d < 0 ? "late" : "soon"}`,
            kind: "debt",
            tone: d < 0 ? "danger" : "warn",
            title: owedToMe ? `${debt.person} belum melunasi ${rp(remaining)}` : `Utangmu ke ${debt.person} ${rp(remaining)}`,
            body: `Jatuh tempo ${relDay(d)}${debt.note ? ` · ${debt.note}` : ""}.`,
            link: "/utang",
        });
    }

    // Goal dengan tenggat ≤ 7 hari
    for (const g of goals || []) {
        if (!g.deadline) continue;
        const k = dayKey(g.deadline);
        const d = daysBetweenKeys(t.key, k);
        if (d < 0 || d > 7) continue;
        const left = Math.max(0, (g.targetAmount || 0) - (g.currentAmount || 0));
        if (left <= 0) continue;
        push({
            id: `goal:${g._id}:${k}`,
            kind: "goal",
            tone: d <= 2 ? "warn" : "info",
            title: `Tenggat goal "${g.name}" ${relDay(d)}`,
            body: `Kurang ${rp(left)} lagi untuk mencapai target.`,
            link: "/goals",
        });
    }

    // Wrapped bulan lalu (tanggal 1–7)
    if (t.date <= 7) {
        const pm = t.month === 1 ? 12 : t.month - 1;
        const py = t.month === 1 ? t.year - 1 : t.year;
        push({
            id: `wrapped:${py}-${pm}`,
            kind: "wrapped",
            tone: "good",
            title: `Wrapped ${MONTHS[pm - 1]} sudah siap`,
            body: "Lihat cerita uangmu bulan lalu dan unduh kartunya untuk dibagikan.",
            link: "/wrapped",
        });
    }

    items.sort(
        (a, b) =>
            (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) || TONE_ORDER[a.tone] - TONE_ORDER[b.tone],
    );
    return items;
}

async function loadNotifications(userId, now = new Date()) {
    const t = wib(now);
    const soon = startOfKey(addDays(t.key, 4));
    const [user, gamification, budgets, recurrings, debts, goals, state] = await Promise.all([
        User.findById(userId).select("notifications").lean(),
        callHandler(getGamification, { user: userId }).catch(() => null),
        callHandler(getBudgets, { user: userId, query: { month: t.month, year: t.year } }).catch(() => []),
        Recurring.find({ user: userId, isActive: true, type: "expense", nextRunDate: { $lt: soon } })
            .populate("category", "name")
            .lean(),
        Debt.find({ user: userId, status: "open", dueDate: { $ne: null, $lt: soon } }).lean(),
        Goal.find({ user: userId, status: "active", deadline: { $ne: null, $lt: startOfKey(addDays(t.key, 8)) } }).lean(),
        NotificationState.findOne({ user: userId }).select("readIds").lean(),
    ]);
    const items = buildNotifications({ now, user, gamification, budgets, recurrings, debts, goals });
    const read = new Set(state?.readIds || []);
    const withRead = items.map((i) => ({ ...i, read: read.has(i.id) }));
    return { items: withRead, unread: withRead.filter((i) => !i.read).length, generatedAt: now.toISOString() };
}

// GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        res.json(await loadNotifications(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/notifications/read { ids: [...] }
const markRead = async (req, res) => {
    try {
        const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
            .filter((x) => typeof x === "string" && x.length < 300)
            .slice(0, 100);
        const existing = await NotificationState.findOne({ user: req.user._id }).select("readIds").lean();
        const known = new Set(existing?.readIds || []);
        const fresh = [...new Set(ids)].filter((id) => !known.has(id));
        if (fresh.length) {
            await NotificationState.updateOne(
                { user: req.user._id },
                { $push: { readIds: { $each: fresh, $slice: -400 } } },
                { upsert: true },
            );
        }
        res.json(await loadNotifications(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/notifications/test-email
const sendTestEmail = async (req, res) => {
    try {
        if (!emailConfigured())
            return res.status(400).json({
                message: "Email server belum dikonfigurasi. Isi EMAIL_USER dan EMAIL_PASS (App Password Gmail) di server/.env lalu restart server.",
            });
        const user = await User.findById(req.user._id).select("name email notifications").lean();
        if (!user?.email) return res.status(400).json({ message: "Akunmu belum punya alamat email." });
        const n = user.notifications || {};
        const html = layout({
            kicker: "Email uji",
            title: "Notifikasi email sudah berfungsi",
            intro: `Halo <strong>${esc(user.name)}</strong>, kalau kamu membaca ini berarti DailyTrack bisa mengirim email ke <strong>${esc(user.email)}</strong>.`,
            rows: [
                ["Pengingat harian", n.dailyReminder === false ? "Mati" : `Aktif · ${esc(n.reminderTime || "20:00")} WIB`],
                ["Peringatan budget", n.budgetAlert === false ? "Mati" : "Aktif · tiap pagi"],
                ["Peringatan goal", n.goalAlert === false ? "Mati" : "Aktif · tiap pagi"],
            ],
            cta: { label: "Buka DailyTrack", path: "/" },
        });
        await send(user.email, "Email uji DailyTrack", html);
        res.json({ message: `Email uji terkirim ke ${user.email}.` });
    } catch (error) {
        res.status(500).json({ message: `Gagal mengirim email: ${error.message}` });
    }
};

module.exports = { getNotifications, markRead, sendTestEmail, _internal: { buildNotifications } };
