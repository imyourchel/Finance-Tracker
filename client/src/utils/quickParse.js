/*
 * Pembaca "catat cepat": mengubah kalimat sehari-hari jadi transaksi.
 *   "kopi 18rb gopay kemarin"          → pengeluaran Rp18.000, wallet GoPay, kemarin
 *   "gaji 6,5jt bca"                   → pemasukan Rp6.500.000 ke BCA
 *   "topup gopay 100rb dari bca"       → transfer BCA → GoPay
 *   "parkir goceng; bensin 30rb #motor" → dua transaksi sekaligus
 */

const SLANG = {
    seceng: 1000,
    seribu: 1000,
    goceng: 5000,
    ceban: 10000,
    noban: 20000,
    goban: 50000,
    gocap: 50000,
    cepek: 100000,
    gopek: 500000,
    sejuta: 1000000,
    "setengah juta": 500000,
};

const UNIT = [
    [/^(rb|ribu|k|rebu)$/i, 1e3],
    [/^(jt|juta|jeti)$/i, 1e6],
    [/^(m|miliar|milyar)$/i, 1e9],
];

const INCOME_WORDS = [
    "gaji", "gajian", "salary", "terima", "diterima", "dapat", "dapet", "masuk", "bonus", "thr", "dibayar",
    "jual", "jualan", "cashback", "refund", "uang saku", "freelance", "honor", "komisi", "dividen", "bunga",
    "hadiah", "angpao", "kiriman",
];
const TRANSFER_WORDS = ["transfer", "tf", "trf", "pindah", "topup", "top up", "isi saldo", "tarik tunai", "setor tunai"];

// Kelompok kategori → kata kunci, dan pola nama kategori milik pengguna
const CATEGORY_HINTS = [
    {
        type: "expense",
        match: /makan|food|kuliner|minum|jajan/i,
        words: ["makan", "kopi", "ngopi", "sarapan", "lunch", "dinner", "nasi", "bakso", "mie", "mi ayam", "sate", "martabak", "warteg", "padang", "gofood", "grabfood", "shopeefood", "jajan", "snack", "teh", "boba", "roti", "pizza", "burger", "kfc", "mcd", "starbucks", "minum", "cafe", "kafe", "resto", "seblak", "ayam", "geprek", "gorengan", "es", "cilok", "siomay", "soto", "nasgor", "indomie"],
    },
    {
        type: "expense",
        match: /transport/i,
        words: ["ojek", "ojol", "gojek", "goride", "grab", "gocar", "grabcar", "bensin", "pertalite", "pertamax", "bbm", "parkir", "tol", "krl", "mrt", "lrt", "transjakarta", "busway", "kereta", "bus", "angkot", "taksi", "taxi", "pesawat", "maxim", "servis motor", "service motor"],
    },
    {
        type: "expense",
        match: /belanja|shopping/i,
        words: ["belanja", "shopee", "tokopedia", "tokped", "lazada", "baju", "celana", "sepatu", "indomaret", "alfamart", "supermarket", "sabun", "skincare", "sayur", "pasar", "detergen", "sampo"],
    },
    {
        type: "expense",
        match: /hiburan|entertain/i,
        words: ["nonton", "bioskop", "film", "game", "netflix", "spotify", "konser", "karaoke", "liburan", "main", "steam", "youtube premium", "disney"],
    },
    {
        type: "expense",
        match: /kesehatan|health/i,
        words: ["obat", "apotek", "dokter", "klinik", "rumah sakit", "vitamin", "gym", "checkup", "periksa"],
    },
    {
        type: "expense",
        match: /pendidikan|edu|sekolah/i,
        words: ["buku", "kursus", "kuliah", "spp", "ukt", "les", "sekolah", "udemy", "seminar", "fotokopi", "print"],
    },
    {
        type: "expense",
        match: /tagihan|bill|utilit/i,
        words: ["listrik", "pln", "token", "pdam", "internet", "wifi", "indihome", "biznet", "pulsa", "kuota", "paket data", "bpjs", "cicilan", "asuransi", "tagihan", "iuran"],
    },
    { type: "expense", match: /kos|sewa|rent/i, words: ["kos", "kost", "sewa", "kontrakan", "kontrak"] },
    { type: "income", match: /gaji|salary/i, words: ["gaji", "gajian", "salary", "thr"] },
    { type: "income", match: /freelance/i, words: ["freelance", "project", "proyek", "honor", "fee", "klien", "client"] },
    { type: "income", match: /investasi|invest/i, words: ["dividen", "bunga", "profit", "return"] },
];

const MOODS = {
    senang: "senang",
    happy: "senang",
    sedih: "sedih",
    biasa: "biasa",
    reward: "self_reward",
    selfreward: "self_reward",
    self_reward: "self_reward",
    terpaksa: "terpaksa",
    bangga: "bangga",
    bersalah: "bersalah",
    nyesel: "bersalah",
    menyesal: "bersalah",
};

