const Transaction = require("../models/Transaction");

/*
 * Insights DailyTrack
 * ───────────────────
 * Angka untuk Dashboard (ringkasan bulan + proyeksi + insight otomatis)
 * dan Analitik (tren bulanan, kategori, heatmap, transaksi terbesar).
 *
 * Aturan hitung:
 * - Transfer antar wallet tidak dihitung sebagai pemasukan/pengeluaran.
 * - Setoran/penarikan goal (baris dengan goalId) adalah perpindahan tabungan,
 *   bukan belanja/pemasukan → dihitung terpisah sebagai "disisihkan ke goal".
 * - Semua pengelompokan hari/bulan memakai WIB (UTC+7).
 */

const TZ = 7 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ── Helper waktu (WIB) ─────────────────────────────────────────
const wib = (d) => {
    const x = new Date(new Date(d).getTime() + TZ);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() };
};
const dayKey = (d) => new Date(new Date(d).getTime() + TZ).toISOString().slice(0, 10);
const monthStart = (y, m) => new Date(Date.UTC(y, m - 1, 1) - TZ); // 00:00 WIB tgl 1
const shiftMonth = (y, m, delta) => {
    const t = new Date(Date.UTC(y, m - 1 + delta, 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
};
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const mKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const pct = (a, b) => (b > 0 ? round(((a - b) / b) * 100) : null);
const rate = (income, expense) => (income > 0 ? round(((income - expense) / income) * 100) : null);

// Baris goal = perpindahan tabungan; baris utang-piutang (debtId) = pinjam-meminjam,
// keduanya bukan pemasukan/pengeluaran sungguhan.
const kindOf = (t) => (t.goalId ? "goal" : t.debtId ? "debt" : t.type);

// Ringkasan sekumpulan baris
function sum(rows) {
    const s = { income: 0, expense: 0, goalIn: 0, goalOut: 0, count: 0 };
    for (const t of rows) {
        const k = kindOf(t);
        if (k === "debt") continue;
        if (k === "goal") {
            if (t.type === "expense") s.goalIn += t.amount;
            else s.goalOut += t.amount;
        } else if (k === "income") s.income += t.amount;
        else if (k === "expense") s.expense += t.amount;
        s.count += 1;
    }
    return {
        income: s.income,
        expense: s.expense,
        net: s.income - s.expense,
        goalSaved: s.goalIn - s.goalOut,
        savingRate: rate(s.income, s.expense),
        count: s.count,
    };
}

const catInfo = (t) => {
    const c = t.category;
    return {
        id: c?._id ? String(c._id) : "none",
        name: c?.name || "Lainnya",
        color: c?.color || "#8a9a93",
        icon: c?.icon || "tag",
    };
};

// Pengeluaran per kategori, dibandingkan dengan periode pembanding
function categoryBreakdown(curRows, prevRows) {
    const map = new Map();
    const add = (t, field) => {
        if (kindOf(t) !== "expense") return;
        const c = catInfo(t);
        const e = map.get(c.id) || { ...c, total: 0, prevTotal: 0, count: 0 };
        e[field] += t.amount;
        if (field === "total") e.count += 1;
        map.set(c.id, e);
    };
    curRows.forEach((t) => add(t, "total"));
    prevRows.forEach((t) => add(t, "prevTotal"));
    const all = [...map.values()];
    const total = all.reduce((a, c) => a + c.total, 0);
    return all
        .filter((c) => c.total > 0 || c.prevTotal > 0)
        .map((c) => ({
            ...c,
            share: total > 0 ? round((c.total / total) * 100) : 0,
            change: c.total - c.prevTotal,
            changePct: pct(c.total, c.prevTotal),
        }))
        .sort((a, b) => b.total - a.total || b.prevTotal - a.prevTotal);
}

const rupiah = (n) =>
    "Rp" + Math.round(Math.abs(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });

// ── Insight otomatis untuk dashboard ───────────────────────────
function buildInsights({ current, prevToDate, categories, projection, largest, weekdaySplit, label }) {
    const out = [];
    const push = (priority, tone, title, detail, id) => out.push({ id, priority, tone, title, detail });

    // 1. Laju pengeluaran vs periode yang sama bulan lalu
    if (prevToDate.expense > 0 && current.expense > 0) {
        const p = pct(current.expense, prevToDate.expense);
        if (p !== null && Math.abs(p) >= 5) {
            const up = p > 0;
            push(
                up ? 90 : 70,
                up ? "warn" : "good",
                `Pengeluaran ${up ? "naik" : "turun"} ${Math.abs(Math.round(p))}%`,
                `${rupiah(current.expense)} vs ${rupiah(prevToDate.expense)} pada periode yang sama bulan lalu.`,
                "pace",
            );
        }
    }

    // 2. Kategori yang paling berubah
    const movers = categories.filter((c) => c.prevTotal > 0 && Math.abs(c.change) >= 50000 && Math.abs(c.changePct) >= 20);
    const riser = [...movers].sort((a, b) => b.change - a.change)[0];
    if (riser && riser.change > 0) {
        push(
            85,
            "warn",
            `${riser.name} naik ${Math.round(riser.changePct)}%`,
            `Lebih besar ${rupiah(riser.change)} dibanding bulan lalu (${rupiah(riser.total)} sejauh ini).`,
            "cat-up",
        );
    }
    const faller = [...movers].sort((a, b) => a.change - b.change)[0];
    if (faller && faller.change < 0) {
        push(
            60,
            "good",
            `${faller.name} turun ${Math.abs(Math.round(faller.changePct))}%`,
            `Hemat ${rupiah(faller.change)} dibanding bulan lalu.`,
            "cat-down",
        );
    }
    const fresh = categories.find((c) => c.prevTotal === 0 && c.total >= 100000);
    if (fresh) {
        push(40, "info", `Pengeluaran baru: ${fresh.name}`, `${rupiah(fresh.total)} bulan ini, bulan lalu tidak ada.`, "cat-new");
    }

    // 3. Proyeksi akhir bulan
    if (projection) {
        if (current.income > 0 && projection.expense > current.income) {
            push(
                95,
                "warn",
                "Proyeksi melebihi pemasukan",
                `Dengan laju sekarang, pengeluaran akhir bulan diperkirakan ${rupiah(projection.expense)} — lebih besar dari pemasukan ${rupiah(current.income)}.`,
                "proj-over",
            );
        } else if (projection.safeDaily !== null && projection.remainingDays > 0) {
            push(
                55,
                projection.safeDaily > 0 ? "info" : "warn",
                projection.safeDaily > 0
                    ? `Batas aman ${rupiah(projection.safeDaily)}/hari`
                    : "Target sisa 20% sudah terlewati",
                projection.safeDaily > 0
                    ? `Belanja maksimal segini per hari selama ${projection.remainingDays} hari lagi supaya tetap sisa 20% dari pemasukan.`
                    : "Kurangi pengeluaran sisa bulan ini supaya rasio tabungan tidak makin turun.",
                "safe-daily",
            );
        }
    }

    // 4. Rasio tabungan
    if (current.savingRate !== null) {
        const r = current.savingRate;
        if (r >= 20) push(50, "good", `Rasio tabungan ${Math.round(r)}%`, `Di atas target sehat 20% untuk ${label}.`, "rate");
        else if (r < 0) {
            // Sudah diwakili insight proyeksi kalau keduanya sama-sama defisit
            if (!out.some((i) => i.id === "proj-over")) push(80, "warn", "Pengeluaran melebihi pemasukan", `Defisit ${rupiah(current.net)} untuk ${label}.`, "rate");
        } else push(45, "info", `Rasio tabungan ${Math.round(r)}%`, `Masih di bawah target 20%. Kurang ${rupiah(current.income * 0.2 - current.net)} lagi.`, "rate");
    }

    // 5. Transaksi terbesar mendominasi
    if (largest && current.expense > 0) {
        const share = (largest.amount / current.expense) * 100;
        if (share >= 25) {
            push(
                50,
                "info",
                `${Math.round(share)}% dari satu transaksi`,
                `${largest.description || largest.category?.name || "Satu transaksi"} (${rupiah(largest.amount)}) menyumbang porsi besar pengeluaran.`,
                "largest",
            );
        }
    }

    // 6. Akhir pekan vs hari kerja
    if (weekdaySplit && weekdaySplit.weekdayAvg > 0 && weekdaySplit.weekendAvg > weekdaySplit.weekdayAvg * 1.3) {
        const r = Math.round((weekdaySplit.weekendAvg / weekdaySplit.weekdayAvg - 1) * 100);
        push(35, "info", `Akhir pekan ${r}% lebih boros`, `Rata-rata ${rupiah(weekdaySplit.weekendAvg)}/hari di akhir pekan vs ${rupiah(weekdaySplit.weekdayAvg)} di hari kerja.`, "weekend");
    }

    // 7. Disisihkan ke goal
    if (current.goalSaved > 0) {
        push(30, "good", `${rupiah(current.goalSaved)} disisihkan ke goal`, "Uang yang masuk ke goal tabungan bulan ini.", "goal");
    }

    return out.sort((a, b) => b.priority - a.priority).slice(0, 4).map(({ priority, ...i }) => i);
}

// Rata-rata pengeluaran harian hari kerja vs akhir pekan dalam rentang hari tertentu
function weekdayWeekend(rows, startMs, endMs) {
    let wd = 0, we = 0, wdDays = 0, weDays = 0;
    for (let t = startMs; t < endMs; t += DAY) {
        const dow = wib(t).dow;
        if (dow === 0 || dow === 6) weDays += 1;
        else wdDays += 1;
    }
    for (const r of rows) {
        if (kindOf(r) !== "expense" || r.isRecurring) continue;
        const dow = wib(r.date).dow;
        if (dow === 0 || dow === 6) we += r.amount;
        else wd += r.amount;
    }
    if (!wdDays || !weDays) return null;
    return { weekdayAvg: wd / wdDays, weekendAvg: we / weDays };
}

/**
 * Hitung data dashboard dari baris transaksi (fungsi murni → mudah dites).
 * rows: transaksi non-transfer dari awal bulan lalu sampai akhir bulan terpilih.
 */
function computeOverview(rows, { y, m, now = new Date() }) {
    const prev = shiftMonth(y, m, -1);
    const curStart = monthStart(y, m).getTime();
    const curEnd = monthStart(...Object.values(shiftMonth(y, m, 1))).getTime();
    const prevStart = monthStart(prev.y, prev.m).getTime();

    const today = wib(now);
    const isCurrent = today.y === y && today.m === m;
    const isFuture = y > today.y || (y === today.y && m > today.m);
    const dim = daysIn(y, m);
    const daysElapsed = isCurrent ? today.d : isFuture ? 0 : dim;

    const curRows = rows.filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= curStart && ms < curEnd;
    });
    const prevRows = rows.filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= prevStart && ms < curStart;
    });
    // Pembanding yang adil saat bulan masih berjalan: tgl 1..hari ini bulan lalu
    const prevToDateRows = isCurrent ? prevRows.filter((t) => wib(t.date).d <= daysElapsed) : prevRows;

    const current = sum(curRows);
    const previous = sum(prevRows);
    const prevToDate = sum(prevToDateRows);
    const categories = categoryBreakdown(curRows, prevToDateRows);

    // Proyeksi: tagihan rutin dihitung apa adanya, sisanya diproyeksikan dari laju harian
    let projection = null;
    if (isCurrent && daysElapsed > 0) {
        const recurring = curRows.filter((t) => kindOf(t) === "expense" && t.isRecurring).reduce((a, t) => a + t.amount, 0);
        const variable = current.expense - recurring;
        const dailyAvg = variable / daysElapsed;
        const remainingDays = dim - daysElapsed;
        const expense = Math.round(current.expense + dailyAvg * remainingDays);
        const safeDaily = current.income > 0 && remainingDays > 0
            ? Math.max(0, Math.floor((current.income * 0.8 - current.expense) / remainingDays))
            : null;
        projection = {
            expense,
            net: current.income - expense,
            savingRate: rate(current.income, expense),
            dailyAvg: Math.round(dailyAvg),
            remainingDays,
            safeDaily,
        };
    }

    // Tren harian (WIB)
    const daily = Array.from({ length: dim }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }));
    for (const t of curRows) {
        const k = kindOf(t);
        if (k !== "income" && k !== "expense") continue;
        daily[wib(t.date).d - 1][k] += t.amount;
    }
    // Kumulatif pengeluaran bulan ini vs bulan lalu (untuk grafik laju)
    const prevDim = daysIn(prev.y, prev.m);
    const prevDaily = Array(prevDim).fill(0);
    for (const t of prevRows) if (kindOf(t) === "expense") prevDaily[wib(t.date).d - 1] += t.amount;
    let a = 0, b = 0;
    const pace = daily.map((d, i) => {
        a += d.expense;
        if (i < prevDim) b += prevDaily[i];
        return { day: d.day, current: i < daysElapsed ? a : null, previous: i < prevDim ? b : null };
    });

    const largest = curRows
        .filter((t) => kindOf(t) === "expense")
        .sort((p, q) => q.amount - p.amount)[0];

    const label = `${MONTH_LONG[m - 1]} ${y}`;
    const insights = buildInsights({
        current,
        prevToDate,
        categories,
        projection,
        largest,
        weekdaySplit: daysElapsed >= 7 ? weekdayWeekend(curRows, curStart, curStart + daysElapsed * DAY) : null,
        label,
    });

    return {
        period: { year: y, month: m, label, daysInMonth: dim, daysElapsed, isCurrent, previousLabel: `${MONTH_LONG[prev.m - 1]} ${prev.y}` },
        current,
        previous,
        previousToDate: prevToDate,
        projection,
        categories: categories.slice(0, 8),
        daily,
        pace,
        insights,
    };
}

