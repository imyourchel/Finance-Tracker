// Dijalankan dengan: npm test
const { test } = require("node:test");

test("wrapped & mood: periode, total, pengecualian", async () => {
    const assert = require("assert");
    const { computeWrapped, resolvePeriod } = require("../controllers/wrappedController");
    const { computeMood } = require("../controllers/insightsController");
    const { rows, wibDate } = require("./fixtures/wrap-sample");
    const now = wibDate(2026, 10, 26, 14);
    const p = resolvePeriod({ period: "month", year: 2026, month: 10 }, now);
    const w = computeWrapped(rows, rows, p, now);
    void (JSON.stringify({ period: w.period, totals: w.totals, change: w.change, top: w.topCategories.map(c => c.name + " " + c.share), busiest: w.busiestDay, fav: w.favoriteDay, biggest: w.biggest && w.biggest.description, activity: w.activity, mood: w.mood, personality: w.personality, tips: w.tips }, null, 1));
    // debt & goal tidak dihitung
    const expOct = rows.filter(t => t.type === "expense" && !t.goalId && !t.debtId && t.date >= p.start && t.date < p.end).reduce((a, t) => a + t.amount, 0);
    assert.equal(w.totals.expense, expOct);
    assert.equal(w.totals.income, 8000000);
    assert.equal(w.biggest.description, "Sepatu lari");
    // default periode: tgl 26 → bulan ini; tgl 3 → bulan lalu
    assert.equal(resolvePeriod({}, wibDate(2026, 10, 26, 10)).month, 10);
    assert.equal(resolvePeriod({}, wibDate(2026, 11, 3, 10)).month, 10);
    const yr = resolvePeriod({ period: "year", year: 2026 }, now);
    const wy = computeWrapped(rows, rows, yr, now);
    assert.equal(wy.totals.income, 16000000); assert.equal(wy.period.label, "Tahun 2026");
    const empty = computeWrapped([], [], resolvePeriod({ period: "month", year: 2025, month: 1 }, now), now);
    assert.equal(empty.empty, true);
    const m = computeMood(rows, { y: 2026, m: 10, months: 3, now });
    void (JSON.stringify({ coverage: m.coverage, totals: m.totals, moods: m.moods.map(x => `${x.id} ${x.count} avg ${x.avg} vs ${x.vsAvg} top ${x.topCategory.name} ${x.peakTime}`), emotional: m.emotional, priciest: m.priciest, insights: m.insights }, null, 1));
    assert.ok(m.moods.find(x => x.id === "senang").count > 0); // 'happy' alias digabung
    assert.ok(!m.moods.find(x => x.id === "happy"));
    void ("ALL OK");

});
