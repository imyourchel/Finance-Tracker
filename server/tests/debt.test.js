// Dijalankan dengan: npm test
const { test } = require("node:test");
const S = require("path").join(__dirname, "..") + "/";
const assert = require("assert");
const mongoose = require("mongoose");
const Debt = require(S + "models/Debt"), SplitBill = require(S + "models/SplitBill"), Transaction = require(S + "models/Transaction"), Wallet = require(S + "models/Wallet");
const stores = new Map();
const match = (doc, q) => Object.entries(q).every(([k, v]) => {
  const dv = doc[k];
  if (v && typeof v === "object" && "$ne" in v) return dv !== v.$ne;
  return String(dv) === String(v);
});
function stub(M) {
  const st = new Map(); stores.set(M.modelName, st);
  M.prototype.save = async function () { st.set(String(this._id), this); return this; };
  M.create = async (d) => { const doc = new M(d); await doc.save(); return doc; };
  M.findOne = async (q) => [...st.values()].find((d) => match(d, q)) || null;
  const chain = (arr) => { const c = { sort: () => c, select: () => c, lean: async () => arr.map((d) => d.toObject()) }; return c; };
  M.find = (q) => { const arr = [...st.values()].filter((d) => match(d, q)); const p = Promise.resolve(arr); return Object.assign(p, chain(arr)); };
  M.deleteOne = async (q) => { for (const [k, d] of st) if (match(d, q)) { st.delete(k); break; } };
  M.deleteMany = async (q) => { for (const [k, d] of [...st]) if (match(d, q)) st.delete(k); };
  return st;
}
const Ws = stub(Wallet), Ds = stub(Debt), Ss = stub(SplitBill), Ts = stub(Transaction);
const C = require(S + "controllers/debtController");
const uid = new mongoose.Types.ObjectId();
const call = async (fn, body = {}, params = {}) => { const r = { code: 200, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; await fn({ user: { _id: uid }, body, params }, r); return r; };
const bal = (w) => Ws.get(String(w._id)).balance;
test("utang-piutang & patungan: saldo, cicilan, pembatalan", async () => {
  const bca = await Wallet.create({ user: uid, name: "BCA", type: "bank", balance: 1000000 });
  const gold = await Wallet.create({ user: uid, name: "Antam", type: "gold", balance: 5000000 });
  // shares
  const { _internal: I } = C;
  let s = I.computeShares({ total: 100000, mode: "equal", includeMe: true, participants: [{ name: "Budi" }, { name: "Sari" }] });
  assert.deepEqual(s.people.map((p) => p.share), [33333, 33333]); assert.equal(s.myShare, 33334);
  s = I.computeShares({ total: 100001, mode: "equal", includeMe: false, participants: [{ name: "Budi" }, { name: "Sari" }] });
  assert.deepEqual(s.people.map((p) => p.share), [50001, 50000]); assert.equal(s.myShare, 0);
  assert.throws(() => I.computeShares({ total: 100, mode: "equal", includeMe: true, participants: [{ name: "a" }, { name: "A " }] }), /sama/);
  assert.throws(() => I.computeShares({ total: 100, mode: "custom", includeMe: false, participants: [{ name: "a", share: 50 }] }), /harus sama/);

  // piutang lewat wallet
  let r = await call(C.createDebt, { direction: "owed_to_me", person: " budi  santoso ", amount: "150.000", walletId: String(bca._id), dueDate: "2020-01-01", date: "2019-12-01" });
  assert.equal(r.code, 201, JSON.stringify(r.body)); assert.equal(bal(bca), 850000);
  const d1 = r.body.debts[0]; assert.equal(d1.person, "budi santoso"); assert.equal(d1.overdue, true); assert.equal(r.body.summary.owedToMe, 150000);
  const tx1 = [...Ts.values()][0]; assert.equal(tx1.type, "expense"); assert.equal(String(tx1.debtId), d1._id);
  // utang tanpa wallet
  r = await call(C.createDebt, { direction: "i_owe", person: "Budi Santoso", amount: 40000 });
  assert.equal(r.body.summary.iOwe, 40000); assert.equal(r.body.summary.people.length, 1); assert.equal(r.body.summary.people[0].net, 110000);
  // wallet emas ditolak
  r = await call(C.createDebt, { direction: "owed_to_me", person: "X", amount: 1, walletId: String(gold._id) }); assert.equal(r.code, 400);
  // saldo tidak cukup
  r = await call(C.createDebt, { direction: "owed_to_me", person: "Y", amount: 9e6, walletId: String(bca._id) }); assert.equal(r.code, 400); void ("insufficient:", r.body.message);
  // cicilan
  r = await call(C.addPayment, { amount: 50000, walletId: String(bca._id) }, { id: d1._id });
  assert.equal(r.code, 201, JSON.stringify(r.body)); assert.equal(bal(bca), 900000);
  let d = r.body.debts.find((x) => x._id === d1._id); assert.equal(d.remaining, 100000); assert.equal(d.payments.length, 1);
  r = await call(C.addPayment, { amount: 200000 }, { id: d1._id }); assert.equal(r.code, 400);
  r = await call(C.addPayment, { amount: 100000 }, { id: d1._id }); d = r.body.debts.find((x) => x._id === d1._id); assert.equal(d.status, "settled"); assert.equal(bal(bca), 900000);
  // hapus pembayaran pertama → saldo kembali, status open
  r = await call(C.deletePayment, {}, { id: d1._id, paymentId: d.payments.find((p) => p.wallet)._id });
  d = r.body.debts.find((x) => x._id === d1._id); assert.equal(d.status, "open"); assert.equal(d.remaining, 50000); assert.equal(bal(bca), 850000);
  // ubah nominal yang tercatat di wallet → ditolak; ubah jatuh tempo boleh
  r = await call(C.updateDebt, { amount: 10 }, { id: d1._id }); assert.equal(r.code, 400);
  r = await call(C.updateDebt, { dueDate: "2099-01-01", note: "buat bensin" }, { id: d1._id }); assert.equal(r.code, 200); d = r.body.debts.find((x) => x._id === d1._id); assert.equal(d.overdue, false);
  // hapus debt → semua transaksi dibalik
  r = await call(C.deleteDebt, {}, { id: d1._id }); assert.equal(bal(bca), 1000000);
  assert.ok([...Ts.values()].every((t) => t.isDeleted));
  // patungan
  const cat = new mongoose.Types.ObjectId();
  r = await call(C.createSplit, { title: "Makan malam", total: 300000, walletId: String(bca._id), categoryId: String(cat), participants: [{ name: "Budi" }, { name: "Sari" }], dueDate: "2099-02-01" });
  assert.equal(r.code, 201, JSON.stringify(r.body)); assert.equal(bal(bca), 700000);
  const sp = r.body.splits[0]; assert.equal(sp.myShare, 100000); assert.equal(sp.outstanding, 200000); assert.equal(r.body.summary.owedToMe, 200000);
  const mine = [...Ts.values()].find((t) => !t.isDeleted && !t.debtId); assert.equal(mine.amount, 100000); assert.equal(String(mine.category), String(cat));
  // peserta bayar
  r = await call(C.addPayment, { amount: 100000, walletId: String(bca._id) }, { id: sp.participants[0].debtId });
  assert.equal(r.body.splits[0].collected, 100000); assert.equal(bal(bca), 800000);
  // hapus debt bagian patungan → ditolak
  r = await call(C.deleteDebt, {}, { id: sp.participants[1].debtId }); assert.equal(r.code, 400);
  // hapus patungan → saldo kembali penuh
  r = await call(C.deleteSplit, {}, { id: sp._id }); assert.equal(bal(bca), 1000000); assert.equal(r.body.splits.length, 0);
  assert.equal(r.body.debts.filter((x) => x.direction === "owed_to_me").length, 0);
  void ("summary", JSON.stringify(r.body.summary));
  void ("ALL OK");
});
