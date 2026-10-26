import { formatRupiah } from "../../utils/format";

export const rp = (n) => formatRupiah(Math.round(n || 0));

// Rp 6,5 jt / Rp 450 rb — untuk angka di ruang sempit
export function rpShort(n) {
    const v = Math.round(n || 0);
    const abs = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
    if (abs >= 1e3) return `${sign}Rp ${(abs / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
    return `${sign}Rp ${abs}`;
}

export const num = (n, d = 1) => Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: d });

export function dateLabel(key, withYear) {
    if (!key) return "-";
    const d = new Date(`${key}T00:00:00`);
    const y = withYear ?? d.getFullYear() !== new Date().getFullYear();
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: y ? "numeric" : undefined });
}

export function monthYear(key) {
    if (!key) return "-";
    return new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function durationLabel(months) {
    if (months == null) return "-";
    if (months < 1) return `${Math.max(1, Math.round(months * 30))} hari`;
    if (months < 24) return `${num(months, 0)} bulan`;
    const y = Math.floor(months / 12);
    const m = Math.round(months % 12);
    return m ? `${y} tahun ${m} bulan` : `${y} tahun`;
}

export function dueLabel(it) {
    if (it.status === "stale") {
        const m = Math.round((it.lastSeenDays || 0) / 30);
        return m >= 1 ? `Terakhir ${m} bulan lalu` : `Terakhir ${it.lastSeenDays} hari lalu`;
    }
    if (it.dueIn == null) return "";
    if (it.dueIn < 0) return `Lewat ${-it.dueIn} hari, belum tercatat`;
    if (it.dueIn === 0) return "Hari ini";
    if (it.dueIn === 1) return "Besok";
    return `${dateLabel(it.nextKey)} · ${it.dueIn} hari lagi`;
}

// Warna & inisial layanan populer (bukan logo — hanya tile berwarna)
const SERVICE_STYLE = {
    netflix: ["#e50914", "N"],
    spotify: ["#1db954", "S"],
    youtube: ["#ff0033", "YT"],
    disney: ["#113ccf", "D+"],
    vidio: ["#ee2b6c", "V"],
    viu: ["#f5b800", "V"],
    wetv: ["#ff6a00", "W"],
    prime: ["#00a8e1", "P"],
    applemusic: ["#fa2d48", "AM"],
    icloud: ["#3693f3", "iC"],
    googleone: ["#4285f4", "G1"],
    chatgpt: ["#10a37f", "AI"],
    claude: ["#d97757", "C"],
    canva: ["#00c4cc", "C"],
    m365: ["#d83b01", "M"],
    adobe: ["#fa0f00", "A"],
    notion: ["#2f2f2f", "N"],
    gym: ["#f08a3c", "G"],
    indihome: ["#e4202e", "IH"],
    biznet: ["#0d4c92", "B"],
    firstmedia: ["#e30613", "FM"],
    myrepublic: ["#6a1b9a", "MR"],
    wifi: ["#3b82f6", "W"],
    pulsa: ["#c81e1e", "P"],
    listrik: ["#d4a106", "PLN"],
    pdam: ["#1f8fd1", "Air"],
    bpjs: ["#00a651", "B"],
    asuransi: ["#5a6fd6", "A"],
    cicilan: ["#8b5cf6", "Ci"],
    kos: ["#b8923f", "K"],
};

export function serviceStyle(it) {
    const s = SERVICE_STYLE[it.service];
    if (s) return { color: s[0], label: s[1] };
    const words = (it.name || "?").split(/\s+/).filter(Boolean);
    const label = (words[0]?.[0] || "?") + (words[1]?.[0] || "");
    return { color: null, label: label.toUpperCase() };
}
