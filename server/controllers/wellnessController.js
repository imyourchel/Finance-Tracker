const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Recurring = require("../models/Recurring");
const Wallet = require("../models/Wallet");
const Goal = require("../models/Goal");
const Budget = require("../models/Budget");
const Category = require("../models/Category");
const WellnessProfile = require("../models/WellnessProfile");

/*
 * Kesehatan Finansial
 * ───────────────────
 * 1. Dana darurat: target = rata-rata pengeluaran bulanan × pengali profil.
 * 2. Deteksi langganan: pola pengeluaran berulang dari riwayat transaksi
 *    + tagihan rutin yang sudah dibuat.
 * 3. Skor kesehatan 0–100 dari lima faktor.
 *
 * Aturan hitung uang: transfer, baris goal (goalId) dan utang (debtId) bukan
 * pemasukan/pengeluaran. Semua tanggal dikelompokkan dalam WIB (UTC+7).
 */

const TZ = 7 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// ── Util tanggal (kunci "YYYY-MM-DD" dalam WIB) ────────────────
const dayKey = (d) => new Date(new Date(d).getTime() + TZ).toISOString().slice(0, 10);
const addDays = (key, n) => new Date(Date.parse(key) + n * DAY).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addMonths = (key, n) => {
    const [y, m, d] = key.split("-").map(Number);
    const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
};
const monthOf = (key) => key.slice(0, 7);
const shiftMonthKey = (mk, n) => {
    const [y, m] = mk.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const daysInMonth = (mk) => {
    const [y, m] = mk.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const round = (n, p = 0) => Math.round(n * 10 ** p) / 10 ** p;
const fmtNum = (n, d = 1) => Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: d });
const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const mode = (arr) => {
    const c = new Map();
    let best = null;
    let n = 0;
    for (const v of arr) {
        if (v == null) continue;
        const k = String(v);
        c.set(k, (c.get(k) || 0) + 1);
        if (c.get(k) > n) {
            n = c.get(k);
            best = k;
        }
    }
    return best;
};

// Baris yang benar-benar pemasukan/pengeluaran (bukan perpindahan uang)
const isFlow = (t) => !t.isTransfer && !t.goalId && !t.debtId && (t.type === "income" || t.type === "expense");

// ════════════════════════ Dana darurat ════════════════════════
const HOUSEHOLDS = [
    { id: "lajang", label: "Lajang", hint: "Penghasilan tetap, tanpa tanggungan", options: [3, 4, 5, 6], default: 3 },
    { id: "menikah", label: "Menikah", hint: "Berdua, belum ada tanggungan", options: [6], default: 6 },
    { id: "tanggungan", label: "Punya tanggungan", hint: "Anak atau orang tua yang dibiayai", options: [9, 12], default: 9 },
    { id: "freelancer", label: "Freelancer / usaha", hint: "Penghasilan tidak tetap", options: [9, 12], default: 12 },
];
const householdById = Object.fromEntries(HOUSEHOLDS.map((h) => [h.id, h]));

/** Ringkasan arus uang per bulan dari baris transaksi. */
function monthlyFlows(rows) {
    const out = {};
    for (const t of rows) {
        if (!isFlow(t)) continue;
        const mk = monthOf(dayKey(t.date));
        out[mk] = out[mk] || { income: 0, expense: 0 };
        out[mk][t.type] += t.amount;
    }
    return out;
}

/** Rata-rata pengeluaran & pemasukan bulanan dari bulan-bulan penuh terakhir (maks. 6). */
function averageMonth(flows, todayKey) {
    const current = monthOf(todayKey);
    const months = [];
    for (let i = 1; i <= 6; i += 1) {
        const mk = shiftMonthKey(current, -i);
        const f = flows[mk];
        if (f && (f.expense > 0 || f.income > 0)) months.push({ key: mk, ...f });
    }
    if (months.length) {
        return {
            expense: months.reduce((s, m) => s + m.expense, 0) / months.length,
            income: months.reduce((s, m) => s + m.income, 0) / months.length,
            months: months.map((m) => m.key),
            estimated: false,
        };
    }
    // Belum ada bulan penuh: perkirakan dari bulan berjalan
    const f = flows[current] || { income: 0, expense: 0 };
    const elapsed = Number(todayKey.slice(8, 10));
    const scale = daysInMonth(current) / Math.max(1, elapsed);
    return { expense: f.expense * scale, income: f.income * scale, months: [current], estimated: true };
}

