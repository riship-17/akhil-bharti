import { useCallback, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { api, store } from "../api.js";
import Registrations from "./Registrations.jsx";
import Settings from "./Settings.jsx";

const TOKEN_KEY = "abrsm26-admin";

export default function Admin() {
  const [token, setToken] = useState(() => store.get(TOKEN_KEY));

  const logout = useCallback(() => {
    store.remove(TOKEN_KEY);
    setToken(null);
  }, []);

  // Wraps api() so an expired session drops back to the login screen.
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

  if (!token) return <Login onLogin={(t) => { store.set(TOKEN_KEY, t); setToken(t); }} />;

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-row">
          <Link to="/admin" className="admin-brand">
            <span className="seal small" aria-hidden="true">ABRSM</span>
            <span>State Conference 2026 <small>Organiser panel</small></span>
          </Link>
          <nav className="admin-nav">
            <NavLink to="/admin" end>Registrations</NavLink>
            <NavLink to="/admin/settings">Payment &amp; settings</NavLink>
            <a href="/" target="_blank" rel="noopener">View site</a>
            <button type="button" className="link" onClick={logout}>Log out</button>
          </nav>
        </div>
      </header>
      <Routes>
        <Route index element={<Registrations call={call} token={token} />} />
        <Route path="settings" element={<Settings call={call} token={token} />} />
      </Routes>
    </div>
  );
}

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api("/admin/login", { method: "POST", body: { password } });
      onLogin(token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login" onSubmit={submit}>
        <span className="seal" aria-hidden="true">ABRSM</span>
        <h1>Organiser login</h1>
        <p className="muted">State Conference 2026 · Registrations</p>
        <label className="field-label" htmlFor="pw"><span className="field-en">Password</span></label>
        <input id="pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="field-error">{error}</p>}
        <button className="btn block" disabled={busy || !password}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
