import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { api } from "./api.js";
import { ConfigContext } from "./config.js";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Registration from "./pages/Registration.jsx";
import Admin from "./admin/Admin.jsx";
import "./styles.css";
import "./site.css";

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
            <Route path="register" element={<Registration />} />
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
    <section className="section">
      <div className="container">
        <h1 className="heading">Page not found</h1>
        <p className="muted">The page you are looking for does not exist.</p>
        <p style={{ marginTop: 24 }}><a href="/" className="button">Go to home page</a></p>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
