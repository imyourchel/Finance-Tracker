// Dijalankan dengan: npm test
const { test } = require("node:test");
const assert = require("assert");
const { _internal: P } = require("../controllers/paydayController");

test("siklus gajian: tanggal dipotong ke akhir bulan", () => {
    assert.deepEqual(P.cycleFor("2026-10-26", 28), { last: "2026-09-28", next: "2026-10-28" });
    assert.deepEqual(P.cycleFor("2026-10-28", 28), { last: "2026-10-28", next: "2026-11-28" });
    assert.deepEqual(P.cycleFor("2026-02-10", 31), { last: "2026-01-31", next: "2026-02-28" });
    assert.deepEqual(P.cycleFor("2026-01-05", 1), { last: "2026-01-01", next: "2026-02-01" });
});

test("jatah harian: saldo likuid − tagihan sebelum gajian", () => {
    const r = P.computePayday({
        payday: 28,
        todayKey: "2026-10-26",
        wallets: [
            { _id: 1, name: "BCA", type: "bank", balance: 900000 },
            { _id: 2, name: "Antam", type: "gold", balance: 15e6 },
            { _id: 3, name: "Cash", type: "cash", balance: 100000 },
        ],
        recurrings: [
            { _id: "r1", type: "expense", isActive: true, amount: 300000, description: "Internet", frequency: "monthly", nextRunDate: new Date("2026-10-27T02:00:00Z") },
            { _id: "r2", type: "expense", isActive: true, amount: 50000, description: "Kopi", frequency: "daily", nextRunDate: new Date("2026-10-25T02:00:00Z") },
            { _id: "r3", type: "expense", isActive: true, amount: 999, description: "Nanti", frequency: "monthly", nextRunDate: new Date("2026-11-05T02:00:00Z") },
        ],
        cycleTx: [
            { type: "expense", amount: 40000, date: new Date("2026-10-26T03:00:00Z") },
            { type: "expense", amount: 200000, date: new Date("2026-10-24T03:00:00Z"), goalId: "g" },
            { type: "expense", amount: 500000, date: new Date("2026-10-24T03:00:00Z"), isTransfer: true },
            { type: "expense", amount: 70000, date: new Date("2026-10-24T03:00:00Z"), debtId: "d" },
        ],
    });
    assert.equal(r.liquid, 1000000); // emas tidak dihitung
    assert.equal(r.daysLeft, 2);
    assert.equal(r.billsTotal, 400000); // internet + kopi 26 & 27
    assert.equal(r.spendable, 600000);
    assert.equal(r.spentToday, 40000); // goal, transfer, utang tidak dihitung
    assert.equal(r.dailyAllowance, 320000);
    assert.equal(r.leftToday, 280000);
    assert.equal(r.status, "aman");
});
