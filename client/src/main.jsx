import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { api } from "./api.js";
import { ConfigContext } from "./config.js";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import Status from "./pages/Status.jsx";
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
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="register" element={<Register />} />
            <Route path="status" element={<Status />} />
            <Route path="pass/:token" element={<Pass />} />
          </Route>
          <Route path="admin/*" element={<Admin />} />
          <Route path="*" element={<Layout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigContext.Provider>
  );
}

function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">પૃષ્ઠ મળ્યું નથી <span className="block text-lg font-normal text-on-surface-variant">Page not found</span></h1>
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