function computeEmergency({ flows, todayKey, wallets, goals, profile, goalRows }) {
    const avg = averageMonth(flows, todayKey);
    const household = profile?.household && householdById[profile.household] ? profile.household : null;
    const hh = household ? householdById[household] : null;
    const multiplier = profile?.multiplier || hh?.default || 6;

    // Sumber dana: pilihan pengguna, atau tebakan dari nama "darurat"
    let walletIds = (profile?.fundWallets || []).map(String);
    let goalIds = (profile?.fundGoals || []).map(String);
    let auto = false;
    if (!profile?.configured && !walletIds.length && !goalIds.length) {
        const re = /darurat|emergency/i;
        walletIds = wallets.filter((w) => re.test(w.name)).map((w) => String(w._id));
        goalIds = goals.filter((g) => re.test(g.name)).map((g) => String(g._id));
        auto = walletIds.length + goalIds.length > 0;
    }
    const pickedWallets = wallets.filter((w) => walletIds.includes(String(w._id)));
    const pickedGoals = goals.filter((g) => goalIds.includes(String(g._id)));
    const collected =
        pickedWallets.reduce((s, w) => s + Math.max(0, w.balance || 0), 0) +
        pickedGoals.reduce((s, g) => s + Math.max(0, g.currentAmount || 0), 0);

    const monthly = avg.expense;
    // Dibulatkan ke ribuan supaya enak dibaca
    const target = Math.round((monthly * multiplier) / 1000) * 1000;
    const remaining = Math.max(0, target - collected);
    const monthsCovered = monthly > 0 ? collected / monthly : 0;

    // Laju menabung: setoran ke goal dana darurat (90 hari), atau sisa uang bulanan
    let pace = 0;
    let paceSource = null;
    if (pickedGoals.length) {
        const since = addDays(todayKey, -90);
        const ids = new Set(pickedGoals.map((g) => String(g._id)));
        const net = goalRows
            .filter((t) => ids.has(String(t.goalId)) && dayKey(t.date) >= since)
            .reduce((s, t) => s + (t.type === "expense" ? t.amount : -t.amount), 0);
        if (net > 0) {
            pace = net / 3;
            paceSource = "goal";
        }
    }
    if (!pace) {
        const recent = avg.months.slice(0, 3).map((mk) => flows[mk] || { income: 0, expense: 0 });
        const net = recent.length ? recent.reduce((s, f) => s + (f.income - f.expense), 0) / recent.length : 0;
        if (net > 0) {
            pace = net;
            paceSource = "saving";
        }
    }
    const monthsToTarget = remaining > 0 && pace > 0 ? remaining / pace : remaining > 0 ? null : 0;
    const etaKey = monthsToTarget ? addDays(todayKey, Math.ceil(monthsToTarget * 30.44)) : monthsToTarget === 0 ? todayKey : null;

    const marks = [...new Set([1, 3, 6, multiplier])].filter((m) => m <= multiplier).sort((a, b) => a - b);
    const milestones = marks.map((m) => ({ months: m, amount: Math.round(monthly * m), reached: monthsCovered >= m }));

    let stage = "kosong";
    if (monthly <= 0) stage = "belum-ada-data";
    else if (collected >= target && target > 0) stage = "aman";
    else if (monthsCovered >= 3) stage = "kuat";
    else if (monthsCovered >= 1) stage = "mulai";
    else if (collected > 0) stage = "rentan";

    return {
        monthlyExpense: Math.round(monthly),
        monthlyIncome: Math.round(avg.income),
        basisMonths: avg.months,
        estimated: avg.estimated,
        household,
        multiplier,
        target,
        collected: Math.round(collected),
        remaining: Math.round(remaining),
        progress: target > 0 ? Math.min(1, collected / target) : 0,
        monthsCovered: round(monthsCovered, 1),
        pace: Math.round(pace),
        paceSource,
        monthsToTarget: monthsToTarget == null ? null : round(monthsToTarget, 1),
        etaKey,
        milestones,
        stage,
        sources: {
            wallets: pickedWallets.map((w) => String(w._id)),
            goals: pickedGoals.map((g) => String(g._id)),
            auto,
        },
        hasFundGoal: goals.some((g) => /darurat|emergency/i.test(g.name) && g.status !== "cancelled"),
    };
}

