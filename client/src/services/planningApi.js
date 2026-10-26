import API from "./api";

// ── BUDGET (lanjutan) ─────────────────────────────────
export const getBudgetSuggestionsAPI = (p) => API.get("/budgets/suggestions", { params: p });
export const copyPreviousBudgetsAPI = (d) => API.post("/budgets/copy-previous", d);
