import api from "./client";

export const registerUser = (values) => api.post("/auth/register", values, { skipAuth: true });
export const loginUser = (values) => api.post("/auth/login", values, { skipAuth: true });
export const getCurrentUser = (signal) => api.get("/auth/me", { signal });
export const logoutUser = () => api.post("/auth/logout");
