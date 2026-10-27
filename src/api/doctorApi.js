
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
    timeout: 10000,
});

// GET: danh sách và chi tiết bác sĩ.
export const getDoctors = (signal) =>
    api.get("/doctors", { signal });

export const getDoctor = (id, signal) =>
    api.get(`/doctors/${id}`, { signal });

// POST
export const createDoctor = (data) =>
    api.post("/doctors", data);

// PUT
export const updateDoctor = (id, data) =>
    api.put(`/doctors/${id}`, data);

// DELETE
export const deleteDoctor = (id) =>
    api.delete(`/doctors/${id}`);

export function getApiError(error) {
    const problem = error.response?.data;

    if (problem?.errors) {
        return Object.values(problem.errors).flat().join(" ");
    }

    if (error.response?.status === 404) {
        return "Bác sĩ này không còn tồn tại. Hãy tải lại danh sách.";
    }

    if (typeof problem === "string") return problem;
    if (problem?.detail) return problem.detail;
    if (problem?.title) return problem.title;

    if (error.code === "ECONNABORTED") {
        return "Máy chủ phản hồi quá lâu. Vui lòng thử lại.";
    }

    return "Không thể kết nối đến máy chủ. Hãy kiểm tra backend đang chạy và thử lại.";
}
