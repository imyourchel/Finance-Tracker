/*
 * Uji asap (smoke test) DailyTrack terhadap server & MongoDB sungguhan.
 *
 * Cara pakai (di folder server, server harus sudah jalan di terminal lain):
 *   npm run smoke
 *
 * Skrip ini membuat akun uji sementara, mencoba semua fitur lewat API,
 * lalu MENGHAPUS semua data akun uji itu. Data akunmu sendiri tidak disentuh.
 * Hasil lengkap juga disimpan ke file smoke-report.txt.
 *
 * Opsi:
 *   SMOKE_URL=http://localhost:5000/api  (default dari PORT di .env)
 *   SMOKE_KEEP=1                         (jangan hapus data uji, untuk dicek manual)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const BASE = process.env.SMOKE_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const results = [];
let token = null;

const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

async function api(method, url, body, { raw = false } = {}) {
    const res = await fetch(BASE + url, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = text;
    try {
        data = JSON.parse(text);
    } catch {
        /* bukan JSON */
    }
    if (!res.ok) {
        const err = new Error(`${method} ${url} → ${res.status}: ${data?.message || String(text).slice(0, 200)}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return raw ? { data, res } : data;
}

class Skip extends Error {}

async function step(name, fn) {
    const t0 = Date.now();
    try {
        const note = await fn();
        results.push({ name, status: "OK", ms: Date.now() - t0, note: note || "" });
        console.log(`${color(32, "  ✓")} ${name}${note ? color(90, `  ${note}`) : ""}`);
    } catch (e) {
        if (e instanceof Skip || e.status === 404) {
            results.push({ name, status: "LEWATI", ms: Date.now() - t0, note: e.message });
            console.log(`${color(33, "  –")} ${name}${color(90, `  ${e.message}`)}`);
            return;
        }
        results.push({ name, status: "GAGAL", ms: Date.now() - t0, note: e.message, stack: e.stack });
        console.log(`${color(31, "  ✗")} ${name}\n      ${color(31, e.message)}`);
    }
}

const expect = (cond, msg) => {
    if (!cond) throw new Error(msg);
};

async function main() {
    console.log(color(1, "\nUji asap DailyTrack"));
    console.log(color(90, `Server: ${BASE}\n`));

    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
        console.error("MONGO_URI dan JWT_SECRET harus ada di server/.env");
        process.exit(1);
    }

    // 0. Server hidup?
    try {
        const h = await api("GET", "/health");
        console.log(color(90, `Server hidup, database: ${h.db}\n`));
    } catch (e) {
        console.error(color(31, `Server tidak bisa dihubungi di ${BASE}.`));
        console.error("Jalankan dulu backend (npm run dev) di terminal lain, lalu ulangi.\n", e.message);
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const stamp = Date.now();
    const password = `Uji-${stamp}!`;
    const user = await User.create({
        name: "Akun Uji Otomatis",
        username: `uji_${stamp}`,
        email: `uji+${stamp}@dailytrack.test`,
        password: await bcrypt.hash(password, 10),
        isVerified: true,
        isActive: true,
    });
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const ctx = {};

    try {
        console.log(color(1, "Akun & profil"));
        await step("Masuk dengan email & password", async () => {
            const saved = token;
            token = null;
            try {
                const r = await api("POST", "/auth/login", { email: user.email, password });
                expect(r.token, "tidak ada token di respons login");
            } finally {
                token = saved;
            }
        });
        await step("Ambil profil", async () => {
            const p = await api("GET", "/auth/profile");
            expect(p.email === user.email, "email profil tidak cocok");
            expect(!p.password, "hash password ikut terkirim ke client!");
        });
        await step("Simpan tanggal gajian", async () => {
            const p = await api("PUT", "/auth/profile", { payday: 25 });
            expect(p.payday === 25, `payday tersimpan ${p.payday}`);
        });

        console.log(color(1, "\nKategori & wallet"));
        await step("Buat kategori", async () => {
            const mk = (name, type, icon) => api("POST", "/categories", { name, type, icon, color: "#1e6e55" });
            ctx.catMakan = (await mk("Makan", "expense", "utensils"))._id;
            ctx.catGaji = (await mk("Gaji", "income", "cash"))._id;
            ctx.catTagihan = (await mk("Tagihan", "expense", "file-text"))._id;
            const list = await api("GET", "/categories");
            expect(Array.isArray(list) && list.length >= 3, "daftar kategori kosong");
        });
        await step("Buat wallet bank, cash & emas", async () => {
            ctx.bca = (await api("POST", "/wallets", { name: "BCA Uji", type: "bank", balance: 5000000, color: "#1e6e55" }))._id;
            ctx.cash = (await api("POST", "/wallets", { name: "Cash Uji", type: "cash", balance: 300000 }))._id;
            const gold = await api("POST", "/wallets", { name: "Emas Uji", type: "gold", goldWeight: "2", goldBuyPrice: "1.400.000" });
            ctx.gold = gold._id || gold.wallet?._id;
            const w = await api("GET", "/wallets");
            expect(w.wallets.length === 3, `jumlah wallet ${w.wallets.length}`);
            return `total saldo ${rupiah(w.totalBalance)}`;
        });

        console.log(color(1, "\nTransaksi"));
        const balanceOf = async (id) => (await api("GET", "/wallets")).wallets.find((w) => w._id === id)?.balance;
        await step("Catat pengeluaran → saldo berkurang", async () => {
            const t = await api("POST", "/transactions", { walletId: ctx.bca, categoryId: ctx.catMakan, type: "expense", amount: 25000, description: "Kopi uji", tags: ["uji"], mood: "senang", date: new Date().toISOString() });
            ctx.tx1 = t._id;
            expect((await balanceOf(ctx.bca)) === 4975000, "saldo BCA tidak berkurang 25.000");
        });
        await step("Catat pemasukan", async () => {
            await api("POST", "/transactions", { walletId: ctx.bca, categoryId: ctx.catGaji, type: "income", amount: 1000000, description: "Gaji uji", date: new Date().toISOString() });
            expect((await balanceOf(ctx.bca)) === 5975000, "saldo BCA tidak bertambah");
        });
        await step("Transfer BCA → Cash dengan biaya", async () => {
            await api("POST", "/transactions", { walletId: ctx.bca, transferTo: ctx.cash, type: "transfer", amount: 100000, transferFee: 2500, date: new Date().toISOString() });
            expect((await balanceOf(ctx.cash)) === 400000, "saldo cash tidak bertambah");
            expect((await balanceOf(ctx.bca)) === 5872500, "saldo BCA tidak sesuai setelah transfer + biaya");
        });
        await step("Beli emas 1 gram (transfer ke wallet emas)", async () => {
            if (!ctx.gold) throw new Skip("wallet emas tidak terbuat");
            await api("POST", "/transactions", { walletId: ctx.bca, transferTo: ctx.gold, type: "transfer", amount: 1450000, goldWeight: 1, date: new Date().toISOString() });
            const g = (await api("GET", "/wallets")).wallets.find((w) => w._id === ctx.gold);
            expect(Math.abs(g.goldWeight - 3) < 1e-9, `berat emas ${g.goldWeight}, harusnya 3 gram`);
        });
        await step("Ubah transaksi → saldo menyesuaikan", async () => {
            await api("PUT", `/transactions/${ctx.tx1}`, { walletId: ctx.bca, categoryId: ctx.catMakan, type: "expense", amount: 30000, description: "Kopi uji (ubah)", date: new Date().toISOString() });
            expect((await balanceOf(ctx.bca)) === 4417500, `saldo BCA ${await balanceOf(ctx.bca)}`);
        });
        await step("Daftar & filter transaksi per wallet (histori wallet)", async () => {
            const r = await api("GET", `/transactions?wallet=${ctx.bca}&limit=30`);
            expect(r.transactions.length >= 4, `hanya ${r.transactions.length} transaksi`);
            expect(r.totals && r.totals.income === 1000000, "total uang masuk wallet salah");
        });
        await step("Ringkasan bulanan (dashboard lama)", async () => {
            const now = new Date();
            await api("GET", `/transactions/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
        });

        console.log(color(1, "\nBudget, goals, tagihan rutin"));
        await step("Buat budget, saran & salin bulan lalu", async () => {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            await api("POST", "/budgets", { categoryId: ctx.catMakan, limit: 1000000, month, year });
            const list = await api("GET", `/budgets?month=${month}&year=${year}`);
            const b = (Array.isArray(list) ? list : list.budgets || [])[0];
            expect(b && b.spent === 30000, `budget terpakai ${b?.spent}, harusnya 30.000`);
            await api("GET", `/budgets/suggestions?month=${month}&year=${year}`);
            await api("POST", "/budgets/copy-previous", { month, year });
        });
        await step("Buat goal & setor", async () => {
            const due = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10);
            const g = await api("POST", "/goals", { name: "Dana darurat uji", targetAmount: 3000000, deadline: due });
            ctx.goal = g._id;
            const r = await api("POST", `/goals/${ctx.goal}/saving`, { amount: 200000, walletId: ctx.bca, action: "deposit" });
            expect(r.currentAmount === 200000, "setoran goal tidak tercatat");
            const list = await api("GET", "/goals");
            const goal = (Array.isArray(list) ? list : list.goals || []).find((x) => x._id === ctx.goal);
            expect(goal && goal.health, "analisis goal (health) tidak ada");
        });
        await step("Buat & jeda tagihan rutin", async () => {
            const r = await api("POST", "/recurring", { walletId: ctx.bca, type: "expense", amount: 54000, categoryId: ctx.catTagihan, description: "Netflix uji", frequency: "monthly", startDate: new Date(Date.now() + 864e5).toISOString() });
            ctx.rec = r._id || r.recurring?._id;
            if (ctx.rec) await api("PUT", `/recurring/${ctx.rec}/toggle`);
        });

        console.log(color(1, "\nFitur pintar"));
        await step("Insight dashboard", async () => {
            const o = await api("GET", "/insights/overview");
            expect(o.current, "tidak ada ringkasan bulan berjalan");
            expect(o.current.expense === 30000, `pengeluaran ${o.current.expense} (setoran goal/transfer harus tidak dihitung)`);
        });
        await step("Analitik 6 bulan & mood", async () => {
            await api("GET", "/insights/analytics?months=6");
            const m = await api("GET", "/insights/mood?months=3");
            expect(m.coverage, "tidak ada data cakupan mood");
        });
        await step("Sisa aman sampai gajian", async () => {
            const p = await api("GET", "/payday");
            expect(p.configured && p.daysLeft >= 1, "kartu gajian belum terhitung");
            return `${rupiah(p.dailyAllowance)}/hari, ${p.daysLeft} hari lagi`;
        });
        await step("Wrapped bulan ini", async () => {
            const now = new Date();
            const w = await api("GET", `/wrapped?period=month&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
            expect(w.period, "periode wrapped kosong");
        });
        await step("Kesehatan finansial", async () => {
            const w = await api("GET", "/wellness");
            expect(w.score && typeof w.score.value === "number", "skor tidak terhitung");
            await api("PUT", "/wellness/profile", { household: "lajang", multiplier: 6, fundWallets: [ctx.cash], fundGoals: [ctx.goal] });
            return `skor ${w.score.value}`;
        });

        console.log(color(1, "\nGamifikasi"));
        await step("Level, streak & misi", async () => {
            const g = await api("GET", "/gamification");
            expect(g.streak && g.quests && g.challenges, "struktur gamifikasi tidak lengkap");
            ctx.claimable = [...g.quests.daily, ...g.quests.weekly].find((q) => q.claimable);
            return `level ${g.level}, ${g.xp} XP, streak ${g.streak.current}`;
        });
        await step("Klaim misi", async () => {
            if (!ctx.claimable) throw new Skip("tidak ada misi yang siap diklaim saat ini");
            const r = await api("POST", `/gamification/quests/${ctx.claimable.id}/claim`);
            expect(r.gained > 0, "XP tidak bertambah");
            let dup = false;
            try {
                await api("POST", `/gamification/quests/${ctx.claimable.id}/claim`);
            } catch (e) {
                dup = e.status === 409;
            }
            expect(dup, "klaim ganda tidak ditolak");
        });
        await step("Ikut & keluar tantangan", async () => {
            const r = await api("POST", "/gamification/challenges", { type: "batas-harian", params: { dailyLimit: 100000 } });
            const ch = r.gamification.challenges.active.find((c) => c.type === "batas-harian");
            expect(ch, "tantangan tidak aktif");
            await api("DELETE", `/gamification/challenges/${ch.id}`);
        });

        console.log(color(1, "\nUtang & patungan"));
        await step("Piutang lewat wallet + cicilan", async () => {
            const before = await balanceOf(ctx.bca);
            const r = await api("POST", "/debts", { direction: "owed_to_me", person: "Budi Uji", amount: 150000, walletId: ctx.bca });
            const d = r.debts.find((x) => x.person.toLowerCase().includes("budi"));
            expect(d, "catatan piutang tidak ada");
            expect((await balanceOf(ctx.bca)) === before - 150000, "saldo tidak berkurang saat meminjamkan");
            await api("POST", `/debts/${d._id}/payments`, { amount: 50000, walletId: ctx.bca });
            ctx.debt = d._id;
            const o = await api("GET", "/insights/overview");
            expect(o.current.expense === 30000, "pinjaman ikut terhitung sebagai pengeluaran!");
        });
        await step("Transaksi utang tidak bisa dihapus dari halaman Transaksi", async () => {
            const r = await api("GET", `/transactions?wallet=${ctx.bca}&limit=50`);
            const t = r.transactions.find((x) => x.debtId);
            if (!t) throw new Skip("tidak ada transaksi utang");
            let blocked = false;
            try {
                await api("DELETE", `/transactions/${t._id}`);
            } catch (e) {
                blocked = e.status === 400;
            }
            expect(blocked, "transaksi utang bisa dihapus dari luar halaman Utang");
        });
        await step("Patungan bagi rata", async () => {
            const r = await api("POST", "/debts/splits", { title: "Makan uji", total: 300000, walletId: ctx.bca, categoryId: ctx.catMakan, mode: "equal", includeMe: true, participants: [{ name: "Sari Uji" }, { name: "Andi Uji" }] });
            const s = r.splits[0];
            expect(s && s.myShare === 100000, "bagian sendiri bukan 100.000");
            await api("DELETE", `/debts/splits/${s._id}`);
        });

        console.log(color(1, "\nTambahan (kalau sudah terpasang)"));
        await step("Pusat notifikasi", async () => {
            await api("GET", "/notifications");
        });
        await step("Ekspor CSV transaksi", async () => {
            const { data } = await api("GET", "/data/export/transactions.csv", null, { raw: true });
            expect(String(data).includes("Kopi uji"), "CSV tidak berisi transaksi uji");
        });

        console.log(color(1, "\nKeamanan"));
        await step("Endpoint terlindungi tanpa token", async () => {
            const saved = token;
            token = null;
            let denied = false;
            try {
                await api("GET", "/wallets");
            } catch (e) {
                denied = e.status === 401;
            } finally {
                token = saved;
            }
            expect(denied, "data wallet bisa dibaca tanpa login!");
        });
        await step("Hapus transaksi → saldo kembali", async () => {
            const before = await balanceOf(ctx.bca);
            await api("DELETE", `/transactions/${ctx.tx1}`);
            expect((await balanceOf(ctx.bca)) === before + 30000, "saldo tidak dikembalikan");
        });
    } finally {
        if (process.env.SMOKE_KEEP) {
            console.log(color(33, `\nData uji DISIMPAN (SMOKE_KEEP). Email: ${user.email} / password: ${password}`));
        } else {
            const cols = await mongoose.connection.db.collections();
            let removed = 0;
            for (const c of cols) {
                const r = await c.deleteMany({ user: user._id });
                removed += r.deletedCount || 0;
            }
            await User.deleteOne({ _id: user._id });
            console.log(color(90, `\nData uji dibersihkan (${removed} dokumen + akun uji).`));
        }
        await mongoose.disconnect();
    }

    const ok = results.filter((r) => r.status === "OK").length;
    const fail = results.filter((r) => r.status === "GAGAL");
    const skip = results.filter((r) => r.status === "LEWATI").length;
    const summary = `${ok} lolos, ${fail.length} gagal, ${skip} dilewati`;
    console.log(color(1, `\nHasil: ${summary}`));

    const report = [
        `Uji asap DailyTrack — ${new Date().toLocaleString("id-ID")}`,
        `Server: ${BASE}`,
        `Hasil: ${summary}`,
        "",
        ...results.map((r) => `[${r.status}] ${r.name} (${r.ms} ms)${r.note ? ` — ${r.note}` : ""}`),
        "",
        ...fail.map((r) => `--- ${r.name}\n${r.stack}`),
    ].join("\n");
    const file = path.join(__dirname, "..", "smoke-report.txt");
    fs.writeFileSync(file, report);
    console.log(color(90, `Laporan lengkap: ${file}`));
    if (fail.length) {
        console.log(color(33, "Kirim isi smoke-report.txt ke Claude supaya bisa diperbaiki."));
        process.exitCode = 1;
    }
}

main().catch(async (e) => {
    console.error(e);
    try {
        await mongoose.disconnect();
    } catch {
        /* abaikan */
    }
    process.exit(1);
});
