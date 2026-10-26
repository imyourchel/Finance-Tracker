const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Category = require("../models/Category");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Recurring = require("../models/Recurring");

// Model opsional (fitur utang-piutang). Kalau belum ada, cadangan tetap jalan.
const optionalModel = (name) => {
    try {
        return require(`../models/${name}`);
    } catch {
        return null;
    }
};
const Debt = optionalModel("Debt");
const SplitBill = optionalModel("SplitBill");

/*
 * Ekspor & impor data
 * ───────────────────
 * - CSV transaksi: UTF-8 + BOM, pemisah ";" supaya Excel berbahasa Indonesia
 *   langsung memecah kolom. Transfer ditulis satu baris (sisi keluar).
 * - Cadangan JSON: semua data milik pengguna.
 * - Impor mutasi: semua baris divalidasi dulu, baru dimasukkan sekaligus.
 *   Kalau ada yang gagal di tengah jalan, semua yang sudah masuk dihapus lagi.
 */

const TZ = 7 * 60 * 60 * 1000; // WIB
const DAY = 24 * 60 * 60 * 1000;
const MAX_IMPORT = 2000;
const MAX_EXPORT = 50000;
const IMPORT_TAG = "impor";

const pad = (n) => String(n).padStart(2, "0");
const wib = (d) => new Date(new Date(d).getTime() + TZ);
const fmtDate = (d) => {
    const x = wib(d);
    return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
};
const fmtTime = (d) => {
    const x = wib(d);
    return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
};
const dayKey = (d) => wib(d).toISOString().slice(0, 10);
// "2026-10-01" → awal hari WIB
const startOfKey = (key) => new Date(Date.parse(`${key}T00:00:00Z`) - TZ);
const isKey = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const MOOD_LABEL = {
    senang: "Senang",
    sedih: "Sedih",
    biasa: "Biasa",
    self_reward: "Self reward",
    terpaksa: "Terpaksa",
    bangga: "Bangga",
    bersalah: "Bersalah",
    happy: "Senang",
    neutral: "Biasa",
    stressed: "Terpaksa",
    guilty: "Bersalah",
    proud: "Bangga",
};

// ── CSV ─────────────────────────────────────────────────────────────
// Sel teks yang diawali = + - @ bisa dijalankan sebagai rumus oleh Excel.
const csvText = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvNum = (n) => (Number.isFinite(Number(n)) ? String(Math.round(Number(n) * 100) / 100).replace(".", ",") : "");

function kindLabel(t) {
    if (t.isTransfer) return "Transfer";
    if (t.goalId) return t.type === "expense" ? "Setor goal" : "Tarik goal";
    if (t.debtId) return t.type === "expense" ? "Utang-piutang keluar" : "Utang-piutang masuk";
    return t.type === "income" ? "Pemasukan" : "Pengeluaran";
}

const CSV_HEADER = ["Tanggal", "Jam", "Jenis", "Kategori", "Wallet", "Wallet tujuan", "Nominal", "Biaya", "Catatan", "Tag", "Mood"];