// ════════════════════════ Langganan ════════════════════════
const SERVICES = [
    ["netflix", "Netflix", "Streaming", /netflix/],
    ["spotify", "Spotify", "Musik", /spotify/],
    ["youtube", "YouTube Premium", "Streaming", /youtube\s*(premium|music)|yt\s*premium/],
    ["disney", "Disney+ Hotstar", "Streaming", /disney|hotstar/],
    ["vidio", "Vidio", "Streaming", /\bvidio\b/],
    ["viu", "Viu", "Streaming", /\bviu\b/],
    ["wetv", "WeTV", "Streaming", /\bwetv\b/],
    ["prime", "Prime Video", "Streaming", /prime\s*video|amazon\s*prime/],
    ["applemusic", "Apple Music", "Musik", /apple\s*music/],
    ["icloud", "iCloud+", "Penyimpanan", /icloud/],
    ["googleone", "Google One", "Penyimpanan", /google\s*one|google\s*drive|gdrive/],
    ["chatgpt", "ChatGPT Plus", "AI", /chat\s*gpt|openai/],
    ["claude", "Claude", "AI", /\bclaude\b|anthropic/],
    ["canva", "Canva", "Produktivitas", /canva/],
    ["m365", "Microsoft 365", "Produktivitas", /microsoft\s*365|office\s*365/],
    ["adobe", "Adobe", "Produktivitas", /adobe/],
    ["notion", "Notion", "Produktivitas", /notion/],
    ["gym", "Gym / fitness", "Kebugaran", /\bgym\b|fitness|membership\s*gym/],
    ["indihome", "IndiHome", "Internet", /indihome/],
    ["biznet", "Biznet", "Internet", /biznet/],
    ["firstmedia", "First Media", "Internet", /first\s*media/],
    ["myrepublic", "MyRepublic", "Internet", /myrepublic|my\s*republic/],
    ["wifi", "Internet rumah", "Internet", /\bwifi\b|internet\s*rumah/],
    ["pulsa", "Pulsa & paket data", "Pulsa & data", /pulsa|paket\s*data|kuota|telkomsel|\bxl\b|indosat|\bim3\b|smartfren|by\.u|\baxis\b/],
    ["listrik", "Listrik PLN", "Utilitas", /listrik|token\s*pln|\bpln\b/],
    ["pdam", "Air PDAM", "Utilitas", /pdam|tagihan\s*air/],
    ["bpjs", "BPJS", "Kesehatan", /bpjs/],
    ["asuransi", "Asuransi", "Asuransi", /asuransi|prudential|allianz|\baxa\b|manulife|\baia\b/],
    ["cicilan", "Cicilan", "Cicilan", /cicilan|angsuran|kredivo|akulaku|paylater|kpr\b|kredit\s*motor|kredit\s*mobil/],
    ["kos", "Kos / sewa", "Hunian", /\bkost?\b|sewa\s*(kamar|rumah|apartemen)|kontrakan/],
];
// Kategori belanja konsumsi: polanya bisa rutin tapi bukan langganan
const CONSUMPTION = /makan|minum|kopi|jajan|belanja|groceries|sembako|transport|bensin|bbm|parkir|ojek|grab|gojek|hiburan malam/i;
// Kebutuhan pokok (bukan langganan yang bisa dihentikan sesuka hati)
const ESSENTIAL_KINDS = new Set(["Internet", "Pulsa & data", "Utilitas", "Kesehatan", "Asuransi", "Cicilan", "Hunian", "Tagihan rutin"]);
// Jenis yang nominalnya wajar berubah-ubah
const VARIABLE_KINDS = new Set(["Pulsa & data", "Utilitas"]);

const STOP = new Set(
    "bayar pembayaran langganan tagihan beli isi top up topup bulan bulanan ini untuk ke via di dan the subscription premium plan paket member jan feb mar apr mei jun jul agu ags sep okt nov des januari februari maret april juni juli agustus september oktober november desember recurring".split(
        " ",
    ),
);

