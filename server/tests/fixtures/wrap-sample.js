// Data contoh bersama untuk uji Wrapped & Mood
const H = 3600e3, D = 24 * H;
const wibDate = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 7, min));
const cat = (name, color, icon) => ({ _id: name, name, color, icon });
const C = { makan: cat("Makanan", "#e07a3f", "utensils"), belanja: cat("Belanja", "#7a5af8", "shopping-bag"), transport: cat("Transportasi", "#3b82f6", "car"), tagihan: cat("Tagihan", "#64748b", "file-text"), hiburan: cat("Hiburan", "#ec4899", "music"), gaji: cat("Gaji", "#1f8a5b", "cash") };
const moods = ["senang", "biasa", "sedih", "self_reward", "terpaksa", "bangga", "bersalah", "happy", null, null];
const rows = [];
let id = 0;
const push = (o) => rows.push({ _id: "t" + ++id, isRecurring: false, ...o, createdAt: o.createdAt || o.date });
for (const [y, m] of [[2026, 9], [2026, 10]]) {
  push({ type: "income", amount: 8000000, date: wibDate(y, m, 1, 9), category: C.gaji, description: "Gaji" });
  push({ type: "expense", amount: 1800000, date: wibDate(y, m, 2, 10), category: C.tagihan, isRecurring: true, description: "Kos" });
  for (let d = 1; d <= 26; d++) {
    if (d % 6 === 0) continue;
    push({ type: "expense", amount: 18000 + (d % 4) * 3000, date: wibDate(y, m, d, 7, 30), category: C.makan, description: "Kopi susu", mood: moods[d % moods.length] });
    if (d % 2) push({ type: "expense", amount: 45000 + d * 1000, date: wibDate(y, m, d, 12), category: C.makan, description: "Makan siang", mood: moods[(d + 3) % moods.length] });
    if (d % 3 === 0) push({ type: "expense", amount: 25000, date: wibDate(y, m, d, 18), category: C.transport, description: "Ojek" });
    if (d % 7 === 0) push({ type: "expense", amount: 350000 + d * 10000, date: wibDate(y, m, d, 22, 30), category: C.belanja, description: "Checkout marketplace", mood: d % 2 ? "self_reward" : "sedih" });
    if (d % 9 === 0) push({ type: "expense", amount: 150000, date: wibDate(y, m, d, 20), category: C.hiburan, description: "Nonton", mood: "senang" });
  }
  push({ type: "expense", amount: 2450000, date: wibDate(y, m, 21, 21), category: C.belanja, description: "Sepatu lari", mood: "self_reward" });
  push({ type: "expense", amount: 500000, date: wibDate(y, m, 15, 9), goalId: "g1", description: "Setor ke goal" });
  push({ type: "expense", amount: 300000, date: wibDate(y, m, 16, 9), debtId: "d1", description: "Pinjamkan ke Budi" });
}
module.exports = { rows, wibDate };