function toCsv(transactions) {
    const lines = [CSV_HEADER.join(";")];
    for (const t of transactions) {
        lines.push(
            [
                csvText(fmtDate(t.date)),
                csvText(fmtTime(t.date)),
                csvText(kindLabel(t)),
                csvText(t.isTransfer ? "" : t.category?.name || ""),
                csvText(t.wallet?.name || ""),
                csvText(t.isTransfer ? t.transferTo?.name || "" : ""),
                csvNum(t.amount),
                csvNum(t.transferFee || 0),
                csvText(t.description || ""),
                csvText((t.tags || []).filter(Boolean).join(", ")),
                csvText(MOOD_LABEL[t.mood] || ""),
            ].join(";"),
        );
    }
    // BOM supaya Excel membaca UTF-8 (huruf seperti é, emoji di catatan)
    return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function buildExportFilter(userId, q) {
    const filter = { user: userId, isDeleted: false };
    // Sisi masuk transfer tidak ditulis; transfer cukup satu baris
    const notTransferIn = { $nor: [{ isTransfer: true, type: "income" }] };
    const and = [notTransferIn];

    if (q.from || q.to) {
        if ((q.from && !isKey(q.from)) || (q.to && !isKey(q.to))) throw new Error("Format tanggal harus YYYY-MM-DD");
        filter.date = {};
        if (q.from) filter.date.$gte = startOfKey(q.from);
        if (q.to) filter.date.$lt = new Date(startOfKey(q.to).getTime() + DAY);
    }
    if (q.walletId) {
        if (!mongoose.isValidObjectId(q.walletId)) throw new Error("Wallet tidak valid");
        and.push({ $or: [{ wallet: q.walletId }, { isTransfer: true, type: "expense", transferTo: q.walletId }] });
    }
    if (q.type === "income" || q.type === "expense") {
        filter.type = q.type;
        filter.isTransfer = { $ne: true };
    } else if (q.type === "transfer") {
        filter.isTransfer = true;
    }
    filter.$and = and;
    return filter;
}

const exportTransactionsCsv = async (req, res) => {
    try {
        let filter;
        try {
            filter = buildExportFilter(req.user._id, req.query);
        } catch (e) {
            return res.status(400).json({ message: e.message });
        }
        const rows = await Transaction.find(filter)
            .populate("category", "name")
            .populate("wallet", "name")
            .populate("transferTo", "name")
            .sort({ date: 1 })
            .limit(MAX_EXPORT)
            .lean();

        const stamp = (k) => (k ? k.replace(/-/g, "") : "");
        const name = `dailytrack-transaksi${req.query.from ? `-${stamp(req.query.from)}` : ""}${req.query.to ? `-${stamp(req.query.to)}` : ""}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
        res.setHeader("X-Row-Count", String(rows.length));
        res.send(toCsv(rows));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportBackup = async (req, res) => {
    try {
        const user = req.user._id;
        const q = (Model, extra = {}) => (Model ? Model.find({ user, ...extra }).lean() : Promise.resolve([]));
        const [wallets, categories, transactions, budgets, goals, recurring, debts, splits] = await Promise.all([
            q(Wallet),
            Category.find({ $or: [{ user }, { user: null }] }).lean(),
            q(Transaction, { isDeleted: false }),
            q(Budget),
            q(Goal),
            q(Recurring),
            q(Debt),
            q(SplitBill),
        ]);
        const payload = {
            app: "DailyTrack",
            kind: "backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            user: { id: String(user), name: req.user.name || "", email: req.user.email || "" },
            counts: {
                wallets: wallets.length,
                categories: categories.length,
                transactions: transactions.length,
                budgets: budgets.length,
                goals: goals.length,
                recurring: recurring.length,
                debts: debts.length,
                splits: splits.length,
            },
            data: { wallets, categories, transactions, budgets, goals, recurring, debts, splits },
        };
        const name = `dailytrack-cadangan-${dayKey(new Date()).replace(/-/g, "")}.json`;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
        res.send(JSON.stringify(payload, null, 2));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Impor ───────────────────────────────────────────────────────────
const normDesc = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/\d+/g, " ")
        .replace(/[^a-z]+/g, " ")
        .trim();

// Kemiripan kata (Jaccard) antara dua keterangan
function similarity(a, b) {
    const A = new Set(normDesc(a).split(" ").filter((w) => w.length > 2));
    const B = new Set(normDesc(b).split(" ").filter((w) => w.length > 2));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter += 1;
    return inter / (A.size + B.size - inter);
}

function cleanRow(r, i) {
    const errors = [];
    const type = r?.type;
    if (type !== "income" && type !== "expense") errors.push("jenis harus pemasukan atau pengeluaran");
    const amount = Math.round(Number(r?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) errors.push("nominal harus lebih dari 0");
    else if (amount > 1e13) errors.push("nominal terlalu besar");
    let date = null;
    if (isKey(r?.date)) date = new Date(startOfKey(r.date).getTime() + 12 * 60 * 60 * 1000); // tengah hari WIB
    else if (r?.date && !Number.isNaN(Date.parse(r.date))) date = new Date(r.date);
    if (!date) errors.push("tanggal tidak terbaca");
    else if (date.getTime() > Date.now() + DAY) errors.push("tanggal di masa depan");
    else if (date.getFullYear() < 1990) errors.push("tanggal terlalu lama");
    const description = String(r?.description || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
    const categoryId = r?.categoryId && mongoose.isValidObjectId(r.categoryId) ? String(r.categoryId) : null;
    if (r?.categoryId && !categoryId) errors.push("kategori tidak valid");
    return { index: i, type, amount, date, description, categoryId, errors };
}

async function loadImportWallet(userId, walletId) {
    if (!walletId || !mongoose.isValidObjectId(walletId)) return { error: "Pilih wallet tujuan impor" };
    const wallet = await Wallet.findOne({ _id: walletId, user: userId });
    if (!wallet) return { error: "Wallet tidak ditemukan" };
    if (wallet.isArchived) return { error: "Wallet ini sudah diarsipkan" };
    if (wallet.type === "gold") return { error: "Mutasi tidak bisa diimpor ke wallet emas" };
    return { wallet };
}

// Tandai baris yang kemungkinan sudah pernah dicatat
function findDuplicates(rows, existing) {
    const byKey = new Map();
    for (const t of existing) {
        const k = `${dayKey(t.date)}|${t.type}|${Math.round(t.amount)}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(t);
    }
    const seen = new Map();
    const out = [];
    for (const r of rows) {
        if (r.errors.length) continue;
        const k = `${dayKey(r.date)}|${r.type}|${Math.round(r.amount)}`;
        // Toleransi ±1 hari: tanggal mutasi bank kadang beda dengan tanggal transaksi
        const near = [k, `${dayKey(r.date.getTime() - DAY)}|${r.type}|${Math.round(r.amount)}`, `${dayKey(r.date.getTime() + DAY)}|${r.type}|${Math.round(r.amount)}`]
            .flatMap((x) => byKey.get(x) || []);
        if (near.length) {
            const best = near
                .map((t) => ({ t, s: similarity(r.description, t.description), same: dayKey(t.date) === dayKey(r.date) }))
                .sort((a, b) => b.same - a.same || b.s - a.s)[0];
            const level = best.same && (best.s >= 0.34 || !r.description || !best.t.description) ? "exact" : "likely";
            out.push({
                index: r.index,
                level,
                match: { id: String(best.t._id), date: best.t.date, description: best.t.description || "", amount: best.t.amount },
            });
            continue;
        }
        const fk = `${k}|${normDesc(r.description)}`;
        if (seen.has(fk)) out.push({ index: r.index, level: "file", match: { index: seen.get(fk) } });
        else seen.set(fk, r.index);
    }
    return out;
}

const previewImport = async (req, res) => {
    try {
        const { walletId, rows } = req.body || {};
        if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ message: "Tidak ada baris untuk diperiksa" });
        if (rows.length > MAX_IMPORT) return res.status(400).json({ message: `Maksimal ${MAX_IMPORT} baris sekali impor` });
        const { wallet, error } = await loadImportWallet(req.user._id, walletId);
        if (error) return res.status(400).json({ message: error });

        const cleaned = rows.map(cleanRow);
        const valid = cleaned.filter((r) => !r.errors.length);
        let existing = [];
        if (valid.length) {
            const min = Math.min(...valid.map((r) => r.date.getTime())) - 2 * DAY;
            const max = Math.max(...valid.map((r) => r.date.getTime())) + 2 * DAY;
            existing = await Transaction.find({
                user: req.user._id,
                wallet: wallet._id,
                isDeleted: false,
                date: { $gte: new Date(min), $lte: new Date(max) },
            })
                .select("date amount type description")
                .lean();
        }
        res.json({
            duplicates: findDuplicates(cleaned, existing),
            invalid: cleaned.filter((r) => r.errors.length).map((r) => ({ index: r.index, errors: r.errors })),
            wallet: { id: String(wallet._id), name: wallet.name, balance: wallet.balance },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Sesuaikan "spent" budget untuk pengeluaran yang masuk/keluar (dibatasi minimal 0)
async function adjustBudgets(userId, rows, sign) {
    const groups = new Map();
    for (const r of rows) {
        if (r.type !== "expense" || !r.category) continue;
        const x = wib(r.date);
        const k = `${r.category}|${x.getUTCFullYear()}|${x.getUTCMonth() + 1}`;
        groups.set(k, (groups.get(k) || 0) + r.amount);
    }
    await Promise.all(
        [...groups].map(([k, total]) => {
            const [category, year, month] = k.split("|");
            return Budget.updateOne({ user: userId, category, year: Number(year), month: Number(month) }, [
                { $set: { spent: { $max: [0, { $add: [{ $ifNull: ["$spent", 0] }, sign * total] }] } } },
            ]);
        }),
    );
}

const importTransactions = async (req, res) => {
    const createdIds = [];
    try {
        const { walletId, rows, applyBalance = true } = req.body || {};
        if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ message: "Tidak ada baris untuk diimpor" });
        if (rows.length > MAX_IMPORT) return res.status(400).json({ message: `Maksimal ${MAX_IMPORT} baris sekali impor` });

        const { wallet, error } = await loadImportWallet(req.user._id, walletId);
        if (error) return res.status(400).json({ message: error });

        // 1) Validasi semua baris dulu
        const cleaned = rows.map(cleanRow);
        const catIds = [...new Set(cleaned.map((r) => r.categoryId).filter(Boolean))];
        if (catIds.length) {
            const cats = await Category.find({ _id: { $in: catIds }, $or: [{ user: req.user._id }, { user: null }] })
                .select("_id type")
                .lean();
            const byId = new Map(cats.map((c) => [String(c._id), c]));
            for (const r of cleaned) {
                if (!r.categoryId) continue;
                const c = byId.get(r.categoryId);
                if (!c) r.errors.push("kategori tidak ditemukan");
                else if (c.type && r.type && c.type !== r.type) r.errors.push("kategori tidak cocok dengan jenis transaksi");
            }
        }
        const bad = cleaned.filter((r) => r.errors.length);
        if (bad.length) {
            return res.status(400).json({
                message: `${bad.length} baris belum valid. Perbaiki dulu sebelum impor.`,
                errors: bad.slice(0, 20).map((r) => ({ index: r.index, message: r.errors.join(", ") })),
            });
        }

        const delta = cleaned.reduce((s, r) => s + (r.type === "income" ? r.amount : -r.amount), 0);
        const shouldApply = applyBalance !== false && applyBalance !== "false";
        if (shouldApply && (wallet.balance || 0) + delta < 0) {
            return res.status(400).json({
                message: `Saldo ${wallet.name} akan menjadi minus. Kalau mutasi ini sudah tercermin di saldo sekarang, pilih "Jangan ubah saldo wallet".`,
            });
        }

        // 2) Masukkan sekaligus (id dibuat di sini supaya bisa dibatalkan kalau gagal)
        const docs = cleaned.map((r) => {
            const _id = new mongoose.Types.ObjectId();
            createdIds.push(_id);
            return {
                _id,
                user: req.user._id,
                wallet: wallet._id,
                type: r.type,
                amount: r.amount,
                category: r.categoryId || null,
                description: r.description,
                date: r.date,
                tags: [IMPORT_TAG],
            };
        });
        await Transaction.insertMany(docs, { ordered: true });

        // 3) Saldo & budget
        let balance = wallet.balance;
        if (shouldApply && delta !== 0) {
            const updated = await Wallet.findOneAndUpdate(
                { _id: wallet._id, user: req.user._id },
                { $inc: { balance: delta } },
                { new: true },
            );
            balance = updated?.balance ?? balance + delta;
        }
        await adjustBudgets(
            req.user._id,
            docs.map((d) => ({ type: d.type, category: d.category, date: d.date, amount: d.amount })),
            1,
        );

        const income = cleaned.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
        res.status(201).json({
            created: docs.length,
            ids: createdIds.map(String),
            income,
            expense: income - delta,
            delta,
            balanceApplied: shouldApply,
            wallet: { id: String(wallet._id), name: wallet.name, balance },
        });
    } catch (error) {
        // Batalkan yang sudah sempat masuk
        if (createdIds.length) {
            await Transaction.deleteMany({ _id: { $in: createdIds }, user: req.user._id }).catch(() => {});
        }
        res.status(500).json({ message: `Impor dibatalkan: ${error.message}` });
    }
};

// Batalkan hasil impor (dipanggil dari layar "Selesai")
const undoImport = async (req, res) => {
    try {
        const { ids, revertBalance = true } = req.body || {};
        if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: "Tidak ada transaksi untuk dibatalkan" });
        const valid = ids.filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_IMPORT);
        const txs = await Transaction.find({
            _id: { $in: valid },
            user: req.user._id,
            isDeleted: false,
            tags: IMPORT_TAG,
            isTransfer: { $ne: true },
        })
            .select("wallet type amount category date")
            .lean();
        if (!txs.length) return res.status(404).json({ message: "Transaksi impor tidak ditemukan atau sudah dibatalkan" });

        await Transaction.updateMany({ _id: { $in: txs.map((t) => t._id) } }, { $set: { isDeleted: true } });
        if (revertBalance !== false && revertBalance !== "false") {
            const byWallet = new Map();
            for (const t of txs) {
                const k = String(t.wallet);
                byWallet.set(k, (byWallet.get(k) || 0) + (t.type === "income" ? -t.amount : t.amount));
            }
            await Promise.all(
                [...byWallet].map(([w, inc]) => Wallet.updateOne({ _id: w, user: req.user._id }, { $inc: { balance: inc } })),
            );
        }
        await adjustBudgets(req.user._id, txs, -1);
        res.json({ reverted: txs.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    exportTransactionsCsv,
    exportBackup,
    previewImport,
    importTransactions,
    undoImport,
    _internal: { toCsv, csvText, buildExportFilter, cleanRow, findDuplicates, similarity, kindLabel },
};
