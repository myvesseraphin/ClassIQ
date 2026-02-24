import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { ensureCsrfCookie, requireCsrf } from "./middleware/csrf.js";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/student.js";
import teacherRoutes from "./routes/teacher.js";
import adminRoutes from "./routes/admin.js";
import uploadRoutes from "./routes/uploads.js";
import libraryRoutes from "./routes/library.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : [];

if (isProduction && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN must be set in production.");
}

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!isProduction) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["Content-Disposition", "Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(ensureCsrfCookie);
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.resolve("uploads")),
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/student", requireCsrf, studentRoutes);
app.use("/api/teacher", requireCsrf, teacherRoutes);
app.use("/api/admin", requireCsrf, adminRoutes);
app.use("/api/uploads", requireCsrf, uploadRoutes);
app.use("/api/library", requireCsrf, libraryRoutes);

app.use((err, req, res, next) => {
  const status =
    err?.message === "Not allowed by CORS" ? 403 : err.status || 500;
  res.status(status).json({
    error: err.message || "Unexpected server error.",
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ClassIQ backend listening on port ${port}`);
});
