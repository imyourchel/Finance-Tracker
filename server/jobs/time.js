// Waktu dalam WIB (UTC+7). Semua jadwal & "hari ini" mengikuti WIB.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function wib(now = new Date()) {
    const d = new Date(new Date(now).getTime() + TZ_OFFSET_MS);
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    return {
        key: d.toISOString().slice(0, 10), // "YYYY-MM-DD"
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        date: d.getUTCDate(),
        dow: d.getUTCDay(),
        hour,
        minute,
        minutes: hour * 60 + minute,
        hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
}

const dayKey = (d) => wib(d).key;
// Awal hari WIB untuk kunci "YYYY-MM-DD" → Date (UTC)
const startOfKey = (key) => new Date(Date.parse(key) - TZ_OFFSET_MS);
const addDays = (key, n) => new Date(Date.parse(key) + n * DAY_MS).toISOString().slice(0, 10);

// "20:00" → 1200 menit; nilai tidak valid → null
function toMinutes(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h > 23 || mm > 59) return null;
    return h * 60 + mm;
}

// Daftar "HH:MM" dalam jendela [now - windowMinutes, now] pada hari yang sama (WIB)
function timesInWindow(now, windowMinutes) {
    const t = wib(now);
    const from = Math.max(0, t.minutes - windowMinutes);
    const out = [];
    for (let m = from; m <= t.minutes; m += 1) {
        out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return out;
}

module.exports = { TZ_OFFSET_MS, DAY_MS, wib, dayKey, startOfKey, addDays, toMinutes, timesInWindow };
