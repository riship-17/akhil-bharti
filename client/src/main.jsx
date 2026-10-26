import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api.js";
import { AuthProvider, RequireAuth } from "./auth.js";
import { ConfigContext } from "./config.js";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import Account from "./pages/Account.jsx";
import { Forgot, Login, Reset, Signup } from "./pages/Auth.jsx";
import Pass from "./pages/Pass.jsx";
import Admin from "./admin/Admin.jsx";
import "./app.css";

function App() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    api("/config").then(setConfig).catch(() => setConfig({ fee: 500, registrationOpen: true, contacts: [], error: true }));
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
              <Route path="forgot" element={<Forgot />} />
              <Route path="reset/:token" element={<Reset />} />
              <Route path="register" element={<RequireAuth to="/signup"><Register /></RequireAuth>} />
              <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="status" element={<Navigate to="/account" replace />} />
              <Route path="pass/:token" element={<Pass />} />
            </Route>
            <Route path="admin/*" element={<Admin />} />
            <Route path="*" element={<Layout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigContext.Provider>
  );
}

function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-on-surface-variant">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-semibold text-on-primary shadow-md hover:bg-on-primary-fixed-variant">Go to home page</Link>
    </section>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
