// Dijalankan dengan: npm test (folder client)
import { test } from "node:test";
import assert from "node:assert";
import { parseQuick, learnFromHistory } from "../src/utils/quickParse.js";

const wallets = [
    { _id: "bca", name: "BCA", type: "bank", isDefault: true },
    { _id: "gopay", name: "GoPay", type: "e-wallet" },
    { _id: "cash", name: "Dompet", type: "cash" },
    { _id: "antam", name: "Antam", type: "gold" },
    { _id: "jago", name: "Bank Jago", type: "bank" },
];
const cat = (id, name, type) => ({ _id: id, name, type });
const categories = [
    cat("makan", "Makan", "expense"),
    cat("trans", "Transport", "expense"),
    cat("bel", "Belanja", "expense"),
    cat("tag", "Tagihan", "expense"),
    cat("lainE", "Lainnya", "expense"),
    cat("gaji", "Gaji", "income"),
    cat("free", "Freelance", "income"),
    cat("hib", "Hiburan", "expense"),
];
const learned = learnFromHistory([{ description: "laundry kiloan", category: "bel" }]);
const now = new Date(2026, 9, 26, 14, 30); // Senin, waktu lokal
const one = (text) => parseQuick(text, { wallets, categories, learned, now })[0];

test("nominal gaya Indonesia", () => {
    assert.equal(one("kopi 18rb").amount, 18000);
    assert.equal(one("gaji 6,5jt").amount, 6500000);
    assert.equal(one("sepatu Rp 450.000").amount, 450000);
    assert.equal(one("parkir goceng").amount, 5000);
    assert.equal(one("laundry 35k").amount, 35000);
    assert.equal(one("beli sesuatu").amount, 0);
});

test("jenis, wallet, kategori", () => {
    const k = one("kopi 18rb gopay");
    assert.equal(k.type, "expense");
    assert.equal(k.walletId, "gopay");
    assert.equal(k.categoryId, "makan");
    assert.equal(k.description, "Kopi");
    const g = one("gaji 6,5jt bca");
    assert.equal(g.type, "income");
    assert.equal(g.categoryId, "gaji");
    assert.equal(one("freelance logo 1.5jt jago").walletId, "jago");
    assert.equal(one("laundry 35k").categoryId, "bel"); // dari kebiasaan
    assert.equal(one("beli sesuatu 10rb").walletId, "bca"); // default, bukan emas
});

test("transfer", () => {
    const t = one("topup gopay 100rb dari bca");
    assert.equal(t.type, "transfer");
    assert.equal(t.walletId, "bca");
    assert.equal(t.transferTo, "gopay");
    const t2 = one("tf 250rb dari bca ke bank jago");
    assert.equal(t2.transferTo, "jago");
});

test("tanggal, tag, mood, banyak transaksi", () => {
    assert.equal(one("kopi 18rb kemarin").date.getDate(), 25);
    assert.equal(one("sepatu 450rb sabtu").date.getDate(), 24);
    const o = one("ojol 15 rb 2 hari lalu jam 8 malam");
    assert.equal(o.date.getDate(), 24);
    assert.equal(o.date.getHours(), 20);
    const many = parseQuick("parkir goceng; bensin 30rb #motor @terpaksa", { wallets, categories, learned, now });
    assert.equal(many.length, 2);
    assert.deepEqual(many[1].tags, ["motor"]);
    assert.equal(many[1].mood, "terpaksa");
});
