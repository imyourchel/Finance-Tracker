// Format angka ringkas untuk sumbu grafik & chip
export const shortRupiah = (v = 0) => {
    const n = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    if (n >= 1e9) return `${sign}${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    if (n >= 1e6) return `${sign}${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
    if (n >= 1e3) return `${sign}${Math.round(n / 1e3).toLocaleString("id-ID")} rb`;
    return `${sign}${Math.round(n)}`;
};

export const signedRupiah = (v, fmt) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v))}`;

export const pctLabel = (p) =>
    p === null || p === undefined ? "–" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(Math.round(p))}%`;

export const changePct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

export const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