/**
 * Data halaman Analitik untuk N bulan yang berakhir di bulan (y, m).
 * rows: transaksi non-transfer mulai 2×N bulan sebelum akhir rentang.
 */
function computeAnalytics(rows, { y, m, months, now = new Date() }) {
    const first = shiftMonth(y, m, -(months - 1));
    const prevFirst = shiftMonth(first.y, first.m, -months);
    const rangeStart = monthStart(first.y, first.m).getTime();
    const end = shiftMonth(y, m, 1);
    const rangeEndFull = monthStart(end.y, end.m).getTime();
    const nowMs = now.getTime();
    const rangeEnd = Math.min(rangeEndFull, nowMs);
    const prevStart = monthStart(prevFirst.y, prevFirst.m).getTime();

    const inRange = (t, a, b) => {
        const ms = new Date(t.date).getTime();
        return ms >= a && ms < b;
    };
    const curRows = rows.filter((t) => inRange(t, rangeStart, rangeEndFull));
    const prevRows = rows.filter((t) => inRange(t, prevStart, rangeStart));

    // Per bulan
    const list = [];
    for (let i = 0; i < months; i += 1) {
        const mm = shiftMonth(first.y, first.m, i);
        list.push({ key: mKey(mm.y, mm.m), year: mm.y, month: mm.m, label: `${MONTH_SHORT[mm.m - 1]} ${String(mm.y).slice(2)}`, rows: [] });
    }
    const byKey = new Map(list.map((x) => [x.key, x]));
    for (const t of curRows) {
        const p = wib(t.date);
        byKey.get(mKey(p.y, p.m))?.rows.push(t);
    }
    const monthsOut = list.map(({ rows: r, ...x }) => ({ ...x, ...sum(r) }));

    const totals = sum(curRows);
    const elapsedDays = Math.max(1, Math.ceil((rangeEnd - rangeStart) / DAY));
    const activeMonths = monthsOut.filter((x) => x.count > 0);
    const withIncome = monthsOut.filter((x) => x.savingRate !== null);
    const best = [...withIncome].sort((a, b) => b.savingRate - a.savingRate)[0] || null;
    const worst = [...withIncome].sort((a, b) => a.savingRate - b.savingRate)[0] || null;

    // Heatmap harian (pengeluaran) dari awal rentang sampai hari ini/akhir rentang
    const dayMap = new Map();
    for (const t of curRows) {
        if (kindOf(t) !== "expense") continue;
        const k = dayKey(t.date);
        const e = dayMap.get(k) || { total: 0, count: 0 };
        e.total += t.amount;
        e.count += 1;
        dayMap.set(k, e);
    }
    const heatmap = [];
    for (let t = rangeStart; t < rangeEnd; t += DAY) {
        const k = dayKey(t);
        const e = dayMap.get(k) || { total: 0, count: 0 };
        heatmap.push({ date: k, dow: wib(t).dow, ...e });
    }

    // Rata-rata per hari dalam minggu
    const wd = Array.from({ length: 7 }, (_, dow) => ({ dow, total: 0, days: 0 }));
    for (const h of heatmap) {
        wd[h.dow].total += h.total;
        wd[h.dow].days += 1;
    }
    const weekday = wd.map((w) => ({ dow: w.dow, total: w.total, avg: w.days ? Math.round(w.total / w.days) : 0 }));

    const noSpendDays = heatmap.filter((h) => h.total === 0).length;

    // Tagihan rutin (sewa, cicilan) sudah pasti — yang menarik adalah belanja tidak rutin
    const largest = curRows
        .filter((t) => kindOf(t) === "expense" && !t.isRecurring)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)
        .map((t) => ({
            _id: t._id,
            amount: t.amount,
            date: t.date,
            description: t.description || "",
            category: catInfo(t),
            wallet: t.wallet?.name ? { name: t.wallet.name } : null,
        }));

    return {
        range: {
            months,
            start: dayKey(rangeStart),
            end: dayKey(rangeEndFull - DAY),
            label: `${MONTH_SHORT[first.m - 1]} ${first.y} – ${MONTH_SHORT[m - 1]} ${y}`,
            previousLabel: `${MONTH_SHORT[prevFirst.m - 1]} ${prevFirst.y} – ${MONTH_SHORT[shiftMonth(first.y, first.m, -1).m - 1]} ${shiftMonth(first.y, first.m, -1).y}`,
        },
        months: monthsOut,
        totals: {
            ...totals,
            avgDailyExpense: Math.round(totals.expense / elapsedDays),
            avgMonthlyExpense: activeMonths.length ? Math.round(totals.expense / activeMonths.length) : 0,
            noSpendDays,
            trackedDays: heatmap.length,
            best: best && { label: best.label, savingRate: best.savingRate },
            worst: worst && { label: worst.label, savingRate: worst.savingRate },
        },
        previousTotals: sum(prevRows),
        categories: categoryBreakdown(curRows, prevRows).slice(0, 10),
        heatmap,
        weekday,
        largest,
    };
}


