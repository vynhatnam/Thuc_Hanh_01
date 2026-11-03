import { Navigate, useLocation } from "react-router";
import { useAuth } from "./useAuth";

export default function RequireAuth({ children }) {
  const { user, status, sessionError, retrySession, clearLocalSession } = useAuth();
  const location = useLocation();
  if (status === "checking") return <main className="auth-state" role="status">Đang kiểm tra phiên đăng nhập…</main>;
  if (status === "error") return <main className="auth-state">
    <h1>Chưa thể kiểm tra phiên đăng nhập</h1>
    <p className="feedback feedback-error" role="alert">{sessionError}</p>
    <div className="button-group"><button className="button button-primary" onClick={retrySession}>Thử lại</button>
      <button className="button button-secondary" onClick={clearLocalSession}>Xóa phiên trên trình duyệt</button></div>
  </main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
