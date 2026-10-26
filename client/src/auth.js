import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, store } from "./api.js";

// Participant login. The session token lives in localStorage; the admin panel has its own, separate token.
const TOKEN_KEY = "abrsm26-user";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => store.get(TOKEN_KEY)); // { token, user }
  const [me, setMe] = useState(null); // { user, registration } from /api/me
  const token = session?.token || null;

  const logout = useCallback(() => {
    store.remove(TOKEN_KEY);
    setSession(null);
    setMe(null);
  }, []);

  const login = useCallback(({ token, user }) => {
    store.set(TOKEN_KEY, { token, user });
    setSession({ token, user });
    setMe(null);
  }, []);

  // Wraps api() with the participant's token; an expired session logs out.
  const call = useCallback(
    async (path, opts = {}) => {
      try {
        return await api(path, { ...opts, token });
      } catch (err) {
        if (err.status === 401) logout();
        throw err;
      }
    },
    [token, logout]
  );

  const refresh = useCallback(() => (token ? call("/me").then(setMe) : Promise.resolve()), [token, call]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const value = useMemo(
    () => ({ token, user: me?.user || session?.user || null, me, refresh, login, logout, call }),
    [token, me, session, refresh, login, logout, call]
  );
  return createElement(AuthContext.Provider, { value }, children);
}

// Sends logged-out visitors to log in (or sign up) and brings them back afterwards.
export function RequireAuth({ children, to = "/login" }) {
  const { token } = useAuth();
  const { pathname } = useLocation();
  if (!token) return createElement(Navigate, { to: `${to}?next=${encodeURIComponent(pathname)}`, replace: true });
  return children;
}

// Only allow same-site paths as the post-login destination.
export const safeNext = (next) => (typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/account");