function normalizeDesc(s = "") {
    return String(s)
        .toLowerCase()
        .replace(/\(recurring\)/g, " ")
        .replace(/\d+([.,/:-]\d+)*/g, " ")
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP.has(w))
        .join(" ")
        .trim();
}
function matchService(text = "") {
    const s = String(text).toLowerCase();
    const hit = SERVICES.find(([, , , re]) => re.test(s));
    return hit ? { key: hit[0], name: hit[1], kind: hit[2] } : null;
}
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const PERIODS = [
    { id: "weekly", label: "Mingguan", days: 7, tol: 2, grace: 4, perMonth: 52 / 12 },
    { id: "monthly", label: "Bulanan", days: 30.44, tol: 6, grace: 10, perMonth: 1 },
    { id: "quarterly", label: "Per 3 bulan", days: 91.3, tol: 12, grace: 20, perMonth: 1 / 3 },
    { id: "yearly", label: "Tahunan", days: 365.25, tol: 25, grace: 30, perMonth: 1 / 12 },
];
const periodById = Object.fromEntries(PERIODS.map((p) => [p.id, p]));
const nextFrom = (key, period, k = 1) => {
    if (period.id === "weekly") return addDays(key, 7 * k);
    if (period.id === "monthly") return addMonths(key, k);
    if (period.id === "quarterly") return addMonths(key, 3 * k);
    return addMonths(key, 12 * k);
};

/** Cari pola berkala pada deretan tanggal. */
function findPeriod(dayKeys, allowed) {
    if (dayKeys.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < dayKeys.length; i += 1) gaps.push(diffDays(dayKeys[i - 1], dayKeys[i]));
    const m = median(gaps);
    for (const p of PERIODS) {
        if (!allowed.includes(p.id)) continue;
        if (Math.abs(m - p.days) > p.tol) continue;
        // Interval boleh kelipatan (mis. sebulan lupa dicatat), maks. 3×
        let regular = 0;
        let skipped = 0;
        for (const g of gaps) {
            const k = Math.max(1, Math.round(g / p.days));
            if (k <= 3 && Math.abs(g - k * p.days) <= p.tol * k) {
                regular += 1;
                if (k > 1) skipped += k - 1;
            }
        }
        const ratio = regular / gaps.length;
        if (ratio >= 0.75) return { period: p, regularity: ratio, skipped, gaps };
    }
    return null;
}

/** Cek kestabilan nominal; kembalikan perubahan harga terakhir bila ada. */
function analyseAmounts(amounts, variable, strict = false) {
    let jumps = 0;
    let wobble = 0;
    let lastChange = null;
    for (let i = 1; i < amounts.length; i += 1) {
        const a = amounts[i - 1];
        const b = amounts[i];
        const rel = a > 0 ? (b - a) / a : 0;
        if (Math.abs(rel) > 0.1) jumps += 1;
        else if (Math.abs(rel) > 0.02) wobble += 1;
        if (Math.abs(rel) > 0.03) lastChange = { index: i, from: a, to: b, pct: round(rel * 100, 1) };
    }
    // Satu kali perubahan harga masih wajar; selebihnya berarti nominal acak
    // Langganan sungguhan biasanya bernominal sama persis; nama tak dikenal dinilai lebih ketat
    const stable = variable
        ? true
        : jumps <= 1 && (amounts.length < 4 || jumps / (amounts.length - 1) <= 0.34) && (!strict || wobble === 0);
    return { stable, jumps, lastChange };
}

/**
 * Deteksi langganan.
 * rows: transaksi pengeluaran (sudah tanpa transfer/goal/utang), recurrings: tagihan rutin.
 */
