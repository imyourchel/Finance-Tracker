/*
 * Pembaca CSV mutasi rekening
 * ───────────────────────────
 * - parseCsv: CSV/TSV dengan kutip, BOM, baris baru di dalam sel.
 * - detectLayout: cari baris judul (melewati baris info rekening di atasnya),
 *   tebak bank & kolom.
 * - parseAmountId / parseDateId: format angka & tanggal ala Indonesia.
 * - buildRows: ubah baris mentah jadi kandidat transaksi sesuai pemetaan kolom.
 */

const DELIMS = [";", ",", "\t", "|"];

/** Hitung kemunculan pemisah di luar tanda kutip. */
function countOutsideQuotes(line, d) {
    let n = 0;
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (c === '"') q = !q;
        else if (c === d && !q) n += 1;
    }
    return n;
}

export function detectDelimiter(text) {
    const lines = text
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .slice(0, 40);
    let best = ",";
    let bestScore = -1;
    for (const d of DELIMS) {
        const counts = lines.map((l) => countOutsideQuotes(l, d)).filter((n) => n > 0);
        if (!counts.length) continue;
        // pemisah yang paling sering muncul dengan jumlah kolom konsisten
        const freq = {};
        for (const n of counts) freq[n] = (freq[n] || 0) + 1;
        const [mode, times] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        const score = times * 10 + Number(mode);
        if (score > bestScore) {
            bestScore = score;
            best = d;
        }
    }
    return best;
}

/** CSV → array baris (array string). */
export function parseCsv(input, delimiter) {
    const text = String(input || "").replace(/^\uFEFF/, "");
    const d = delimiter || detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        if (q) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else q = false;
            } else cell += c;
        } else if (c === '"' && cell.trim() === "") {
            q = true;
            cell = "";
        } else if (c === d) {
            row.push(cell);
            cell = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else cell += c;
    }
    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return {
        delimiter: d,
        rows: rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== "")),
    };
}

// ── Angka ────────────────────────────────────────────────────────────
/**
 * "1.250.000,00" · "1,250,000.00" · "Rp 54.000" · "-54.000" · "(54.000)" · "54,000.00 DB"
 * → { value: 1250000, sign: 1 | -1 | 0, flag: "DB" | "CR" | null }
 */
