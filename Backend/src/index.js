import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/student.js";
import uploadRoutes from "./routes/uploads.js";
import libraryRoutes from "./routes/library.js";

dotenv.config();

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/library", libraryRoutes);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Unexpected server error.",
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ClassIQ backend listening on port ${port}`);
});
