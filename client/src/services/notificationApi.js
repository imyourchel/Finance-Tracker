import API from "./api";

export const getNotificationsAPI = () => API.get("/notifications");
export const markNotificationsReadAPI = (ids) => API.post("/notifications/read", { ids });
export const sendTestEmailAPI = () => API.post("/notifications/test-email");
