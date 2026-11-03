import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../api/authApi";
import { getRequestError } from "../api/client";
import { AuthContext } from "./AuthContext";
import { clearSession, getSession, saveSession, subscribeSession } from "./sessionStore";

export default function AuthProvider({ children }) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [verified, setVerified] = useState(null);
  const [failure, setFailure] = useState(null);
  const [retry, setRetry] = useState(0);
  const [storageWarning, setStorageWarning] = useState("");
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getCurrentUser(controller.signal).then(({ data }) => {
      if (!controller.signal.aborted && getSession()?.token === token) {
        setVerified({ token, user: data });
        setFailure(null);
      }
    }).catch((error) => {
      if (!controller.signal.aborted && getSession()?.token === token) {
        setFailure({ token, message: getRequestError(error) });
      }
    });
    return () => controller.abort();
  }, [token, retry]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => clearSession(session.token),
      Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  const login = useCallback(async (values) => {
    const { data } = await loginUser(values);
    const persisted = saveSession(data);
    setStorageWarning(persisted ? "" : "Trình duyệt không cho lưu phiên. Bạn cần đăng nhập lại khi tải lại trang.");
    setVerified({ token: data.token, user: data.user });
    setFailure(null);
  }, []);

  const register = useCallback(async (values) => {
    const { data } = await registerUser(values);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const currentToken = getSession()?.token;
    if (!currentToken) return;
    await logoutUser();
    clearSession(currentToken);
    setStorageWarning("");
  }, []);

  const retrySession = useCallback(() => {
    setFailure(null);
    setVerified(null);
    setRetry((current) => current + 1);
  }, []);

  const status = !session ? "guest" : failure?.token === token ? "error"
    : verified?.token === token ? "authenticated" : "checking";
  const user = status === "authenticated" ? verified.user : null;
  const value = useMemo(() => ({
    user, status, login, register, logout, retrySession,
    clearLocalSession: () => clearSession(),
    sessionError: status === "error" ? failure.message : "",
    storageWarning: session ? storageWarning : "",
    expiresAt: session?.expiresAt,
  }), [user, status, login, register, logout, retrySession, failure, session, storageWarning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
