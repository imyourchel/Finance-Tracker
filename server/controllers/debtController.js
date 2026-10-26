const mongoose = require("mongoose");
const Debt = require("../models/Debt");
const SplitBill = require("../models/SplitBill");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");

/*
 * Utang-piutang & patungan
 * ────────────────────────
 * - owed_to_me (piutang): orang lain berutang ke aku.
 * - i_owe (utang): aku berutang ke orang lain.
 * - Kalau wallet dipilih, perpindahan uangnya dicatat sebagai transaksi ber-debtId
 *   dan saldo wallet ikut berubah. Baris ber-debtId bukan pemasukan/pengeluaran
 *   sungguhan (cuma uang dipinjam/dikembalikan), jadi statistik harus
 *   mengecualikannya, sama seperti baris ber-goalId.
 * - Patungan: aku bayar total tagihan. Bagianku = pengeluaran biasa,
 *   bagian tiap peserta = piutang baru.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });

const toAmount = (v) => {
    if (typeof v === "number") return Math.round(v);
    const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
};
const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 60);
const keyOf = (name) => cleanName(name).toLowerCase();

// "YYYY-MM-DD" dibaca sebagai tanggal WIB. endOfDay untuk jatuh tempo.
const toDate = (v, endOfDay = false) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
        return new Date(`${v}T${endOfDay ? "23:59:59" : "12:00:00"}+07:00`);
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

// ── Wallet & transaksi ──────────────────────────────────────────────
async function findWallet(userId, walletId) {
    if (!walletId) return null;
    if (!mongoose.isValidObjectId(walletId)) throw fail(400, "Wallet tidak valid.");
    const wallet = await Wallet.findOne({ _id: walletId, user: userId, isArchived: { $ne: true } });
    if (!wallet) throw fail(404, "Wallet tidak ditemukan.");
    if (wallet.type === "gold") throw fail(400, "Wallet emas tidak bisa dipakai untuk utang-piutang.");
    return wallet;
}

/** Pindahkan uang lewat wallet: buat transaksi ber-debtId dan ubah saldo. */
async function moveMoney({ userId, wallet, type, amount, date, description, debtId }) {
    if (type === "expense" && (wallet.balance || 0) < amount) {
        throw fail(400, `Saldo ${wallet.name} tidak cukup (${rupiah(wallet.balance)}).`);
    }
    const tx = await Transaction.create({
        user: userId,
        wallet: wallet._id,
        type,
        amount,
        category: null,
        description,
        date: date || new Date(),
        debtId,
    });
    wallet.balance = (wallet.balance || 0) + (type === "income" ? amount : -amount);
    await wallet.save();
    return tx;
}

/** Batalkan transaksi (soft delete) dan kembalikan saldo wallet. */
async function reverseTx(userId, txId) {
    if (!txId) return;
    const tx = await Transaction.findOne({ _id: txId, user: userId, isDeleted: false });
    if (!tx) return;
    tx.isDeleted = true;
    await tx.save();
    const wallet = await Wallet.findOne({ _id: tx.wallet, user: userId });
    if (wallet) {
        wallet.balance = (wallet.balance || 0) + (tx.type === "income" ? -tx.amount : tx.amount);
        await wallet.save();
    }
}

