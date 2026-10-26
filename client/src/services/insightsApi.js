import API from "./api";

// Ringkasan bulan + proyeksi + insight otomatis untuk Dashboard
export const getInsightsOverviewAPI = (params) => API.get("/insights/overview", { params });

// Tren N bulan, kategori, heatmap, transaksi terbesar untuk Analitik
export const getInsightsAnalyticsAPI = (params) => API.get("/insights/analytics", { params });

// Mood vs belanja (belanja emosional) untuk Analitik
export const getInsightsMoodAPI = (params) => API.get("/insights/mood", { params });
