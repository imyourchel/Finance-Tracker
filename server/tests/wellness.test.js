// Dijalankan dengan: npm test
const { test } = require("node:test");

test("kesehatan finansial: deteksi langganan, dana darurat, skor", async () => {
    const assert = require("assert");
    const { _internal: W } = require("../controllers/wellnessController.js");
    const T = "2026-10-26";
    const at = (key, h = 5) => new Date(Date.parse(key) + h * 3600e3 - 7 * 3600e3); // jam WIB
    const rows = [];
    const tx = (key, amount, description, extra = {}) => rows.push({ type: "expense", amount, description, date: at(key), category: extra.category || "cat-ent", categoryName: extra.categoryName || "Hiburan", wallet: "w1", ...extra });
    // Netflix naik harga
    ["2026-05-05", "2026-06-05", "2026-07-05", "2026-08-05"].forEach((k) => tx(k, 54000, "Netflix"));
    ["2026-09-05", "2026-10-05"].forEach((k) => tx(k, 65000, "Bayar Netflix Okt"));
    // Spotify 54.990 — beda layanan, nominal mirip
    ["2026-06-12", "2026-07-12", "2026-08-12", "2026-09-12", "2026-10-12"].forEach((k) => tx(k, 54990, "Spotify premium"));
    // Dua merchant tak dikenal sama-sama Rp54.000
    ["2026-07-20", "2026-08-21", "2026-09-19", "2026-10-20"].forEach((k) => tx(k, 54000, "Ruang belajar anak", { category: "cat-edu" }));
    ["2026-08-01", "2026-09-01", "2026-10-01"].forEach((k) => tx(k, 54000, "Arisan RT 05", { category: "cat-sos" }));
    // Vidio berhenti
    ["2026-05-15", "2026-06-15", "2026-07-15"].forEach((k) => tx(k, 39000, "Vidio"));
    // Kopi harian acak
    for (let i = 0; i < 40; i++) tx(new Date(Date.parse("2026-09-01") + i * 86400e3).toISOString().slice(0, 10), 15000 + (i % 7) * 3000, "Kopi", { category: "cat-food" });
    // Futsal mingguan (bukan langganan dikenal → tidak boleh mingguan)
    for (let i = 0; i < 8; i++) tx(new Date(Date.parse("2026-08-29") + i * 7 * 86400e3).toISOString().slice(0, 10), 50000, "Sewa lapangan futsal", { category: "cat-sport" });
    // Pulsa bervariasi
    [["2026-07-03", 50000], ["2026-08-02", 100000], ["2026-09-03", 50000], ["2026-10-02", 75000]].forEach(([k, a]) => tx(k, a, "Pulsa Telkomsel", { category: "cat-bill" }));
    // Google One tahunan
    tx("2025-10-20", 269000, "Google One 100GB"); tx("2026-10-19", 269000, "Google One");
    // ChatGPT sekali
    tx("2026-10-10", 330000, "ChatGPT Plus");
    // Mengganggu: transfer, goal, utang
    rows.push({ type: "expense", amount: 500000, description: "Netflix", date: at("2026-10-05"), isTransfer: true });
    rows.push({ type: "expense", amount: 200000, description: "Setor ke goal", date: at("2026-10-05"), goalId: "g1" });
    rows.push({ type: "expense", amount: 54000, description: "Bayar utang Netflix ke Budi", date: at("2026-10-06"), debtId: "d1" });
    const recs = [
      { _id: "r1", type: "expense", amount: 1500000, description: "Bayar kos", category: "cat-home", categoryName: "Tempat tinggal", frequency: "monthly", nextRunDate: at("2026-11-01"), lastRunDate: at("2026-10-01"), isActive: true, wallet: "w1", history: [] },
      { _id: "r2", type: "expense", amount: 54990, description: "Spotify", category: "cat-ent", frequency: "monthly", nextRunDate: at("2026-11-12"), isActive: true, history: [] },
      { _id: "r3", type: "expense", amount: 99000, description: "Gym", category: "cat-sport", frequency: "monthly", nextRunDate: at("2026-11-12"), isActive: false, history: [] },
    ];
    const out = W.detectSubscriptions(rows, recs, { todayKey: T, ignored: ["svc:pulsa"] });
    const show = (it) => `${it.key.padEnd(28)} ${it.frequency.padEnd(9)} ${String(it.amount).padStart(8)} next=${it.nextKey} due=${it.dueIn} ${it.status} conf=${it.confidence}${it.priceChange ? ` price ${it.priceChange.from}->${it.priceChange.to} (${it.priceChange.pct}%)` : ""}${it.hasRecurring ? " [rutin]" : ""}${it.single ? " [sekali]" : ""}`;
    void ("ACTIVE"); out.items.forEach((it) => void (" ", show(it)));
    void ("STALE"); out.stale.forEach((it) => void (" ", show(it)));
    void ("IGNORED"); out.ignored.forEach((it) => void (" ", show(it)));
    void ("totals", out.totals);
    const by = (k) => [...out.items, ...out.stale, ...out.ignored].find((i) => i.key === k);
    assert(by("svc:netflix").priceChange.to === 65000 && by("svc:netflix").amount === 65000);
    assert(by("svc:spotify").hasRecurring && by("svc:spotify").amount === 54990);
    assert(by("d:ruang belajar anak") && by("d:arisan rt"), "dua merchant 54rb harus terpisah");
    assert(by("svc:vidio").status === "stale");
    assert(!by("d:kopi"), "kopi bukan langganan");
    assert(!by("d:sewa lapangan futsal"), "mingguan tak dikenal tidak dihitung");
    assert(by("svc:pulsa").ignored && by("svc:pulsa").variable);
    assert(by("svc:googleone").frequency === "yearly");
    assert(by("svc:chatgpt").single);
    assert(by("r:r1").source === "recurring" && !by("r:r3"));
    assert(by("svc:netflix").occurrences === 6, "transfer/utang tidak ikut");
    void ("normalize:", W.normalizeDesc("Bayar Netflix Okt 2026 (recurring)"), "|", W.normalizeDesc("Langganan Spotify 12/10"));

    // Dana darurat
    const flowRows = [];
    for (const mk of ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
      flowRows.push({ type: "income", amount: 8000000, date: at(mk + "-01") });
      flowRows.push({ type: "expense", amount: 5000000, date: at(mk + "-10") });
    }
    flowRows.push({ type: "expense", amount: 9999999, date: at("2026-09-10"), isTransfer: true });
    flowRows.push({ type: "expense", amount: 1000000, date: at("2026-09-12"), goalId: "g1" });
    flowRows.push({ type: "expense", amount: 1000000, date: at("2026-08-12"), goalId: "g1" });
    const flows = W.monthlyFlows(flowRows);
    const goalRows = flowRows.filter((t) => t.goalId);
    const em = W.computeEmergency({
      flows, todayKey: T,
      wallets: [{ _id: "w1", name: "BCA", balance: 2000000 }, { _id: "w9", name: "Tabungan Darurat", balance: 3000000 }],
      goals: [{ _id: "g1", name: "Dana darurat", currentAmount: 4000000, status: "active" }],
      profile: null, goalRows,
    });
    void ("emergency", JSON.stringify(em));
    assert.equal(em.monthlyExpense, 5000000); assert.equal(em.multiplier, 6); assert.equal(em.collected, 7000000);
    assert(em.sources.auto && em.paceSource === "goal");
    const em2 = W.computeEmergency({ flows, todayKey: T, wallets: [{ _id: "w1", name: "BCA", balance: 2000000 }], goals: [], profile: { household: "freelancer", configured: true, fundWallets: ["w1"] }, goalRows });
    assert.equal(em2.multiplier, 12); assert.equal(em2.target, 60000000); assert.equal(em2.paceSource, "saving");
    void ("em2", em2.monthsCovered, em2.monthsToTarget, em2.etaKey, em2.stage);
    const sc = W.computeScore({ flows, todayKey: T, emergency: em, subscriptions: out, budgets: [{ limit: 100, spent: 120 }, { limit: 100, spent: 50 }], activeDays30: 14 });
    void ("score", sc.value, sc.grade, sc.factors.map((f) => `${f.key}:${f.score}/${f.max}`).join(" "), "focus", sc.focus);
    void ("ALL OK");

});
