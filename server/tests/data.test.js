// Dijalankan dengan: npm test
const { test } = require("node:test");
const S = require("path").join(__dirname, "..") + "/";
const assert = require("assert");
const mongoose = require("mongoose");
const chain = (data) => { const c = { select: () => c, sort: () => c, limit: () => c, populate: () => c, lean: async () => data }; return c; };
const M = (n, o) => Object.assign(require(S + "models/" + n), o);
const uid = new mongoose.Types.ObjectId();
const wid = new mongoose.Types.ObjectId();
const catFood = new mongoose.Types.ObjectId(), catSalary = new mongoose.Types.ObjectId();
let wallet = { _id: wid, user: uid, name: "BCA", type: "bank", balance: 1000000, isArchived: false };
let inserted = [], walletInc = [], budgetUpd = [], softDeleted = [];
M("Wallet", { findOne: async () => wallet, findOneAndUpdate: async (f, u) => { walletInc.push(u.$inc.balance); return { ...wallet, balance: wallet.balance + u.$inc.balance }; }, updateOne: async (f, u) => { walletInc.push(u.$inc.balance); } });
M("Category", { find: () => chain([{ _id: catFood, type: "expense" }, { _id: catSalary, type: "income" }]) });
M("Budget", { updateOne: async (f, u) => budgetUpd.push([f, u]) });
const existing = [{ _id: "e1", date: new Date("2026-10-05T05:00:00Z"), amount: 54000, type: "expense", description: "NETFLIX.COM subscription" }];
let failInsert = false, deleted = null;
M("Transaction", {
  find: (q) => chain(q.tags ? inserted.filter((d) => q._id.$in.map(String).includes(String(d._id))) : existing),
  insertMany: async (docs) => { if (failInsert) throw new Error("boom"); inserted.push(...docs); },
  deleteMany: async (q) => { deleted = q; },
  updateMany: async (q) => { softDeleted.push(...q._id.$in); },
});
const C = require(S + "controllers/dataController");
const { _internal: I } = C;
const res = () => { const r = { code: 200, headers: {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, setHeader(k, v) { r.headers[k] = v; }, send(b) { r.body = b; } }; return r; };
test("ekspor & impor: validasi, duplikat, saldo, batalkan", async () => {
  // CSV
  const csv = I.toCsv([
    { date: new Date("2026-10-05T03:15:00Z"), type: "expense", amount: 54000, category: { name: "Hiburan" }, wallet: { name: "BCA" }, description: 'Netflix; "premium"', tags: ["langganan"], mood: "senang" },
    { date: new Date("2026-10-06T10:00:00Z"), type: "expense", isTransfer: true, amount: 100000, transferFee: 2500, wallet: { name: "BCA" }, transferTo: { name: "GoPay" }, description: "=HYPERLINK(evil)" },
    { date: new Date("2026-10-07T10:00:00Z"), type: "expense", goalId: "g", amount: 200000.5, wallet: { name: "BCA" } },
  ]);
  void (csv);
  assert(csv.startsWith("﻿Tanggal;Jam;Jenis"));
  assert(csv.includes('"Netflix; ""premium"""'));
  assert(csv.includes("'=HYPERLINK(evil)"));
  assert(csv.includes("05/10/2026;10:15;Pengeluaran;Hiburan;BCA;;54000;0;"));
  assert(csv.includes("Transfer;;BCA;GoPay;100000;2500"));
  assert(csv.includes("Setor goal") && csv.includes("200000,5"));
  // filter
  const f = I.buildExportFilter(uid, { from: "2026-10-01", to: "2026-10-31", walletId: String(wid), type: "expense" });
  assert.equal(f.date.$gte.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(f.date.$lt.toISOString(), "2026-10-31T17:00:00.000Z");
  assert.throws(() => I.buildExportFilter(uid, { from: "01/10/2026" }));
  // export handler
  M("Transaction", { find: () => chain([]) });
  let r = res(); await C.exportTransactionsCsv({ user: { _id: uid }, query: { from: "2026-10-01" } }, r);
  assert.equal(r.code, 200); assert(r.headers["Content-Disposition"].includes("dailytrack-transaksi-20261001.csv"));
  r = res(); await C.exportTransactionsCsv({ user: { _id: uid }, query: { from: "x" } }, r); assert.equal(r.code, 400);
  M("Transaction", { find: (q) => chain(q && q.tags ? inserted.filter((d) => q._id.$in.map(String).includes(String(d._id))) : existing), insertMany: async (docs) => { if (failInsert) throw new Error("boom"); inserted.push(...docs); }, deleteMany: async (q) => { deleted = q; }, updateMany: async (q) => { softDeleted.push(...q._id.$in); } });
  // preview: duplicates
  const rows = [
    { date: "2026-10-05", amount: 54000, type: "expense", description: "NETFLIX.COM 123456" },
    { date: "2026-10-06", amount: 54000, type: "expense", description: "Netflix" }, // ±1 hari → likely
    { date: "2026-10-10", amount: 25000, type: "expense", description: "KOPI KENANGAN" },
    { date: "2026-10-10", amount: 25000, type: "expense", description: "kopi kenangan" }, // dalam file
    { date: "2026-10-25", amount: 6500000, type: "income", description: "GAJI OKT" },
    { date: "bad", amount: -1, type: "x" },
  ];
  r = res(); await C.previewImport({ user: { _id: uid }, body: { walletId: String(wid), rows } }, r);
  void (JSON.stringify(r.body.duplicates), JSON.stringify(r.body.invalid));
  const lv = Object.fromEntries(r.body.duplicates.map((d) => [d.index, d.level]));
  assert.equal(lv[0], "exact"); assert.equal(lv[1], "likely"); assert.equal(lv[3], "file"); assert(!lv[2] && !lv[4]);
  assert.equal(r.body.invalid[0].index, 5);
  // import: invalid row → 400, nothing inserted
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows } }, r);
  assert.equal(r.code, 400); assert.equal(inserted.length, 0);
  // kategori tidak cocok
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows: [{ date: "2026-10-10", amount: 1000, type: "income", categoryId: String(catFood) }] } }, r);
  assert.equal(r.code, 400); assert(/tidak cocok/.test(r.body.errors[0].message));
  // saldo minus
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows: [{ date: "2026-10-10", amount: 2000000, type: "expense" }] } }, r);
  assert.equal(r.code, 400); assert(/minus/.test(r.body.message));
  // ok tanpa ubah saldo
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), applyBalance: false, rows: [{ date: "2026-10-10", amount: 2000000, type: "expense", categoryId: String(catFood) }] } }, r);
  assert.equal(r.code, 201); assert.equal(walletInc.length, 0); assert.equal(budgetUpd.length, 1);
  // ok + saldo
  const good = rows.slice(0, 5).map((x, i) => ({ ...x, categoryId: i === 4 ? String(catSalary) : String(catFood) }));
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows: good } }, r);
  void (r.code, JSON.stringify({ ...r.body, ids: r.body.ids.length }));
  assert.equal(r.code, 201); assert.equal(r.body.created, 5); assert.equal(walletInc[0], 6500000 - 54000 * 2 - 50000);
  assert(inserted.every((d) => d.tags.includes("impor")));
  assert.equal(inserted[1].date.toISOString(), "2026-10-05T05:00:00.000Z");
  // gagal insert → rollback
  failInsert = true;
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows: good } }, r);
  assert.equal(r.code, 500); assert.equal(deleted._id.$in.length, 5); failInsert = false;
  // gold wallet ditolak
  wallet = { ...wallet, type: "gold" };
  r = res(); await C.importTransactions({ user: { _id: uid }, body: { walletId: String(wid), rows: good } }, r);
  assert.equal(r.code, 400); wallet = { ...wallet, type: "bank" };
  // undo
  walletInc = [];
  const ids = inserted.slice(1).map((d) => String(d._id));
  r = res(); await C.undoImport({ user: { _id: uid }, body: { ids, revertBalance: true } }, r);
  void ("undo", r.code, r.body, walletInc);
  assert.equal(r.body.reverted, 5); assert.equal(walletInc[0], -(6500000 - 54000 * 2 - 50000));
  void ("ALL OK");
});
