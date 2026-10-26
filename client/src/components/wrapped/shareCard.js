// Kartu ringkasan Wrapped 1080×1920 (ukuran story Instagram), digambar manual di <canvas>.
import { formatRupiah } from "../../utils/format";

const W = 1080;
const H = 1920;
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Plus Jakarta Sans", "Segoe UI", Roboto, sans-serif';

const loadImage = (src) =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Potong teks supaya muat lebar tertentu
function fit(ctx, text, maxW) {
    let s = String(text);
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s}…`;
}

function wrap(ctx, text, maxW) {
    const words = String(text).split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
            lines.push(line);
            line = w;
        } else line = test;
    }
    if (line) lines.push(line);
    return lines;
}

export async function renderShareCard(w, persona) {
    try {
        await Promise.all([
            document.fonts?.load(`96px ${SERIF}`),
            document.fonts?.load(`700 40px ${SANS}`),
            document.fonts?.load(`500 32px ${SANS}`),
        ]);
    } catch {
        /* font cadangan dipakai */
    }
    const [logo, mascot] = await Promise.all([
        loadImage("/brand/logo-128.webp"),
        persona ? loadImage(persona.image) : Promise.resolve(null),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Latar
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b241e");
    bg.addColorStop(1, "#14453a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 900);
    glow.addColorStop(0, "rgba(184,146,63,0.42)");
    glow.addColorStop(1, "rgba(184,146,63,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(0, H, 0, 0, H, 800);
    glow2.addColorStop(0, "rgba(79,191,148,0.22)");
    glow2.addColorStop(1, "rgba(79,191,148,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // Lingkaran dekor
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 60;
    ctx.beginPath();
    ctx.arc(W - 40, 560, 300, 0, Math.PI * 2);
    ctx.stroke();

    const X = 90;
    // Kepala
    if (logo) ctx.drawImage(logo, X, 110, 84, 84);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 38px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.fillText("DailyTrack", X + 108, 140);
    ctx.fillStyle = "#e9d9b0";
    ctx.font = `600 26px ${SANS}`;
    ctx.fillText("WRAPPED", X + 108, 178);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `150px ${SERIF}`;
    ctx.fillText(fit(ctx, w.period.type === "year" ? String(w.period.year) : w.period.shortLabel, W - 2 * X), X, 400);
    if (w.period.type === "month") {
        ctx.fillStyle = "#e9d9b0";
        ctx.font = `italic 72px ${SERIF}`;
        ctx.fillText(String(w.period.year), X, 480);
    }

    // Kepribadian
    const pz = w.personality;
    let y = 600;
    roundRect(ctx, X, y, W - 2 * X, 200, 36);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `92px ${SANS}`;
    ctx.fillText(pz.emoji, X + 40, y + 132);
    ctx.fillStyle = "rgba(233,217,176,0.9)";
    ctx.font = `600 26px ${SANS}`;
    ctx.fillText("KEPRIBADIAN BELANJA", X + 170, y + 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = `68px ${SERIF}`;
    ctx.fillText(fit(ctx, pz.title, W - 2 * X - 210), X + 170, y + 150);

    // Angka utama
    y = 880;
    const t = w.totals;
    const cells = [
        ["Uang masuk", formatRupiah(t.income)],
        ["Uang keluar", formatRupiah(t.expense)],
        ["Sisa", `${t.net < 0 ? "−" : ""}${formatRupiah(Math.abs(t.net))}`],
        ["Rasio tabungan", t.savingRate === null ? "–" : `${Math.round(t.savingRate)}%`],
        ["Kategori #1", w.topCategories[0]?.name || "–"],
        ["Streak terpanjang", `${w.activity.bestStreak} hari`],
    ];
    const colW = (W - 2 * X - 30) / 2;
    cells.forEach(([label, value], i) => {
        const cx = X + (i % 2) * (colW + 30);
        const cy = y + Math.floor(i / 2) * 170;
        roundRect(ctx, cx, cy, colW, 145, 28);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(215,228,222,0.75)";
        ctx.font = `500 27px ${SANS}`;
        ctx.fillText(label, cx + 32, cy + 52);
        ctx.fillStyle = i === 2 && t.net < 0 ? "#f2b8a0" : "#ffffff";
        ctx.font = `700 44px ${SANS}`;
        ctx.fillText(fit(ctx, value, colW - 64), cx + 32, cy + 112);
    });

    // Sorotan
    y = 1420;
    const highlights = [];
    if (w.biggest) highlights.push(`Transaksi terbesar ${formatRupiah(w.biggest.amount)}${w.biggest.description ? ` · ${w.biggest.description}` : ""}`);
    if (w.busiestDay) highlights.push(`Hari paling boros: ${new Date(`${w.busiestDay.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`);
    if (w.mood) highlights.push(`Mood belanja tersering: ${w.mood.emoji} ${w.mood.label}`);
    ctx.font = `500 32px ${SANS}`;
    const textW = mascot ? W - 2 * X - 300 : W - 2 * X;
    highlights.slice(0, 3).forEach((h) => {
        ctx.fillStyle = "#d9b86a";
        ctx.beginPath();
        ctx.arc(X + 10, y - 11, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(238,243,240,0.92)";
        const lines = wrap(ctx, h, textW - 40).slice(0, 2);
        lines.forEach((ln, li) => ctx.fillText(ln, X + 36, y + li * 44));
        y += 44 * lines.length + 30;
    });

    // Maskot
    if (mascot) {
        const r = 130;
        const cx = W - X - r;
        const cy = 1560;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
        ctx.fillStyle = "#b8923f";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(mascot, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        ctx.fillStyle = "#ffffff";
        ctx.font = `600 26px ${SANS}`;
        ctx.textAlign = "center";
        ctx.fillText(fit(ctx, persona.name, 300), cx, cy + r + 52);
        ctx.textAlign = "left";
    }

    // Kaki
    ctx.fillStyle = "rgba(215,228,222,0.6)";
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText("Catat, pahami, tumbuh · DailyTrack", X, H - 90);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export async function downloadShareCard(w, persona) {
    const blob = await renderShareCard(w, persona);
    if (!blob) throw new Error("Gambar gagal dibuat");
    const name = `dailytrack-wrapped-${w.period.type === "year" ? w.period.year : `${w.period.year}-${String(w.period.month).padStart(2, "0")}`}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