// ── Bentuk data untuk klien ─────────────────────────────────────────
function serializeDebt(d, walletNames = {}, now = new Date()) {
    const remaining = Math.max(0, d.amount - (d.paid || 0));
    const due = d.dueDate ? new Date(d.dueDate) : null;
    const open = d.status === "open";
    return {
        _id: String(d._id),
        direction: d.direction,
        person: d.person,
        personKey: d.personKey,
        amount: d.amount,
        paid: d.paid || 0,
        remaining,
        progress: d.amount ? Math.min(1, (d.paid || 0) / d.amount) : 0,
        note: d.note || "",
        date: d.date,
        dueDate: d.dueDate,
        daysToDue: open && due ? Math.ceil((due.getTime() - now.getTime()) / DAY_MS) : null,
        overdue: Boolean(open && due && due < now),
        wallet: d.wallet ? { _id: String(d.wallet), name: walletNames[String(d.wallet)] || "Wallet" } : null,
        splitBill: d.splitBill ? String(d.splitBill) : null,
        status: d.status,
        settledAt: d.settledAt,
        createdAt: d.createdAt,
        payments: (d.payments || [])
            .map((p) => ({
                _id: String(p._id),
                amount: p.amount,
                date: p.date,
                note: p.note || "",
                wallet: p.wallet ? { _id: String(p.wallet), name: walletNames[String(p.wallet)] || "Wallet" } : null,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
}

function buildSummary(debts) {
    const open = debts.filter((d) => d.status === "open");
    const owedToMe = open.filter((d) => d.direction === "owed_to_me").reduce((s, d) => s + d.remaining, 0);
    const iOwe = open.filter((d) => d.direction === "i_owe").reduce((s, d) => s + d.remaining, 0);

    const people = {};
    for (const d of open) {
        const p = (people[d.personKey] = people[d.personKey] || {
            key: d.personKey,
            name: d.person,
            owedToMe: 0,
            iOwe: 0,
            count: 0,
            overdue: 0,
            nearestDue: null,
            lastDate: null,
        });
        if (d.direction === "owed_to_me") p.owedToMe += d.remaining;
        else p.iOwe += d.remaining;
        p.count += 1;
        if (d.overdue) p.overdue += 1;
        if (d.dueDate && (!p.nearestDue || new Date(d.dueDate) < new Date(p.nearestDue))) p.nearestDue = d.dueDate;
        if (!p.lastDate || new Date(d.date) > new Date(p.lastDate)) {
            p.lastDate = d.date;
            p.name = d.person; // tulisan nama terbaru
        }
    }
    const list = Object.values(people)
        .map((p) => ({ ...p, net: p.owedToMe - p.iOwe }))
        .sort((a, b) => b.overdue - a.overdue || Math.abs(b.net) - Math.abs(a.net));

    const withDue = open.filter((d) => d.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return {
        owedToMe,
        iOwe,
        net: owedToMe - iOwe,
        openCount: open.length,
        settledCount: debts.length - open.length,
        overdueCount: open.filter((d) => d.overdue).length,
        dueSoonCount: open.filter((d) => !d.overdue && d.daysToDue !== null && d.daysToDue <= 7).length,
        nextDue: withDue.find((d) => !d.overdue) || null,
        people: list,
    };
}

async function loadAll(userId) {
    const [debts, splits, wallets] = await Promise.all([
        Debt.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        SplitBill.find({ user: userId }).sort({ date: -1, createdAt: -1 }).lean(),
        Wallet.find({ user: userId }).select("name").lean(),
    ]);
    const walletNames = Object.fromEntries(wallets.map((w) => [String(w._id), w.name]));
    const now = new Date();
    const items = debts.map((d) => serializeDebt(d, walletNames, now));
    const byId = Object.fromEntries(items.map((d) => [d._id, d]));

    items.sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        if (a.status === "open") {
            if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
            const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            if (ad !== bd) return ad - bd;
            return new Date(b.date) - new Date(a.date);
        }
        return new Date(b.settledAt || b.date) - new Date(a.settledAt || a.date);
    });

    const splitList = splits.map((s) => {
        const participants = s.participants.map((p) => {
            const d = p.debt ? byId[String(p.debt)] : null;
            return {
                _id: String(p._id),
                name: p.name,
                share: p.share,
                debtId: d?._id || null,
                paid: d ? d.paid : p.share,
                remaining: d ? d.remaining : 0,
                status: d ? d.status : "settled",
            };
        });
        const others = participants.reduce((sum, p) => sum + p.share, 0);
        const collected = participants.reduce((sum, p) => sum + Math.min(p.share, p.paid), 0);
        return {
            _id: String(s._id),
            title: s.title,
            total: s.total,
            date: s.date,
            dueDate: s.dueDate,
            mode: s.mode,
            includeMe: s.includeMe,
            myShare: s.myShare,
            note: s.note || "",
            wallet: s.wallet ? { _id: String(s.wallet), name: walletNames[String(s.wallet)] || "Wallet" } : null,
            participants,
            others,
            collected,
            outstanding: others - collected,
            done: participants.every((p) => p.status === "settled"),
        };
    });

    return { debts: items, splits: splitList, summary: buildSummary(items) };
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// ── Handler ─────────────────────────────────────────────────────────
const getDebts = handle(async (req, res) => {
    res.json(await loadAll(req.user._id));
});

const createDebt = handle(async (req, res) => {
    const userId = req.user._id;
    const { direction, person, amount, note, date, dueDate, walletId } = req.body || {};
    if (!["owed_to_me", "i_owe"].includes(direction)) throw fail(400, "Pilih jenis: utang atau piutang.");
    const name = cleanName(person);
    if (!name) throw fail(400, "Nama orang wajib diisi.");
    const value = toAmount(amount);
    if (value < 1) throw fail(400, "Nominal harus lebih dari 0.");
    const when = toDate(date) || new Date();
    const due = toDate(dueDate, true);
    if (due && due < new Date(when.getTime() - DAY_MS)) throw fail(400, "Jatuh tempo tidak boleh sebelum tanggal catatan.");
    const wallet = await findWallet(userId, walletId);

    const debt = new Debt({
        user: userId,
        direction,
        person: name,
        personKey: keyOf(name),
        amount: value,
        note: String(note || "").trim().slice(0, 300),
        date: when,
        dueDate: due,
        wallet: wallet?._id || null,
    });

    if (wallet) {
        // Piutang: aku meminjamkan uang → keluar dari wallet. Utang: aku menerima pinjaman → masuk.
        const tx = await moveMoney({
            userId,
            wallet,
            type: direction === "owed_to_me" ? "expense" : "income",
            amount: value,
            date: when,
            description: direction === "owed_to_me" ? `Dipinjamkan ke ${name}` : `Pinjaman dari ${name}`,
            debtId: debt._id,
        });
        debt.openingTransaction = tx._id;
    }
    await debt.save();
    res.status(201).json(await loadAll(userId));
});

const updateDebt = handle(async (req, res) => {
    const userId = req.user._id;
    const debt = await Debt.findOne({ _id: req.params.id, user: userId });
    if (!debt) throw fail(404, "Catatan tidak ditemukan.");
    const { person, amount, note, dueDate } = req.body || {};

    if (person !== undefined) {
        const name = cleanName(person);
        if (!name) throw fail(400, "Nama orang wajib diisi.");
        debt.person = name;
        debt.personKey = keyOf(name);
    }
    if (note !== undefined) debt.note = String(note || "").trim().slice(0, 300);
    if (dueDate !== undefined) debt.dueDate = toDate(dueDate, true);
    if (amount !== undefined) {
        const value = toAmount(amount);
        if (value < 1) throw fail(400, "Nominal harus lebih dari 0.");
        if (debt.splitBill && value !== debt.amount) throw fail(400, "Nominal bagian patungan tidak bisa diubah di sini.");
        if (debt.openingTransaction && value !== debt.amount)
            throw fail(400, "Nominal yang sudah tercatat di wallet tidak bisa diubah. Hapus lalu catat ulang.");
        if (value < debt.paid) throw fail(400, `Nominal tidak boleh kurang dari yang sudah dibayar (${rupiah(debt.paid)}).`);
        debt.amount = value;
    }
    const settled = debt.paid >= debt.amount;
    debt.status = settled ? "settled" : "open";
    debt.settledAt = settled ? debt.settledAt || new Date() : null;
    await debt.save();
    res.json(await loadAll(userId));
});

const deleteDebt = handle(async (req, res) => {
    const userId = req.user._id;
    const debt = await Debt.findOne({ _id: req.params.id, user: userId });
    if (!debt) throw fail(404, "Catatan tidak ditemukan.");
    if (debt.splitBill) throw fail(400, "Catatan ini bagian dari patungan. Hapus patungannya, atau tandai lunas.");
    for (const p of debt.payments) await reverseTx(userId, p.transaction);
    await reverseTx(userId, debt.openingTransaction);
    await Debt.deleteOne({ _id: debt._id });
    res.json(await loadAll(userId));
});

const addPayment = handle(async (req, res) => {
    const userId = req.user._id;
    const debt = await Debt.findOne({ _id: req.params.id, user: userId });
    if (!debt) throw fail(404, "Catatan tidak ditemukan.");
    if (debt.status === "settled") throw fail(400, "Catatan ini sudah lunas.");
    const remaining = debt.amount - debt.paid;
    const value = toAmount(req.body?.amount);
    if (value < 1) throw fail(400, "Nominal pembayaran harus lebih dari 0.");
    if (value > remaining) throw fail(400, `Melebihi sisa ${rupiah(remaining)}.`);
    const when = toDate(req.body?.date) || new Date();
    const wallet = await findWallet(userId, req.body?.walletId);
    const full = value === remaining;

    const payment = debt.payments.create({
        amount: value,
        date: when,
        wallet: wallet?._id || null,
        note: String(req.body?.note || "").trim().slice(0, 200),
    });
    if (wallet) {
        const tx = await moveMoney({
            userId,
            wallet,
            // Piutang dibayar → uang masuk. Utang kubayar → uang keluar.
            type: debt.direction === "owed_to_me" ? "income" : "expense",
            amount: value,
            date: when,
            description:
                debt.direction === "owed_to_me"
                    ? `${full ? "Pelunasan" : "Cicilan"} dari ${debt.person}`
                    : `${full ? "Pelunasan" : "Cicilan"} utang ke ${debt.person}`,
            debtId: debt._id,
        });
        payment.transaction = tx._id;
    }
    debt.payments.push(payment);
    debt.paid += value;
    if (debt.paid >= debt.amount) {
        debt.status = "settled";
        debt.settledAt = new Date();
    }
    await debt.save();
    res.status(201).json(await loadAll(userId));
});

const deletePayment = handle(async (req, res) => {
    const userId = req.user._id;
    const debt = await Debt.findOne({ _id: req.params.id, user: userId });
    if (!debt) throw fail(404, "Catatan tidak ditemukan.");
    const payment = debt.payments.id(req.params.paymentId);
    if (!payment) throw fail(404, "Pembayaran tidak ditemukan.");
    await reverseTx(userId, payment.transaction);
    debt.paid = Math.max(0, debt.paid - payment.amount);
    payment.deleteOne();
    debt.status = debt.paid >= debt.amount ? "settled" : "open";
    if (debt.status === "open") debt.settledAt = null;
    await debt.save();
    res.json(await loadAll(userId));
});

/** Hitung pembagian patungan. Dipisah supaya mudah diuji. */
function computeShares({ total, mode, includeMe, participants }) {
    const people = participants.map((p) => ({ name: cleanName(p.name), share: toAmount(p.share) }));
    if (!people.length) throw fail(400, "Tambahkan minimal satu teman.");
    if (people.some((p) => !p.name)) throw fail(400, "Nama setiap peserta wajib diisi.");
    const keys = people.map((p) => keyOf(p.name));
    if (new Set(keys).size !== keys.length) throw fail(400, "Ada nama peserta yang sama.");

    if (mode === "custom") {
        const sum = people.reduce((s, p) => s + p.share, 0);
        if (includeMe) {
            if (sum > total) throw fail(400, `Jumlah bagian teman (${rupiah(sum)}) melebihi total.`);
            return { people, myShare: total - sum };
        }
        if (sum !== total) throw fail(400, `Jumlah bagian (${rupiah(sum)}) harus sama dengan total (${rupiah(total)}).`);
        return { people, myShare: 0 };
    }

    const n = people.length + (includeMe ? 1 : 0);
    const base = Math.floor(total / n);
    let rest = total - base * n;
    let myShare = includeMe ? base : 0;
    // Sisa pembulatan ditanggung aku (kalau ikut), kalau tidak dibagi ke peserta pertama
    if (includeMe) {
        myShare += rest;
        rest = 0;
    }
    const shares = people.map((p) => {
        const extra = rest > 0 ? 1 : 0;
        rest -= extra;
        return { name: p.name, share: base + extra };
    });
    return { people: shares, myShare };
}

const createSplit = handle(async (req, res) => {
    const userId = req.user._id;
    const { title, total, date, dueDate, walletId, categoryId, mode = "equal", includeMe = true, participants = [], note } =
        req.body || {};
    const name = String(title || "").trim().slice(0, 80);
    if (!name) throw fail(400, "Nama patungan wajib diisi.");
    const sum = toAmount(total);
    if (sum < 1) throw fail(400, "Total tagihan harus lebih dari 0.");
    const { people, myShare } = computeShares({ total: sum, mode, includeMe: Boolean(includeMe), participants });
    const when = toDate(date) || new Date();
    const due = toDate(dueDate, true);
    const wallet = await findWallet(userId, walletId);
    if (wallet && (wallet.balance || 0) < sum) throw fail(400, `Saldo ${wallet.name} tidak cukup (${rupiah(wallet.balance)}).`);

    const split = new SplitBill({
        user: userId,
        title: name,
        total: sum,
        date: when,
        dueDate: due,
        mode: mode === "custom" ? "custom" : "equal",
        includeMe: Boolean(includeMe),
        myShare,
        wallet: wallet?._id || null,
        category: categoryId && mongoose.isValidObjectId(categoryId) ? categoryId : null,
        note: String(note || "").trim().slice(0, 300),
        participants: [],
    });

    if (wallet && myShare > 0) {
        // Bagianku sendiri = pengeluaran sungguhan (boleh berkategori)
        const tx = await Transaction.create({
            user: userId,
            wallet: wallet._id,
            type: "expense",
            amount: myShare,
            category: split.category,
            description: `Patungan ${name} (bagianku)`,
            date: when,
        });
        wallet.balance = (wallet.balance || 0) - myShare;
        await wallet.save();
        split.myTransaction = tx._id;
    }

    for (const p of people) {
        const entry = { name: p.name, share: p.share, debt: null };
        if (p.share > 0) {
            const debt = new Debt({
                user: userId,
                direction: "owed_to_me",
                person: p.name,
                personKey: keyOf(p.name),
                amount: p.share,
                note: `Patungan ${name}`,
                date: when,
                dueDate: due,
                wallet: wallet?._id || null,
                splitBill: split._id,
            });
            if (wallet) {
                const tx = await moveMoney({
                    userId,
                    wallet,
                    type: "expense",
                    amount: p.share,
                    date: when,
                    description: `Patungan ${name} (bagian ${p.name})`,
                    debtId: debt._id,
                });
                debt.openingTransaction = tx._id;
            }
            await debt.save();
            entry.debt = debt._id;
        }
        split.participants.push(entry);
    }
    await split.save();
    res.status(201).json(await loadAll(userId));
});

const deleteSplit = handle(async (req, res) => {
    const userId = req.user._id;
    const split = await SplitBill.findOne({ _id: req.params.id, user: userId });
    if (!split) throw fail(404, "Patungan tidak ditemukan.");
    const debts = await Debt.find({ user: userId, splitBill: split._id });
    for (const d of debts) {
        for (const p of d.payments) await reverseTx(userId, p.transaction);
        await reverseTx(userId, d.openingTransaction);
    }
    await Debt.deleteMany({ user: userId, splitBill: split._id });
    await reverseTx(userId, split.myTransaction);
    await SplitBill.deleteOne({ _id: split._id });
    res.json(await loadAll(userId));
});

module.exports = {
    getDebts,
    createDebt,
    updateDebt,
    deleteDebt,
    addPayment,
    deletePayment,
    createSplit,
    deleteSplit,
    _internal: { computeShares, buildSummary, serializeDebt, toDate, toAmount },
};
