// Dijalankan dengan: npm test
const { test } = require("node:test");
const assert = require("assert");
const { computeOverview, computeAnalytics } = require("../controllers/insightsController");

const W = (y, m, d, h = 12) => new Date(Date.UTC(y, m - 1, d, h - 7)); // jam WIB
const cat = (n) => ({ _id: n, name: n, color: "#888", icon: "tag" });
const rows = [
    { type: "income", amount: 6000000, date: W(2026, 9, 1), category: cat("Gaji") },
    { type: "expense", amount: 1000000, date: W(2026, 9, 5), category: cat("Makan") },
    { type: "expense", amount: 300000, date: W(2026, 9, 10), goalId: "g" },
    { type: "income", amount: 6500000, date: W(2026, 10, 1), category: cat("Gaji") },
    { type: "expense", amount: 1600000, date: W(2026, 10, 3), category: cat("Makan") },
    { type: "expense", amount: 200000, date: W(2026, 10, 1, 1), category: cat("Makan") }, // 01.00 WIB 1 Okt
    { type: "expense", amount: 500000, date: W(2026, 10, 8), goalId: "g" },
    { type: "expense", amount: 90000, date: W(2026, 10, 8), debtId: "d" },
];
const now = W(2026, 10, 10, 20);

test("ringkasan bulan: tanpa transfer/goal/utang, bucket WIB", () => {
    const o = computeOverview(rows, { y: 2026, m: 10, now });
    assert.equal(o.current.income, 6500000);
    assert.equal(o.current.expense, 1800000); // 1.600.000 + 200.000 (1 Okt WIB)
    assert.equal(o.current.goalSaved, 500000);
    assert.equal(o.previous.expense, 1000000);
    assert.ok(o.projection && o.projection.expense >= o.current.expense);
});

test("analitik 3 bulan", () => {
    const a = computeAnalytics(rows, { y: 2026, m: 10, months: 3, now });
    assert.equal(a.months.length, 3);
    const okt = a.months[a.months.length - 1];
    assert.equal(okt.expense, 1800000);
    assert.ok(Array.isArray(a.heatmap) && a.heatmap.length > 0);
});