function detectSubscriptions(rows, recurrings, { todayKey, ignored = [] }) {
    const ignoredSet = new Set(ignored);
    const groups = new Map();

    for (const t of rows) {
        if (t.type !== "expense" || t.isRecurring || !isFlow(t)) continue;
        const svc = matchService(t.description) || matchService(t.categoryName);
        const norm = normalizeDesc(t.description);
        if (!svc && (CONSUMPTION.test(t.categoryName || "") || CONSUMPTION.test(norm))) continue;
        let key;
        if (svc) key = `svc:${svc.key}`;
        else if (norm.length >= 3) key = `d:${norm}`;
        else if (t.category) key = `c:${t.category}:${t.wallet || ""}:${Math.round(t.amount / 1000)}`;
        else continue;
        if (!groups.has(key)) groups.set(key, { key, svc, norm, rows: [] });
        groups.get(key).rows.push(t);
    }

    const items = [];
    for (const g of groups.values()) {
        // Satu hari = satu tagihan
        const byDay = new Map();
        for (const t of g.rows) {
            const k = dayKey(t.date);
            const prev = byDay.get(k);
            byDay.set(k, {
                key: k,
                amount: (prev?.amount || 0) + t.amount,
                wallet: t.wallet,
                category: t.category,
                description: t.description,
            });
        }
        const hist = [...byDay.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
        const known = Boolean(g.svc);
        const variable = known && VARIABLE_KINDS.has(g.svc.kind);
        const allowed = known ? ["weekly", "monthly", "quarterly", "yearly"] : ["monthly", "quarterly", "yearly"];

        let found = null;
        let amountInfo = null;
        let confidence = 0;
        if (hist.length >= (known ? 2 : 3)) {
            found = findPeriod(
                hist.map((h) => h.key),
                allowed,
            );
            if (found) {
                amountInfo = analyseAmounts(
                    hist.map((h) => h.amount),
                    variable,
                    !known,
                );
                if (!amountInfo.stable) found = null;
            }
            if (found) {
                confidence = Math.min(1, 0.45 + 0.1 * hist.length + 0.25 * found.regularity + (known ? 0.15 : 0) - 0.1 * amountInfo.jumps);
            }
        }
        // Layanan populer yang baru terlihat sekali dalam 45 hari terakhir
        let single = false;
        if (!found && known && hist.length === 1 && diffDays(hist[0].key, todayKey) <= 45 && !VARIABLE_KINDS.has(g.svc.kind)) {
            found = { period: periodById.monthly, regularity: 0, skipped: 0 };
            amountInfo = { stable: true, jumps: 0, lastChange: null };
            confidence = 0.35;
            single = true;
        }
        if (!found) continue;

        const p = found.period;
        const last = hist[hist.length - 1];
        const recentAmounts = hist.slice(-3).map((h) => h.amount);
        const amount = variable ? Math.round(median(recentAmounts)) : last.amount;

        // Tagihan berikutnya: satu periode setelah tagihan terakhir
        const overdueDays = diffDays(nextFrom(last.key, p), todayKey);
        let status = "active";
        if (overdueDays > p.grace) status = "stale";
        else if (overdueDays > 0) status = "due";

        const change = amountInfo.lastChange;
        const priceChange =
            change && !variable && change.index >= hist.length - 2
                ? { from: change.from, to: change.to, pct: change.pct, dateKey: hist[change.index].key }
                : null;

        const nameRaw = known ? g.svc.name : titleCase(g.norm || last.description || "Pengeluaran berulang");
        items.push({
            key: g.key,
            name: nameRaw,
            service: known ? g.svc.key : null,
            kind: known ? g.svc.kind : "Lainnya",
            frequency: p.id,
            frequencyLabel: p.label,
            occurrences: hist.length,
            amount,
            variable,
            lastKey: last.key,
            firstKey: hist[0].key,
            nextKey: status === "stale" ? null : nextFrom(last.key, p),
            dueIn: status === "stale" ? null : diffDays(todayKey, nextFrom(last.key, p)),
            lastSeenDays: diffDays(last.key, todayKey),
            monthly: Math.round(amount * p.perMonth),
            yearly: Math.round(amount * p.perMonth * 12),
            priceChange,
            status,
            single,
            confidence: round(confidence, 2),
            source: "detected",
            hasRecurring: false,
            recurringId: null,
            walletId: mode(hist.map((h) => h.wallet)) || null,
            categoryId: mode(hist.map((h) => h.category)) || null,
            history: hist.slice(-8).map((h) => ({ dateKey: h.key, amount: h.amount })),
            ignored: ignoredSet.has(g.key),
        });
    }

    // Gabungkan dengan tagihan rutin
    for (const r of recurrings) {
        if (r.type !== "expense" || r.isActive === false) continue;
        const svc = matchService(r.description) || matchService(r.categoryName);
        const norm = normalizeDesc(r.description);
        const match = items.find(
            (it) =>
                it.source === "detected" &&
                ((svc && it.service === svc.key) ||
                    (norm && it.key === `d:${norm}`) ||
                    (String(it.categoryId) === String(r.category) && Math.abs(it.amount - r.amount) <= r.amount * 0.1)),
        );
        if (match) {
            match.hasRecurring = true;
            match.recurringId = String(r._id);
            continue;
        }
        const p = periodById[r.frequency] || (r.frequency === "daily" ? null : periodById.monthly);
        const perMonth = r.frequency === "daily" ? 30.44 : p.perMonth;
        const nextKey = r.nextRunDate ? dayKey(r.nextRunDate) : null;
        const key = `r:${r._id}`;
        items.push({
            key,
            name: svc ? svc.name : titleCase(norm || r.categoryName || "Tagihan rutin"),
            service: svc ? svc.key : null,
            kind: svc ? svc.kind : "Tagihan rutin",
            frequency: r.frequency,
            frequencyLabel: r.frequency === "daily" ? "Harian" : p.label,
            occurrences: (r.history || []).length,
            amount: r.amount,
            variable: false,
            lastKey: r.lastRunDate ? dayKey(r.lastRunDate) : null,
            firstKey: r.startDate ? dayKey(r.startDate) : null,
            nextKey,
            dueIn: nextKey ? diffDays(todayKey, nextKey) : null,
            lastSeenDays: r.lastRunDate ? diffDays(dayKey(r.lastRunDate), todayKey) : null,
            monthly: Math.round(r.amount * perMonth),
            yearly: Math.round(r.amount * perMonth * 12),
            priceChange: null,
            status: "active",
            single: false,
            confidence: 1,
            source: "recurring",
            hasRecurring: true,
            recurringId: String(r._id),
            walletId: r.wallet ? String(r.wallet) : null,
            categoryId: r.category ? String(r.category) : null,
            history: (r.history || []).slice(-8),
            ignored: ignoredSet.has(key),
        });
    }

    for (const it of items) it.essential = ESSENTIAL_KINDS.has(it.kind);
    const sortKey = (it) => (it.dueIn == null ? 9999 : it.dueIn);
    const active = items.filter((it) => !it.ignored && it.status !== "stale").sort((a, b) => sortKey(a) - sortKey(b));
    const stale = items.filter((it) => !it.ignored && it.status === "stale").sort((a, b) => a.lastSeenDays - b.lastSeenDays);
    const ignoredItems = items.filter((it) => it.ignored);
    const monthly = active.reduce((s, it) => s + it.monthly, 0);
    return {
        items: active,
        stale,
        ignored: ignoredItems,
        totals: {
            monthly,
            yearly: monthly * 12,
            optionalMonthly: active.filter((it) => !it.essential).reduce((s, it) => s + it.monthly, 0),
            essentialMonthly: active.filter((it) => it.essential).reduce((s, it) => s + it.monthly, 0),
            count: active.length,
            priceChanges: active.filter((it) => it.priceChange && it.priceChange.pct > 0).length,
            dueSoon: active.filter((it) => it.dueIn != null && it.dueIn <= 7).length,
        },
    };
}

// ════════════════════════ Skor ════════════════════════
function computeScore({ flows, todayKey, emergency, subscriptions, budgets, activeDays30 }) {
    const current = monthOf(todayKey);
    const recent = [1, 2, 3].map((i) => flows[shiftMonthKey(current, -i)]).filter((f) => f && f.income > 0);
    const inc = recent.reduce((s, f) => s + f.income, 0);
    const exp = recent.reduce((s, f) => s + f.expense, 0);
    const savingRate = inc > 0 ? ((inc - exp) / inc) * 100 : null;

    const factors = [];
    const add = (key, label, max, ratio, value, tip) =>
        factors.push({ key, label, max, score: round(Math.max(0, Math.min(1, ratio)) * max, 1), value, tip });

    add(
        "saving",
        "Rasio tabungan",
        30,
        savingRate == null ? 0 : savingRate / 20,
        savingRate == null ? "Belum ada pemasukan" : `${fmtNum(savingRate)}% dari pemasukan (3 bulan)`,
        savingRate == null
            ? "Catat pemasukanmu supaya rasio tabungan bisa dihitung."
            : savingRate >= 20
              ? "Sudah sesuai target sehat 20%."
              : "Target sehat: sisihkan minimal 20% dari pemasukan.",
    );
    const efRatio = emergency.multiplier > 0 ? emergency.monthsCovered / emergency.multiplier : 0;
    add(
        "emergency",
        "Dana darurat",
        30,
        efRatio,
        `${fmtNum(emergency.monthsCovered)} dari ${emergency.multiplier} bulan pengeluaran`,
        efRatio >= 1 ? "Dana darurat sudah memenuhi target." : "Tambah dana darurat sampai mencapai target profilmu.",
    );
    const incomeMonthly = emergency.monthlyIncome;
    const subShare = incomeMonthly > 0 ? (subscriptions.totals.optionalMonthly / incomeMonthly) * 100 : null;
    add(
        "subscriptions",
        "Beban langganan",
        15,
        subShare == null ? 0.5 : 1 - (subShare - 3) / 9,
        subShare == null ? "Belum ada pemasukan" : `${fmtNum(subShare)}% dari pemasukan, di luar tagihan pokok`,
        subShare == null
            ? "Belum bisa dibandingkan dengan pemasukan."
            : subShare <= 3
              ? "Langganan hiburan & digitalmu ringan."
              : "Tinjau langganan yang jarang dipakai. Idealnya ≤ 3% pemasukan.",
    );
    const over = budgets.filter((b) => b.spent > b.limit).length;
    add(
        "budget",
        "Disiplin budget",
        15,
        budgets.length ? 1 - over / budgets.length : 0.5,
        budgets.length ? `${budgets.length - over} dari ${budgets.length} budget aman` : "Belum ada budget bulan ini",
        budgets.length ? (over ? `${over} budget jebol bulan ini.` : "Semua budget masih aman.") : "Buat budget per kategori untuk nilai penuh.",
    );
    add(
        "tracking",
        "Konsistensi mencatat",
        10,
        activeDays30 / 20,
        `${activeDays30} hari aktif dari 30`,
        activeDays30 >= 20 ? "Pencatatanmu konsisten." : "Catat minimal 20 hari dalam sebulan supaya analisisnya akurat.",
    );

    const value = Math.round(factors.reduce((s, f) => s + f.score, 0));
    const grade = value >= 80 ? "Sangat sehat" : value >= 60 ? "Sehat" : value >= 40 ? "Perlu perhatian" : "Rentan";
    const weakest = [...factors].sort((a, b) => a.score / a.max - b.score / b.max)[0];
    return { value, grade, factors, focus: weakest?.key || null };
}

// ════════════════════════ Handler ════════════════════════
async function loadAll(userId) {
    const now = new Date();
    const todayKey = dayKey(now);
    const since = new Date(now.getTime() - 400 * DAY);
    const [tx, recurrings, wallets, goals, profile, categories] = await Promise.all([
        Transaction.find({ user: userId, isDeleted: false, date: { $gte: since } })
            .select("type amount date description category wallet goalId debtId isTransfer isRecurring recurringId createdAt")
            .populate("category", "name")
            .lean(),
        Recurring.find({ user: userId }).populate("category", "name").lean(),
        Wallet.find({ user: userId, isArchived: { $ne: true } }).select("name type balance color").lean(),
        Goal.find({ user: userId, status: { $ne: "cancelled" } }).select("name currentAmount targetAmount status color").lean(),
        WellnessProfile.findOne({ user: userId }).lean(),
        Category.find({ $or: [{ user: userId }, { user: null }], type: "expense", isActive: { $ne: false } })
            .select("name")
            .lean(),
    ]);
    const [y, m] = todayKey.split("-").map(Number);
    const budgets = await Budget.find({ user: userId, month: m, year: y }).select("limit spent").lean();
    return { todayKey, tx, recurrings, wallets, goals, profile, categories, budgets };
}

async function computeWellness(userId) {
    const { todayKey, tx, recurrings, wallets, goals, profile, categories, budgets } = await loadAll(userId);

    const rows = tx.map((t) => ({
        ...t,
        categoryName: t.category?.name || "",
        category: t.category?._id ? String(t.category._id) : t.category ? String(t.category) : null,
        wallet: t.wallet ? String(t.wallet) : null,
    }));
    const flows = monthlyFlows(rows);
    const goalRows = rows.filter((t) => t.goalId && !t.isTransfer);

    const emergency = computeEmergency({ flows, todayKey, wallets, goals, profile, goalRows });

    // Riwayat tagihan rutin dari transaksi yang dibuatnya
    const recHist = {};
    for (const t of rows) {
        if (!t.recurringId) continue;
        const k = String(t.recurringId);
        (recHist[k] = recHist[k] || []).push({ dateKey: dayKey(t.date), amount: t.amount });
    }
    const recs = recurrings.map((r) => ({
        ...r,
        categoryName: r.category?.name || "",
        category: r.category?._id ? String(r.category._id) : r.category ? String(r.category) : null,
        history: (recHist[String(r._id)] || []).sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1)),
    }));
    const subscriptions = detectSubscriptions(rows, recs, { todayKey, ignored: profile?.ignoredSubs || [] });

    const fallback =
        categories.find((c) => /tagihan|langganan/i.test(c.name)) ||
        categories.find((c) => /hiburan/i.test(c.name)) ||
        categories.find((c) => /lain/i.test(c.name)) ||
        categories[0];
    subscriptions.fallbackCategoryId = fallback ? String(fallback._id) : null;

    const since30 = addDays(todayKey, -30);
    const activeDays30 = new Set(rows.filter((t) => dayKey(t.createdAt || t.date) > since30).map((t) => dayKey(t.createdAt || t.date))).size;
    const score = computeScore({ flows, todayKey, emergency, subscriptions, budgets, activeDays30 });

    return {
        todayKey,
        profile: {
            household: profile?.household || null,
            multiplier: profile?.multiplier || null,
            fundWallets: (profile?.fundWallets || []).map(String),
            fundGoals: (profile?.fundGoals || []).map(String),
            configured: Boolean(profile?.configured),
            households: HOUSEHOLDS,
        },
        sources: {
            wallets: wallets.map((w) => ({ _id: String(w._id), name: w.name, type: w.type, balance: w.balance || 0, color: w.color })),
            goals: goals.map((g) => ({
                _id: String(g._id),
                name: g.name,
                currentAmount: g.currentAmount || 0,
                targetAmount: g.targetAmount || 0,
                status: g.status,
                color: g.color,
            })),
        },
        emergency,
        subscriptions,
        score,
    };
}