// ── Mood vs belanja ─────────────────────────────────────────────
const MOODS = {
    senang: { label: "Senang", emoji: "😄", tone: "positive" },
    bangga: { label: "Bangga", emoji: "😌", tone: "positive" },
    biasa: { label: "Biasa", emoji: "😐", tone: "neutral" },
    self_reward: { label: "Self reward", emoji: "🎁", tone: "emotional" },
    sedih: { label: "Sedih", emoji: "😔", tone: "emotional" },
    terpaksa: { label: "Terpaksa", emoji: "😩", tone: "emotional" },
    bersalah: { label: "Bersalah", emoji: "😖", tone: "emotional" },
};
const MOOD_ALIAS = { happy: "senang", proud: "bangga", neutral: "biasa", stressed: "terpaksa", guilty: "bersalah" };
const normMood = (m) => {
    if (!m) return null;
    const k = MOOD_ALIAS[m] || m;
    return MOODS[k] ? k : null;
};
const TIME_BLOCKS = [
    { id: "pagi", label: "Pagi", range: "05–11", test: (h) => h >= 5 && h < 11 },
    { id: "siang", label: "Siang", range: "11–15", test: (h) => h >= 11 && h < 15 },
    { id: "sore", label: "Sore", range: "15–18", test: (h) => h >= 15 && h < 18 },
    { id: "malam", label: "Malam", range: "18–22", test: (h) => h >= 18 && h < 22 },
    { id: "larut", label: "Larut malam", range: "22–05", test: (h) => h >= 22 || h < 5 },
];
const DOW_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const wibHour = (d) => new Date(new Date(d).getTime() + TZ).getUTCHours();
const blockOf = (d) => TIME_BLOCKS.find((b) => b.test(wibHour(d))).id;

