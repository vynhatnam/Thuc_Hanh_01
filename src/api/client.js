import axios from "axios";
import { clearSession, getSession } from "../auth/sessionStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const session = getSession();
  if (!config.skipAuth && session) {
    if (Date.parse(session.expiresAt) <= Date.now()) clearSession(session.token);
    else config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  const authorization = error.config?.headers?.Authorization;
  if (error.response?.status === 401 && authorization && !error.config?.skipAuth) {
    // Ignore an old request's 401 if the browser has already signed in with a new token.
    clearSession(authorization.slice(7));
  }
  return Promise.reject(error);
});

export function getRequestError(error) {
  const problem = error.response?.data;
  if (problem?.errors) return Object.values(problem.errors).flat().join(" ");
  if (typeof problem === "string") return problem;
  if (problem?.detail) return problem.detail;
  if (problem?.title) return problem.title;
  if (error.code === "ECONNABORTED") return "Máy chủ phản hồi quá lâu. Vui lòng thử lại.";
  return "Không thể kết nối đến máy chủ. Hãy kiểm tra backend đang chạy và thử lại.";
}

export default api;