const DAYS = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
const PARTS = { pagi: 8, siang: 12, sore: 16, malam: 20, malem: 20 };

const STOP = new Set([
    "di", "ke", "dari", "dan", "yang", "buat", "untuk", "utk", "pake", "pakai", "via", "beli", "bayar", "lagi",
    "sama", "sm", "aja", "ya", "tadi", "hari", "ini", "kemarin", "kmrn", "jam", "pukul", "tgl", "tanggal", "the",
]);

const norm = (s) =>
    String(s || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (text, phrase) => new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}([^a-z0-9]|$)`, "i").test(text);

export function tokenize(text) {
    return norm(text)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** Pelajari kata → kategori dari riwayat transaksi pengguna. */
export function learnFromHistory(transactions = []) {
    const map = {};
    for (const t of transactions) {
        if (t.isTransfer || t.goalId || !t.category) continue;
        const catId = t.category?._id || t.category;
        for (const w of new Set(tokenize(t.description))) {
            map[w] = map[w] || {};
            map[w][catId] = (map[w][catId] || 0) + 1;
        }
    }
    return map;
}

// ── Nominal ─────────────────────────────────────────────
function extractAmount(text) {
    let s = ` ${text} `;
    // slang (mis. "goceng")
    for (const [word, value] of Object.entries(SLANG).sort((a, b) => b[0].length - a[0].length)) {
        const re = new RegExp(`(^|\\s)(\\d+\\s*)?${escapeRe(word)}(?=\\s|$)`, "i");
        const m = s.match(re);
        if (m) {
            const mult = m[2] ? Number(m[2]) : 1;
            return { amount: value * mult, rest: s.replace(m[0], " ") };
        }
    }
    // angka + satuan: 18rb, 1,5jt, 2.5 juta, 18k
    const unitRe = /(^|\s)(rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|rebu|k|jt|juta|jeti|m|miliar|milyar)(?=\s|$|[^a-z])/i;
    let m = s.match(unitRe);
    if (m) {
        const num = Number(m[3].replace(",", "."));
        const mult = UNIT.find(([re]) => re.test(m[4]))?.[1] || 1;
        return { amount: Math.round(num * mult), rest: s.replace(m[0], " ") };
    }
    // angka biasa: 18.000 / 18000 / Rp 1.250.000 (titik = pemisah ribuan)
    const plainRe = /(^|\s)(rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,})(?:,\d{1,2})?(?=\s|$)/i;
    m = s.match(plainRe);
    if (m) return { amount: Number(m[3].replace(/\./g, "")), rest: s.replace(m[0], " ") };
    // angka kecil di depan kata "rupiah"
    m = s.match(/(^|\s)(\d+)\s*(rupiah|perak)(?=\s|$)/i);
    if (m) return { amount: Number(m[2]), rest: s.replace(m[0], " ") };
    return { amount: 0, rest: s };
}

// ── Tanggal & jam ───────────────────────────────────────
function extractDate(text, now) {
    let s = ` ${text} `;
    const d = new Date(now);
    let dateSet = false;
    let hour = null;
    let minute = 0;
    const take = (re, fn) => {
        const m = s.match(re);
        if (!m) return false;
        fn(m);
        s = s.replace(m[0], " ");
        return true;
    };

    take(/(^|\s)(kemarin\s+lusa|2\s*(hari|hr)\s*(yang\s*)?lalu)(?=\s|$)/i, () => {
        d.setDate(d.getDate() - 2);
        dateSet = true;
    }) ||
        take(/(^|\s)(\d{1,2})\s*(hari|hr)\s*(yang\s*)?lalu(?=\s|$)/i, (m) => {
            d.setDate(d.getDate() - Number(m[2]));
            dateSet = true;
        }) ||
        take(/(^|\s)(kemarin|kemaren|kmrn|kmarin)(?=\s|$)/i, () => {
            d.setDate(d.getDate() - 1);
            dateSet = true;
        }) ||
        take(/(^|\s)(minggu\s+lalu)(?=\s|$)/i, () => {
            d.setDate(d.getDate() - 7);
            dateSet = true;
        }) ||
        take(/(^|\s)(tgl|tanggal)\s*(\d{1,2})(?:\s*[/-]\s*(\d{1,2}))?(?=\s|$)/i, (m) => {
            setDayMonth(d, Number(m[3]), m[4] ? Number(m[4]) : null, now);
            dateSet = true;
        }) ||
        take(/(^|\s)(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?(?=\s|$)/, (m) => {
            setDayMonth(d, Number(m[2]), Number(m[3]), now, m[4] ? Number(m[4]) : null);
            dateSet = true;
        }) ||
        take(/(^|\s)(hari\s+ini|tadi|barusan)(?=\s|$)/i, () => {
            dateSet = true;
        });

    if (!dateSet) {
        const dayRe = new RegExp(`(^|\\s)(${Object.keys(DAYS).join("|")})(\\s+(kemarin|lalu))?(?=\\s|$)`, "i");
        take(dayRe, (m) => {
            const target = DAYS[m[2].toLowerCase()];
            let diff = (d.getDay() - target + 7) % 7;
            if (m[3] && diff === 0) diff = 7;
            d.setDate(d.getDate() - diff);
            dateSet = true;
        });
    }

    take(/(^|\s)(jam|pukul|pkl)\s*(\d{1,2})(?:[.:](\d{2}))?(\s*(pagi|siang|sore|malam|malem))?(?=\s|$)/i, (m) => {
        hour = Number(m[3]);
        minute = m[4] ? Number(m[4]) : 0;
        const part = m[6]?.toLowerCase();
        if (part && (part === "sore" || part.startsWith("mal")) && hour < 12) hour += 12;
        if (part === "siang" && hour < 11) hour += 12;
    }) ||
        take(/(^|\s)(pagi|siang|sore|malam|malem)(?=\s|$)/i, (m) => {
            hour = PARTS[m[2].toLowerCase()];
        });

    if (hour !== null) d.setHours(Math.min(hour, 23), Math.min(minute, 59), 0, 0);
    else if (dateSet && !sameDay(d, now)) d.setHours(12, 0, 0, 0);

    // Masa depan tidak masuk akal untuk catatan; mundurkan ke waktu sekarang
    if (d > now) d.setTime(now.getTime());
    return { date: d, rest: s, dateLabel: dateSet || hour !== null };
}

function setDayMonth(d, day, month, now, year = null) {
    const y = year ? (year < 100 ? 2000 + year : year) : now.getFullYear();
    const m = month ? month - 1 : now.getMonth();
    d.setFullYear(y, m, Math.min(day, 31));
    // tanggal tanpa bulan yang ternyata di masa depan → bulan lalu
    if (!month && d > now) d.setMonth(d.getMonth() - 1);
    if (month && !year && d > now) d.setFullYear(d.getFullYear() - 1);
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// ── Wallet ──────────────────────────────────────────────
const GENERIC_WALLET_WORDS = new Set(["bank", "wallet", "dompet", "rekening", "tabungan", "akun", "saldo", "kartu"]);
const WALLET_ALIASES = {
    cash: ["cash", "tunai", "dompet", "kas", "uang tunai"],
};

function findWallets(text, wallets) {
    const t = norm(text);
    const hits = [];
    for (const w of wallets) {
        const names = [norm(w.name)];
        if (w.type === "cash") names.push(...WALLET_ALIASES.cash);
        // "Bank Jago" juga cocok dengan "jago"; kata umum seperti "bank" diabaikan
        const parts = norm(w.name).split(/\s+/).filter((x) => x.length >= 3 && !GENERIC_WALLET_WORDS.has(x));
        if (parts.length > 1 || (parts.length === 1 && parts[0] !== norm(w.name))) names.push(...parts);
        for (const n of names) {
            if (!n) continue;
            const re = new RegExp(`(^|[^a-z0-9])${escapeRe(n)}([^a-z0-9]|$)`, "i");
            const m = t.match(re);
            if (m) {
                hits.push({ wallet: w, index: m.index, phrase: n });
                break;
            }
        }
    }
    return hits.sort((a, b) => a.index - b.index);
}

function stripPhrase(s, phrase) {
    return s.replace(new RegExp(`(^|[^a-z0-9])(dari|ke|pakai|pake|via|pakek)?\\s*${escapeRe(phrase)}(?=[^a-z0-9]|$)`, "i"), " ");
}

// ── Kategori ────────────────────────────────────────────
function guessCategory(text, type, categories, learned) {
    const pool = categories.filter((c) => !c.type || c.type === type);
    if (!pool.length) return null;
    const words = tokenize(text);

    // 1) dari kebiasaan pengguna
    const score = {};
    for (const w of words) {
        for (const [catId, n] of Object.entries(learned?.[w] || {})) {
            if (pool.some((c) => String(c._id) === String(catId))) score[catId] = (score[catId] || 0) + n;
        }
    }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    if (best) return { id: best[0], source: "learned" };

    // 2) nama kategori disebut langsung
    const lower = norm(text);
    const direct = pool.find((c) => hasPhrase(lower, norm(c.name)));
    if (direct) return { id: direct._id, source: "name" };

    // 3) kamus kata kunci
    for (const h of CATEGORY_HINTS) {
        if (h.type !== type) continue;
        if (h.words.some((w) => hasPhrase(lower, w))) {
            const cat = pool.find((c) => h.match.test(c.name));
            if (cat) return { id: cat._id, source: "keyword" };
        }
    }

    // 4) cadangan: "Lainnya"
    const other = pool.find((c) => /lain/i.test(c.name));
    return other ? { id: other._id, source: "fallback" } : null;
}

/** Tebak kategori untuk satu keterangan (dipakai impor mutasi). → { id, source } | null */
export function guessCategoryFor(text, type, categories = [], learned = {}) {
    return guessCategory(String(text || ""), type, categories, learned);
}

// ── Utama ───────────────────────────────────────────────
export function parseQuickOne(raw, { wallets = [], categories = [], learned = {}, now = new Date() } = {}) {
    let text = ` ${raw.trim()} `;
    const issues = [];

    // tag & mood
    const tags = [];
    text = text.replace(/#([\p{L}\d_-]+)/gu, (_, t) => {
        tags.push(t.toLowerCase());
        return " ";
    });
    let mood = null;
    text = text.replace(/@([\p{L}_]+)/gu, (m, t) => {
        const key = MOODS[t.toLowerCase()];
        if (key) {
            mood = key;
            return " ";
        }
        return m;
    });

    const amt = extractAmount(text);
    text = amt.rest;
    const dt = extractDate(text, now);
    text = dt.rest;

    const lower = norm(text);
    const transferWord = TRANSFER_WORDS.find((w) => hasPhrase(lower, w));
    const walletHits = findWallets(text, wallets.filter((w) => !w.isArchived));

    let type = INCOME_WORDS.some((w) => hasPhrase(lower, w)) ? "income" : "expense";
    let walletId = null;
    let transferTo = null;

    // Transfer: "dari A ke B", "topup B dari A", "tf ke B"
    const fromM = lower.match(/dari\s+([a-z0-9 ]+?)(?=\s+ke\s|\s*$)/);
    const toM = lower.match(/(?:^|\s)ke\s+([a-z0-9 ]+?)(?=\s+dari\s|\s*$)/);
    const byPhrase = (frag) => frag && walletHits.find((h) => frag.trim().startsWith(h.phrase))?.wallet;
    const fromW = byPhrase(fromM?.[1]);
    const toW = byPhrase(toM?.[1]);

    if (transferWord || (fromW && toW) || (walletHits.length >= 2 && (fromW || toW))) {
        let src = fromW;
        let dst = toW;
        if (!dst && transferWord && /top ?up|isi saldo/.test(transferWord)) dst = walletHits.find((h) => h.wallet !== src)?.wallet;
        if (!src) src = walletHits.find((h) => h.wallet !== dst)?.wallet || wallets.find((w) => w.isDefault) || null;
        if (!dst) dst = walletHits.find((h) => h.wallet !== src)?.wallet || null;
        if (src && dst && src._id !== dst._id) {
            type = "transfer";
            walletId = src._id;
            transferTo = dst._id;
        }
    }
    if (type !== "transfer") {
        const hit = walletHits[0]?.wallet;
        walletId = hit?._id || wallets.find((w) => w.isDefault && w.type !== "gold")?._id || wallets.find((w) => w.type !== "gold")?._id || null;
    }

    // Bersihkan kata wallet & kata transfer dari keterangan
    let desc = text;
    for (const h of walletHits) desc = stripPhrase(norm(desc), h.phrase);
    if (transferWord && type === "transfer") desc = desc.replace(new RegExp(escapeRe(transferWord), "i"), " ");
    desc = desc
        .replace(/(^|\s)(rp\.?|di|pakai|pake|via|dari|ke|buat|untuk|utk)(?=\s|$)/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    const description = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : "";

    let categoryId = null;
    let categorySource = null;
    if (type !== "transfer") {
        const g = guessCategory(`${raw}`, type, categories, learned);
        categoryId = g?.id || null;
        categorySource = g?.source || null;
        if (!categoryId) issues.push("Kategori belum dikenali");
    }
    if (!amt.amount) issues.push("Nominal belum terbaca");
    if (!walletId) issues.push("Wallet belum dipilih");

    return {
        raw: raw.trim(),
        type,
        amount: amt.amount,
        walletId,
        transferTo,
        categoryId,
        categorySource,
        description,
        date: dt.date,
        dateMentioned: dt.dateLabel,
        tags,
        mood,
        issues,
        ok: issues.length === 0 || (issues.length === 1 && issues[0] === "Kategori belum dikenali" && type === "transfer"),
    };
}

/** Bisa beberapa transaksi sekaligus, dipisah ";" atau baris baru. */
export function parseQuick(text, ctx) {
    return String(text || "")
        .split(/[;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => parseQuickOne(p, ctx));
}
