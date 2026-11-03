export const SESSION_KEY = "suncare.auth";
const listeners = new Set();

export function readStoredSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (value && typeof value.token === "string" && /^[a-f\d]{64}$/i.test(value.token)
      && Number.isFinite(Date.parse(value.expiresAt)) && Date.parse(value.expiresAt) > Date.now()
      && Number.isInteger(value.user?.id) && typeof value.user?.email === "string") {
      return { token: value.token, expiresAt: value.expiresAt, user: value.user };
    }
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Malformed/disabled storage must not crash the application.
  }
  return null;
}

let session = readStoredSession();
export const getSession = () => session;
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveSession(value) {
  session = value;
  let persisted = true;
  try {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    persisted = false;
  }
  listeners.forEach((listener) => listener());
  return persisted;
}

export function clearSession(expectedToken) {
  if (!expectedToken || session?.token === expectedToken) saveSession(null);
}

function onStorage(event) {
  if (event.key !== SESSION_KEY && event.key !== null) return;
  session = readStoredSession();
  listeners.forEach((listener) => listener());
}
window.addEventListener("storage", onStorage);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener("storage", onStorage));