const getWellness = async (req, res) => {
    try {
        res.json(await computeWellness(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { household, multiplier, fundWallets, fundGoals } = req.body || {};
        const update = { configured: true };
        if (household !== undefined) {
            if (household !== null && !householdById[household]) return res.status(400).json({ message: "Profil tidak dikenal." });
            update.household = household;
        }
        if (multiplier !== undefined) {
            const n = Number(multiplier);
            if (multiplier !== null && (!Number.isFinite(n) || n < 1 || n > 24))
                return res.status(400).json({ message: "Pengali harus 1–24 bulan." });
            update.multiplier = multiplier === null ? null : Math.round(n);
        }
        const clean = (arr) => (Array.isArray(arr) ? arr.filter((id) => mongoose.isValidObjectId(id)) : undefined);
        if (fundWallets !== undefined) {
            const ids = clean(fundWallets);
            const owned = await Wallet.find({ _id: { $in: ids }, user: req.user._id }).select("_id").lean();
            update.fundWallets = owned.map((w) => w._id);
        }
        if (fundGoals !== undefined) {
            const ids = clean(fundGoals);
            const owned = await Goal.find({ _id: { $in: ids }, user: req.user._id }).select("_id").lean();
            update.fundGoals = owned.map((g) => g._id);
        }
        await WellnessProfile.findOneAndUpdate({ user: req.user._id }, { $set: update }, { upsert: true, new: true });
        res.json(await computeWellness(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const setIgnored = (ignore) => async (req, res) => {
    try {
        const key = String(req.body?.key || "").slice(0, 200);
        if (!key) return res.status(400).json({ message: "Langganan tidak dikenal." });
        await WellnessProfile.findOneAndUpdate(
            { user: req.user._id },
            ignore ? { $addToSet: { ignoredSubs: key } } : { $pull: { ignoredSubs: key } },
            { upsert: true },
        );
        res.json(await computeWellness(req.user._id));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getWellness,
    updateProfile,
    ignoreSubscription: setIgnored(true),
    unignoreSubscription: setIgnored(false),
    // diekspor untuk pengujian
    _internal: { detectSubscriptions, computeEmergency, computeScore, monthlyFlows, normalizeDesc, matchService, HOUSEHOLDS },
};
