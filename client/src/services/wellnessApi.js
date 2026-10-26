import API from "./api";

// Kesehatan finansial: dana darurat, langganan, skor
export const getWellnessAPI = () => API.get("/wellness");
export const updateWellnessProfileAPI = (d) => API.put("/wellness/profile", d);
export const ignoreSubscriptionAPI = (key) => API.post("/wellness/subscriptions/ignore", { key });
export const unignoreSubscriptionAPI = (key) => API.post("/wellness/subscriptions/unignore", { key });
