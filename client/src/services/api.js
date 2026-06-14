import axios from "axios";

// const API = axios.create({ baseURL: "http://localhost:5000/api" });
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Sisipkan token JWT di setiap request secara otomatis
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

API.interceptors.response.use(
    (res) => res,
    (err) => {
        const requestUrl = err.config?.url || "";
        const isAuthRequest = requestUrl.includes("/auth/login");

        if (err.response?.status === 401 && !isAuthRequest) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }

        // Forward pesan dari server ke UI
        const serverMsg = err.response?.data?.message;
        if (serverMsg) err.message = serverMsg;

        return Promise.reject(err);
    },
);

// ── AUTH ──────────────────────────────────────────────
export const registerAPI = (d) => API.post("/auth/register", d);
export const loginAPI = (d) => API.post("/auth/login", d);
export const getProfileAPI = () => API.get("/auth/profile");
export const updateProfileAPI = (d) => {
    if (d instanceof FormData) {
        return API.put("/auth/profile", d, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    }
    return API.put("/auth/profile", d);
};
export const changePasswordAPI = (d) => API.put("/auth/password", d);
export const forgotPasswordAPI = (d) => API.post("/auth/forgot-password", d);

// ── WALLETS ───────────────────────────────────────────
export const getWalletsAPI = () => API.get("/wallets");
export const createWalletAPI = (d) => API.post("/wallets", d);
export const updateWalletAPI = (id, d) => API.put(`/wallets/${id}`, d);
export const archiveWalletAPI = (id) => API.delete(`/wallets/${id}`);

// ── CATEGORIES ────────────────────────────────────────
export const getCategoriesAPI = (p) => API.get("/categories", { params: p });
export const createCategoryAPI = (d) => API.post("/categories", d);
export const deleteCategoryAPI = (id) => API.delete(`/categories/${id}`);

// ── TRANSACTIONS ──────────────────────────────────────
export const getTransactionsAPI = (p) =>
    API.get("/transactions", { params: p });
export const createTransactionAPI = (d) => {
    if (d instanceof FormData) {
        return API.post("/transactions", d, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    }
    return API.post("/transactions", d);
};

export const updateTransactionAPI = (id, d) => {
    if (d instanceof FormData) {
        return API.put(`/transactions/${id}`, d, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    }
    return API.put(`/transactions/${id}`, d);
};
export const deleteTransactionAPI = (id) => API.delete(`/transactions/${id}`);
export const getSummaryAPI = (p) =>
    API.get("/transactions/summary", { params: p });
// export const getComparisonAPI = () => API.get("/transactions/comparison");
export const getComparisonAPI = (month, year) =>
    API.get("/transactions/comparison", {
        params: { month, year },
    });

// ── BUDGETS ───────────────────────────────────────────
export const getBudgetsAPI = (p) => API.get("/budgets", { params: p });
export const createBudgetAPI = (d) => API.post("/budgets", d);
export const updateBudgetAPI = (id, d) => API.put(`/budgets/${id}`, d);
export const deleteBudgetAPI = (id) => API.delete(`/budgets/${id}`);

// ── GOALS ─────────────────────────────────────────────
export const getGoalsAPI = () => API.get("/goals");
export const createGoalAPI = (d) => API.post("/goals", d);
export const addSavingAPI = (id, d) => API.post(`/goals/${id}/saving`, d);
export const updateGoalAPI = (id, d) => API.put(`/goals/${id}`, d);
export const deleteGoalAPI = (id, data) => API.delete(`/goals/${id}`, { data });

// ── RECURRING ─────────────────────────────────────────
export const getRecurringsAPI = () => API.get("/recurring");
export const createRecurringAPI = (d) => API.post("/recurring", d);
export const toggleRecurringAPI = (id) => API.put(`/recurring/${id}/toggle`);
export const deleteRecurringAPI = (id) => API.delete(`/recurring/${id}`);