function topCategoryOf(rows) {
    const map = new Map();
    let total = 0;
    for (const t of rows) {
        const c = catInfo(t);
        const e = map.get(c.id) || { ...c, total: 0 };
        e.total += t.amount;
        total += t.amount;
        map.set(c.id, e);
    }
    const top = [...map.values()].sort((a, b) => b.total - a.total)[0];
    return top ? { name: top.name, color: top.color, icon: top.icon, share: total ? round((top.total / total) * 100) : 0 } : null;
}

function computeMood(rows, { y, m, months, now = new Date() }) {
    const first = shiftMonth(y, m, -(months - 1));
    const start = monthStart(first.y, first.m).getTime();
    const end = shiftMonth(y, m, 1);
    const endMs = monthStart(end.y, end.m).getTime();
    const expenses = rows.filter((t) => {
        const ms = new Date(t.date).getTime();
        return kindOf(t) === "expense" && ms >= start && ms < endMs;
    });
    const tagged = expenses.filter((t) => normMood(t.mood));
    const totalSpend = expenses.reduce((a, t) => a + t.amount, 0);
    const taggedSpend = tagged.reduce((a, t) => a + t.amount, 0);
    const avgAll = tagged.length ? taggedSpend / tagged.length : 0;

    const groups = new Map();
    for (const t of tagged) {
        const k = normMood(t.mood);
        const g = groups.get(k) || [];
        g.push(t);
        groups.set(k, g);
    }
    const moods = [...groups.entries()]
        .map(([id, list]) => {
            const total = list.reduce((a, t) => a + t.amount, 0);
            const avg = total / list.length;
            const blocks = TIME_BLOCKS.map((b) => ({ id: b.id, n: list.filter((t) => blockOf(t.date) === b.id).length }));
            const peak = blocks.sort((a, b) => b.n - a.n)[0];
            return {
                id,
                ...MOODS[id],
                total,
                count: list.length,
                avg: Math.round(avg),
                share: taggedSpend ? round((total / taggedSpend) * 100) : 0,
                vsAvg: avgAll ? round(((avg - avgAll) / avgAll) * 100) : null,
                topCategory: topCategoryOf(list),
                peakTime: TIME_BLOCKS.find((b) => b.id === peak.id).label,
            };
        })
        .sort((a, b) => b.total - a.total);

    // Belanja emosional (sedih, self reward, terpaksa, bersalah)
    const emo = tagged.filter((t) => MOODS[normMood(t.mood)].tone === "emotional");
    const emoTotal = emo.reduce((a, t) => a + t.amount, 0);
    const byBlock = TIME_BLOCKS.map((b) => {
        const e = emo.filter((t) => blockOf(t.date) === b.id);
        const o = tagged.filter((t) => MOODS[normMood(t.mood)].tone !== "emotional" && blockOf(t.date) === b.id);
        return {
            id: b.id,
            label: b.label,
            range: b.range,
            emotional: e.reduce((a, t) => a + t.amount, 0),
            other: o.reduce((a, t) => a + t.amount, 0),
            emotionalCount: e.length,
        };
    });
    const byDow = Array.from({ length: 7 }, (_, dow) => {
        const e = emo.filter((t) => wib(t.date).dow === dow);
        return { dow, total: e.reduce((a, t) => a + t.amount, 0), count: e.length };
    });
    const peakBlock = [...byBlock].sort((a, b) => b.emotional - a.emotional)[0];
    const peakDow = [...byDow].sort((a, b) => b.total - a.total)[0];

    const priciest = moods.filter((x) => x.count >= 2).sort((a, b) => b.avg - a.avg)[0] || null;
    const coveragePct = expenses.length ? round((tagged.length / expenses.length) * 100) : 0;

    // Insight singkat
    const insights = [];
    if (priciest && priciest.vsAvg !== null && priciest.vsAvg >= 15) {
        insights.push({
            tone: priciest.tone === "emotional" ? "warn" : "info",
            title: `Saat ${priciest.label.toLowerCase()}, belanjamu ${Math.round(priciest.vsAvg)}% lebih mahal`,
            detail: `Rata-rata ${rupiah(priciest.avg)} per transaksi, dibanding ${rupiah(avgAll)} untuk semua mood.`,
        });
    }
    if (emo.length >= 2 && taggedSpend > 0) {
        const share = round((emoTotal / taggedSpend) * 100);
        insights.push({
            tone: share >= 35 ? "warn" : "good",
            title: `${Math.round(share)}% belanja bermood tercatat saat emosional`,
            detail:
                peakBlock.emotional > 0
                    ? `Paling sering di waktu ${peakBlock.label.toLowerCase()} (${peakBlock.range}) dan hari ${DOW_LONG[peakDow.dow]}. Coba tunda belanja di jam itu.`
                    : "Pertahankan, belanjamu jarang dipicu perasaan.",
        });
    }
    if (coveragePct < 50) {
        insights.push({
            tone: "info",
            title: `Baru ${Math.round(coveragePct)}% pengeluaran yang punya mood`,
            detail: "Tambahkan mood saat mencatat supaya pola belanja emosionalmu makin akurat.",
        });
    }

    return {
        range: {
            months,
            label: `${MONTH_SHORT[first.m - 1]} ${first.y} – ${MONTH_SHORT[m - 1]} ${y}`,
            start: dayKey(start),
            end: dayKey(Math.min(endMs, now.getTime() + DAY) - DAY),
        },
        coverage: { expenseCount: expenses.length, withMood: tagged.length, pct: coveragePct },
        totals: { spend: totalSpend, tagged: taggedSpend, avgPerTx: Math.round(avgAll) },
        moods,
        emotional: {
            total: emoTotal,
            count: emo.length,
            share: taggedSpend ? round((emoTotal / taggedSpend) * 100) : 0,
            avg: emo.length ? Math.round(emoTotal / emo.length) : 0,
            topCategory: topCategoryOf(emo),
            peakTime: peakBlock.emotional > 0 ? { label: peakBlock.label, range: peakBlock.range } : null,
            peakDay: peakDow.total > 0 ? DOW_LONG[peakDow.dow] : null,
        },
        byTime: byBlock,
        byDow,
        priciest: priciest && { id: priciest.id, label: priciest.label, emoji: priciest.emoji, avg: priciest.avg, vsAvg: priciest.vsAvg },
        insights: insights.slice(0, 3),
    };
}

