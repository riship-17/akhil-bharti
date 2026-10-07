import dotenv from "dotenv";
dotenv.config({ quiet: true });
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";

for (const key of ["MONGODB_URI", "ADMIN_PASSWORD", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy server/.env.example to server/.env and fill it in.`);
    process.exit(1);
  }
}

// Routes read env at import time, so load them after the check above.
const { default: publicRoutes } = await import("./routes/public.js");
const { default: adminRoutes } = await import("./routes/admin.js");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
  next();
});
app.use(express.json({ limit: "100kb" }));

app.use("/api/admin", adminRoutes);
app.use("/api", publicRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// In production the built React app is served from here.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => (req.method === "GET" ? res.sendFile(path.join(dist, "index.html")) : next()));
}

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File is too large. Maximum size is 10 MB.", fields: { [err.field]: "Maximum size is 10 MB." } });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message, fields: err.field ? { [err.field]: err.message } : undefined });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

await mongoose.connect(process.env.MONGODB_URI);
const port = Number(process.env.PORT) || 5000;
app.listen(port, () => console.log(`API ready on http://localhost:${port}`));
