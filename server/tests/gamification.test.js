// Dijalankan dengan: npm test
const { test } = require("node:test");

test("gamifikasi: streak, perisai, tantangan", async () => {
    const path = "../controllers/gamificationController.js";
    const { _internal: I } = require(path);
    const assert = require("assert");
    const T = "2026-10-26"; // Senin
    // streak: 7 hari aktif → 1 perisai, bolong 1 hari diselamatkan, lanjut
    const days = new Set();
    for (let i = 0; i < 7; i++) days.add(I.addDays("2026-10-10", i)); // 10..16
    // 17 bolong
    for (let i = 0; i < 9; i++) days.add(I.addDays("2026-10-18", i)); // 18..26
    let s = I.computeStreak(days, T);
    void ("streak", s);
    assert.equal(s.current, 16); assert.deepEqual(s.savedDays, ["2026-10-17"]); assert.equal(s.activeToday, true);
    // tanpa perisai: 5 hari lalu bolong
    const d2 = new Set(["2026-10-20","2026-10-21","2026-10-23","2026-10-24","2026-10-25"]);
    s = I.computeStreak(d2, T); void ("streak2", s.current, s.atRisk, s.best); assert.equal(s.current, 3); assert.equal(s.atRisk, true);
    // tantangan batas harian
    const spendByDay = { "2026-10-20": 40000, "2026-10-21": 60000, "2026-10-26": 10000 };
    const ctx = { todayKey: T, spendByDay, monthFlow: { "2026-10": { income: 1000, expense: 650 } }, goalNetSince: () => 150000 };
    let e = I.evaluateChallenge({ _id: 1, type: "batas-harian", params: { dailyLimit: 50000 }, startKey: "2026-10-20", endKey: "2026-10-26", status: "active" }, ctx);
    void ("batas", e.status, e.summary); assert.equal(e.status, "failed");
    e = I.evaluateChallenge({ _id: 1, type: "batas-harian", params: { dailyLimit: 70000 }, startKey: "2026-10-20", endKey: "2026-10-26", status: "active" }, ctx);
    void ("batas2", e.status, e.summary); assert.equal(e.status, "active");
    e = I.evaluateChallenge({ _id: 1, type: "tanpa-jajan-3", startKey: "2026-10-20", endKey: "2026-10-26", status: "active" }, ctx);
    void ("tj3", e.status, e.summary, e.days.map(d=>d.state).join()); assert.equal(e.status, "completed");
    e = I.evaluateChallenge({ _id: 1, type: "akhir-pekan", startKey: "2026-10-31", endKey: "2026-11-01", status: "active" }, ctx);
    void ("weekend", e.status, e.summary, e.startsIn);
    e = I.evaluateChallenge({ _id: 1, type: "sisa-bulan", params: { targetRate: 30 }, startKey: "2026-10-05", endKey: "2026-10-31", status: "active" }, ctx);
    void ("sisa", e.status, e.summary, e.progress);
    e = I.evaluateChallenge({ _id: 1, type: "52-minggu", params: { baseAmount: 10000 }, startKey: "2026-10-05", endKey: I.addDays("2026-10-05", 363), status: "active" }, ctx);
    void ("52", e.status, e.week, e.dueSoFar, e.saved, e.onTrack);
    void ("monday", I.mondayOf("2026-11-01"), I.mondayOf(T));
    void ("ALL OK");

});
