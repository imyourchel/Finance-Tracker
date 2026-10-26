import API from "./api";

// ── Ekspor ────────────────────────────────────────────
export const exportTransactionsCsvAPI = (params) =>
    API.get("/data/export/transactions.csv", { params, responseType: "blob" });
export const exportBackupAPI = () => API.get("/data/export/backup.json", { responseType: "blob" });

// ── Impor mutasi rekening ─────────────────────────────
export const previewImportAPI = (d) => API.post("/data/import/preview", d);
export const importTransactionsAPI = (d) => API.post("/data/import/transactions", d);
export const undoImportAPI = (d) => API.post("/data/import/undo", d);
