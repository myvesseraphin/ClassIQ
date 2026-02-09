import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();
router.use(requireAuth);
const uploadDir = path.resolve("uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 40);
    const stamp = Date.now();
    cb(null, `${safeBase || "upload"}-${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed."));
    }
    return cb(null, true);
  },
});

router.post("/", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File is required." });
  }

  await logAudit(req, "profile_image_upload", {
    filename: req.file.filename,
  });

  return res.json({
    file: {
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
    },
  });
});

export default router;
