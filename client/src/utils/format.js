export const formatRupiah = (amount = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);

export const formatNumberInput = (value = "") => {
    const digits = String(value).replace(/[^\d]/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
};

export const parseNumberInput = (value = "") =>
    Number(String(value).replace(/[^\d]/g, ""));

export const formatDate = (date) =>
    new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(date));

export const formatDateShort = (date) =>
    new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(date));

export const formatDateInput = (date) =>
    new Date(date).toISOString().slice(0, 10);

export const MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

// Warna sesuai tipe transaksi
export const TYPE_COLOR = {
    income: "#10b981",
    expense: "#ef4444",
    transfer: "#4f46e5",
};

export const TYPE_LABEL = {
    income: "Pemasukan",
    expense: "Pengeluaran",
    transfer: "Transfer",
};