// ── Handler ─────────────────────────────────────────────────────
const fetchRows = (userId, from, to) =>
    Transaction.find({
        user: userId,
        isDeleted: false,
        isTransfer: { $ne: true },
        type: { $in: ["income", "expense"] },
        date: { $gte: from, $lt: to },
    })
        .select("type amount date description category wallet goalId debtId isRecurring mood createdAt")
        .populate("category", "name color icon")
        .populate("wallet", "name")
        .lean();

const parseMonth = (q) => {
    const today = wib(new Date());
    const y = parseInt(q.year, 10) || today.y;
    const m = Math.min(12, Math.max(1, parseInt(q.month, 10) || today.m));
    return { y, m };
};

const getOverview = async (req, res) => {
    try {
        const { y, m } = parseMonth(req.query);
        const prev = shiftMonth(y, m, -1);
        const next = shiftMonth(y, m, 1);
        const rows = await fetchRows(req.user._id, monthStart(prev.y, prev.m), monthStart(next.y, next.m));
        res.json(computeOverview(rows, { y, m }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const { y, m } = parseMonth(req.query);
        const months = [3, 6, 12].includes(Number(req.query.months)) ? Number(req.query.months) : 6;
        const from = shiftMonth(y, m, -(2 * months - 1));
        const next = shiftMonth(y, m, 1);
        const rows = await fetchRows(req.user._id, monthStart(from.y, from.m), monthStart(next.y, next.m));
        res.json(computeAnalytics(rows, { y, m, months }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getMood = async (req, res) => {
    try {
        const { y, m } = parseMonth(req.query);
        const months = [1, 3, 6, 12].includes(Number(req.query.months)) ? Number(req.query.months) : 6;
        const from = shiftMonth(y, m, -(months - 1));
        const next = shiftMonth(y, m, 1);
        const rows = await fetchRows(req.user._id, monthStart(from.y, from.m), monthStart(next.y, next.m));
        res.json(computeMood(rows, { y, m, months }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getOverview,
    getAnalytics,
    getMood,
    computeOverview,
    computeAnalytics,
    computeMood,
    fetchRows,
    // helper bersama (dipakai Wrapped)
    _h: { TZ, DAY, MONTH_LONG, MONTH_SHORT, DOW_LONG, MOODS, normMood, wib, wibHour, dayKey, monthStart, shiftMonth, daysIn, round, pct, rate, kindOf, sum, catInfo, categoryBreakdown, rupiah, topCategoryOf },
};
