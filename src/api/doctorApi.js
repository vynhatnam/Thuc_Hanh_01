
import api, { getRequestError } from "./client";

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
    if (error.response?.status === 404) {
        return "Bác sĩ này không còn tồn tại. Hãy tải lại danh sách.";
    }
    return getRequestError(error);
}