export function parseAmountId(raw) {
    let s = String(raw ?? "").trim();
    if (!s) return { value: 0, sign: 0, flag: null };
    let sign = 0;
    let flag = null;
    const up = s.toUpperCase();
    const flagM = up.match(/\b(DB|CR|DR|D|K|DEBET|DEBIT|KREDIT|CREDIT)\.?\s*$/);
    if (flagM) {
        flag = /^(DB|DR|D|DEBET|DEBIT)$/.test(flagM[1]) ? "DB" : "CR";
        s = s.slice(0, flagM.index).trim();
    }
    s = s.replace(/^'+/, "").replace(/rp\.?/i, "").replace(/idr/i, "").replace(/\s+/g, "");
    if (/^\(.*\)$/.test(s)) {
        sign = -1;
        s = s.slice(1, -1);
    }
    if (s.startsWith("-")) {
        sign = -1;
        s = s.slice(1);
    } else if (s.startsWith("+")) {
        sign = 1;
        s = s.slice(1);
    } else if (s.endsWith("-")) {
        sign = -1;
        s = s.slice(0, -1);
    }
    if (!/^[\d.,]+$/.test(s)) return { value: 0, sign: 0, flag };

    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    let num;
    if (lastDot >= 0 && lastComma >= 0) {
        // keduanya ada: yang terakhir adalah desimal
        const dec = lastDot > lastComma ? "." : ",";
        const th = dec === "." ? "," : ".";
        num = Number(s.split(th).join("").replace(dec, "."));
    } else if (lastDot >= 0 || lastComma >= 0) {
        const sep = lastDot >= 0 ? "." : ",";
        const parts = s.split(sep);
        const tail = parts[parts.length - 1];
        // 54.000 / 1.250.000 → ribuan; 54,5 / 54,50 → desimal
        if (parts.length > 2 || tail.length === 3) num = Number(parts.join(""));
        else num = Number(`${parts.slice(0, -1).join("")}.${tail}`);
    } else num = Number(s);

    if (!Number.isFinite(num)) return { value: 0, sign: 0, flag };
    if (!sign && flag) sign = flag === "DB" ? -1 : 1;
    return { value: Math.round(num * 100) / 100, sign, flag };
}

// ── Tanggal ──────────────────────────────────────────────────────────
const MONTHS = {
    jan: 1, januari: 1, january: 1,
    feb: 2, februari: 2, february: 2, peb: 2,
    mar: 3, maret: 3, march: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7,
    agu: 8, agt: 8, ags: 8, agus: 8, agustus: 8, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    okt: 10, oct: 10, oktober: 10, october: 10,
    nov: 11, nop: 11, november: 11, nopember: 11,
    des: 12, dec: 12, desember: 12, december: 12,
};

const ymd = (y, m, d) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null; // 31/02 dsb.
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const fullYear = (y) => (y < 100 ? 2000 + y : y);

/**
 * "05/10/2026" · "05-10-26" · "2026-10-05" · "05/10" · "01 Okt 2026" · "01-Oct-26" · "Oct 1, 2026"
 * → "YYYY-MM-DD" atau null. Tanpa tahun → yearHint, mundur setahun kalau jatuh di masa depan.
 */
export function parseDateId(raw, { yearHint, today = new Date() } = {}) {
    let s = String(raw ?? "")
        .trim()
        .replace(/^'+/, "")
        .toLowerCase();
    if (!s) return null;
    s = s.replace(/[,]/g, " ").replace(/\s+/g, " ");
    // buang jam di belakang
    s = s.replace(/[ t]\d{1,2}[:.]\d{2}([:.]\d{2})?( ?(wib|am|pm))?$/, "").trim();

    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

    m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
    if (m) {
        let d = Number(m[1]);
        let mo = Number(m[2]);
        if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // format bulan/tanggal
        if (m[3]) return ymd(fullYear(Number(m[3])), mo, d);
        return withoutYear(d, mo, yearHint, today);
    }

    m = s.match(/^(\d{1,2})[ \-/.]([a-z]+)\.?(?:[ \-/.](\d{2,4}))?$/);
    if (m && MONTHS[m[2]]) {
        const d = Number(m[1]);
        const mo = MONTHS[m[2]];
        if (m[3]) return ymd(fullYear(Number(m[3])), mo, d);
        return withoutYear(d, mo, yearHint, today);
    }

    m = s.match(/^([a-z]+)\.? (\d{1,2}) (\d{4})$/);
    if (m && MONTHS[m[1]]) return ymd(Number(m[3]), MONTHS[m[1]], Number(m[2]));
    return null;
}

function withoutYear(d, mo, yearHint, today) {
    const y = yearHint || today.getFullYear();
    const out = ymd(y, mo, d);
    if (!out || yearHint) return out;
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return out > todayKey ? ymd(y - 1, mo, d) : out;
}

// ── Deteksi bank & kolom ─────────────────────────────────────────────
const RE = {
    date: /tanggal|tgl|date|waktu|posting|trx date|transaction date/i,
    desc: /keterangan|uraian|deskripsi|description|remark|detail|catatan|berita|source|destination|merchant|penerima|notes?/i,
    debit: /debe?t|debit|dana keluar|uang keluar|withdraw|pengeluaran|\bout(going)?\b|^db$/i,
    credit: /kredit|credit|dana masuk|uang masuk|deposit|pemasukan|\bin(coming)?\b|^cr$/i,
    amount: /jumlah|nominal|amount|mutasi|nilai|total/i,
    flag: /db\s*\/\s*cr|cr\s*\/\s*db|d\s*\/\s*k|^dk$|^tipe|^type|^jenis|^d\/c$/i,
    ignore: /saldo|balance|cabang|branch|teller|^no\.?$|nomor|reference|referensi|kode|^id$/i,
};

const BANKS = [
    { id: "dailytrack", name: "Template DailyTrack", test: (h) => h.includes("tanggal") && h.includes("jenis") && h.includes("nominal") && h.includes("keterangan") },
    { id: "bca", name: "BCA", test: (h) => h.includes("cabang") && (h.includes("jumlah") || h.includes("mutasi")) },
    { id: "bri", name: "BRI", test: (h) => h.includes("teller") || (h.includes("uraian transaksi") && h.includes("debet")) },
    { id: "bni", name: "BNI", test: (h) => h.includes("uraian transaksi") && (h.includes("tipe") || h.includes("nominal")) },
    { id: "mandiri", name: "Mandiri", test: (h) => (h.includes("dana masuk") && h.includes("dana keluar")) || (h.includes("posting date") && h.includes("remark")) },
    { id: "jago", name: "Jago", test: (h) => h.includes("source/destination") || (h.includes("transaction details") && h.includes("amount")) },
];

/** Cari baris judul, tebak bank, kolom, dan tahun (dari baris "Periode"). */
export function detectLayout(rows) {
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
        const cells = rows[i].map((c) => c.toLowerCase());
        const hasDate = cells.some((c) => RE.date.test(c) && c.length < 40);
        const hasMoney = cells.some((c) => (RE.amount.test(c) || RE.debit.test(c) || RE.credit.test(c)) && !RE.ignore.test(c) && c.length < 40);
        if (hasDate && hasMoney && rows[i].length >= 2) {
            headerIndex = i;
            break;
        }
    }
    // Tanpa judul: anggap baris pertama yang tanggalnya terbaca sebagai data
    const header = headerIndex >= 0 ? rows[headerIndex] : (rows[0] || []).map((_, i) => `Kolom ${i + 1}`);
    const preamble = headerIndex > 0 ? rows.slice(0, headerIndex) : [];
    const yearHint = findYear(preamble);
    const lower = header.map((h) => h.toLowerCase().trim());
    const joined = lower.join(" | ");
    const bank = BANKS.find((b) => b.test(joined)) || { id: "generic", name: "Format umum" };

    const pick = (re, exclude = []) =>
        lower.findIndex((h, i) => re.test(h) && !RE.ignore.test(h) && !exclude.includes(i));
    const date = pick(RE.date);
    const debit = pick(RE.debit, [date]);
    const credit = pick(RE.credit, [date, debit]);
    const flag = pick(RE.flag, [date, debit, credit]);
    let amount = pick(RE.amount, [date, debit, credit, flag]);
    const desc = lower
        .map((h, i) => (RE.desc.test(h) && ![date, debit, credit, flag, amount].includes(i) && !RE.ignore.test(h) ? i : -1))
        .filter((i) => i >= 0);

    // Kolom penanda DB/CR tanpa judul (mis. ekspor klikBCA: "Jumlah,,Saldo")
    let flagCol = flag;
    if (flagCol < 0 && !(debit >= 0 && credit >= 0)) {
        const sample = rows
            .slice(headerIndex + 1, headerIndex + 41)
            .filter((r) => parseDateId(r[date >= 0 ? date : 0], { yearHint }))
            .slice(0, 20);
        for (let c = 0; c < header.length; c += 1) {
            if ([date, debit, credit, amount].includes(c)) continue;
            const vals = sample.map((r) => String(r[c] || "").trim()).filter(Boolean);
            if (vals.length >= 1 && vals.filter((v) => /^(db|cr|d|k|dr)$/i.test(v)).length >= vals.length * 0.8) {
                flagCol = c;
                break;
            }
        }
    }

    let mode = "signed";
    if (debit >= 0 && credit >= 0) mode = "split";
    else if (amount >= 0 && flagCol >= 0) mode = "flag";
    else if (amount < 0 && (debit >= 0 || credit >= 0)) amount = debit >= 0 ? debit : credit;

    const dataStart = headerIndex >= 0 ? headerIndex + 1 : 0;
    const mapping = {
        date: date >= 0 ? date : 0,
        desc: desc.length ? desc : header.length > 1 ? [1] : [],
        mode,
        amount: amount >= 0 ? amount : Math.max(0, header.length - 1),
        debit,
        credit,
        flag: flagCol,
    };
    // Tanpa judul: cari kolom tanggal & nominal dari isi baris
    if (headerIndex < 0) Object.assign(mapping, guessFromData(rows.slice(0, 15)));
    return { headerIndex, header, dataStart, bank, mapping, yearHint };
}

function guessFromData(rows) {
    const cols = Math.max(0, ...rows.map((r) => r.length));
    let date = -1;
    let amount = -1;
    let desc = -1;
    for (let c = 0; c < cols; c += 1) {
        const vals = rows.map((r) => r[c]).filter(Boolean);
        if (!vals.length) continue;
        const dates = vals.filter((v) => parseDateId(v)).length;
        const nums = vals.filter((v) => parseAmountId(v).value > 0).length;
        if (date < 0 && dates >= vals.length * 0.6) date = c;
        else if (amount < 0 && nums >= vals.length * 0.6) amount = c;
        else if (desc < 0 && vals.some((v) => /[a-z]{3,}/i.test(v))) desc = c;
    }
    return { date: Math.max(0, date), amount: Math.max(0, amount), desc: desc >= 0 ? [desc] : [], mode: "signed" };
}

function findYear(preamble) {
    for (const r of preamble) {
        const line = r.join(" ");
        const m = line.match(/(?:periode|period|tanggal|date)[^0-9]*\d{1,2}[/-]\d{1,2}[/-](\d{4})/i) || line.match(/\b(20\d{2})\b/);
        if (m) return Number(m[1]);
    }
    return null;
}

const EXPENSE_WORDS = /^(db|dr|d|debet|debit|keluar|pengeluaran|expense|out|-)$/i;
const INCOME_WORDS = /^(cr|k|kredit|credit|masuk|pemasukan|income|in|\+)$/i;

/**
 * Ubah baris data jadi kandidat transaksi.
 * → { rows: [{ index, date, description, amount, type, raw }], skipped: [{ line, reason }] }
 */
export function buildRows(rows, layout, mapping, { today = new Date() } = {}) {
    const out = [];
    const skipped = [];
    const data = rows.slice(layout.dataStart);
    data.forEach((r, i) => {
        const line = layout.dataStart + i + 1;
        const rawDate = r[mapping.date];
        const date = parseDateId(rawDate, { yearHint: layout.yearHint, today });
        if (!date) {
            // baris ringkasan di bawah tabel (Saldo Awal, Mutasi Debet, dll.) dilewati diam-diam
            if (/^(saldo|mutasi|total|jumlah|ending|opening|closing)/i.test(String(r[0] || "").trim())) return;
            if (rawDate || r.some(Boolean)) skipped.push({ line, reason: rawDate ? `Tanggal "${rawDate}" tidak terbaca` : "Tanpa tanggal" });
            return;
        }
        let amount = 0;
        let type = null;
        if (mapping.mode === "split") {
            const db = parseAmountId(r[mapping.debit]).value;
            const cr = parseAmountId(r[mapping.credit]).value;
            if (db > 0 && !(cr > 0)) {
                amount = db;
                type = "expense";
            } else if (cr > 0 && !(db > 0)) {
                amount = cr;
                type = "income";
            }
        } else {
            const a = parseAmountId(r[mapping.amount]);
            amount = a.value;
            let sign = a.sign;
            if (mapping.mode === "flag") {
                const f = String(r[mapping.flag] || "").trim();
                if (EXPENSE_WORDS.test(f) || /pengeluaran|debet|debit/i.test(f)) sign = -1;
                else if (INCOME_WORDS.test(f) || /pemasukan|kredit|credit/i.test(f)) sign = 1;
            }
            type = sign < 0 ? "expense" : sign > 0 ? "income" : "expense";
            if (!sign && mapping.mode === "signed") type = "income"; // angka positif tanpa tanda = uang masuk
        }
        if (!(amount > 0) || !type) {
            skipped.push({ line, reason: "Nominal kosong atau nol" });
            return;
        }
        const description = (mapping.desc || [])
            .map((c) => r[c])
            .filter(Boolean)
            .join(" · ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200);
        out.push({ index: out.length, line, date, description, amount, type, raw: r });
    });
    return { rows: out, skipped };
}

/** Isi template CSV DailyTrack. */
export const TEMPLATE_CSV =
    "\uFEFFTanggal;Keterangan;Jenis;Nominal\r\n" +
    "01/10/2026;Gaji Oktober;Pemasukan;6500000\r\n" +
    "02/10/2026;Kopi susu gula aren;Pengeluaran;18000\r\n" +
    "03/10/2026;Token listrik;Pengeluaran;100000\r\n";
