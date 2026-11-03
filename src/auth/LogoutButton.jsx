import { useState } from "react";
import { useAuth } from "./useAuth";
import { getRequestError } from "../api/client";

export default function LogoutButton() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await logout(); }
    catch (requestError) { setError(getRequestError(requestError)); }
    finally { setBusy(false); }
  }
  return <div className="logout-control"><button type="button" className="button button-secondary" disabled={busy} onClick={handleLogout}>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
    {error && <p className="field-error" role="alert">{error}</p>}</div>;
}
