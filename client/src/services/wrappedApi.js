import API from "./api";

// Rekap Wrapped: { period: "month", year, month } atau { period: "year", year }
export const getWrappedAPI = (params) => API.get("/wrapped", { params });
