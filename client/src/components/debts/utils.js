import { formatRupiah } from "../../utils/format";

export const todayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const toYMD = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (date, withYear = false) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: withYear || d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
};

/** "Lewat 3 hari", "Hari ini", "2 hari lagi" */
export const dueLabel = (d) => {
    if (!d.dueDate || d.status !== "open") return null;
    if (d.overdue) {
        const late = Math.max(1, 1 - d.daysToDue);
        return { tone: "late", text: `Lewat ${late} hari` };
    }
    const left = d.daysToDue - 1; // jatuh tempo = akhir hari itu
    if (left <= 0) return { tone: "soon", text: "Jatuh tempo hari ini" };
    if (left === 1) return { tone: "soon", text: "Jatuh tempo besok" };
    if (left <= 7) return { tone: "soon", text: `${left} hari lagi` };
    return { tone: "calm", text: `Tempo ${fmtDate(d.dueDate)}` };
};

const PALETTE = ["#1e6e55", "#b8923f", "#3d6fb6", "#a3497a", "#c2531b", "#4e8a3a", "#6b5bb5", "#2a8a8a"];
export const colorFor = (key = "") => {
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
};
export const initials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "?";

const plain = (n) => formatRupiah(n).replace(/\s/g, "");

/** Pesan penagihan sopan yang siap ditempel di WhatsApp. */
export function buildReminder(name, items) {
    const first = name.split(" ")[0];
    const total = items.reduce((s, d) => s + d.remaining, 0);
    const line = (d) => {
        const what = d.note || "Pinjaman";
        const part = d.paid > 0 ? `sisa ${plain(d.remaining)}` : plain(d.remaining);
        const due = d.dueDate ? `, jatuh tempo ${fmtDate(d.dueDate)}` : "";
        return `${what} (${fmtDate(d.date)}) ${part}${due}`;
    };
    if (items.length === 1) {
        return `Halo ${first} 👋\nMau ngingetin soal ${line(items[0])} ya.\nKalau sudah longgar, boleh transfer kapan saja. Makasih banyak! 🙏`;
    }
    return [
        `Halo ${first} 👋`,
        "Mau ngingetin catatan kecil kita ya:",
        ...items.map((d) => `• ${line(d)}`),
        `Totalnya ${plain(total)}.`,
        "Kalau sudah longgar, boleh transfer kapan saja. Makasih banyak! 🙏",
    ].join("\n");
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    }
}
