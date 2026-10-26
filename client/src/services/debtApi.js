import API from "./api";

// Utang-piutang & patungan. Setiap aksi mengembalikan data lengkap terbaru.
export const getDebtsAPI = () => API.get("/debts");
export const createDebtAPI = (d) => API.post("/debts", d);
export const updateDebtAPI = (id, d) => API.put(`/debts/${id}`, d);
export const deleteDebtAPI = (id) => API.delete(`/debts/${id}`);
export const addDebtPaymentAPI = (id, d) => API.post(`/debts/${id}/payments`, d);
export const deleteDebtPaymentAPI = (id, paymentId) => API.delete(`/debts/${id}/payments/${paymentId}`);
export const createSplitAPI = (d) => API.post("/debts/splits", d);
export const deleteSplitAPI = (id) => API.delete(`/debts/splits/${id}`);
