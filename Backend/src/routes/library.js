import express from "express";
import multer from "multer";
import path from "path";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const SUPABASE_BUCKET = "Books";
const SUPABASE_FOLDER = "public";

const sanitizeFilename = (value) =>
  String(value || "resource")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "resource";

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
};

const formatShortDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const normalizeLevels = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildPublicUrl = (bucket, filePath) => {
  if (!bucket || !filePath || !process.env.SUPABASE_URL) return null;
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
};

const ensureSupabaseConfig = () => {
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
};

const uploadToSupabase = async (file) => {
  ensureSupabaseConfig();
  const ext = path.extname(file.originalname || "");
  const safeBase = sanitizeFilename(path.basename(file.originalname || "", ext));
  const stamp = Date.now();
  const filePath = `${SUPABASE_FOLDER}/${safeBase}-${stamp}${ext}`;

  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": file.mimetype || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to upload to Supabase Storage.");
  }

  return { bucket: SUPABASE_BUCKET, filePath };
};

const deleteFromSupabase = async (bucket, filePath) => {
  if (!bucket || !filePath) return;
  ensureSupabaseConfig();
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to remove file from storage.");
  }
};

router.get("/stats", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [{ rows: totalRows }, { rows: myRows }, { rows: recentRows }] =
      await Promise.all([
        query("SELECT COUNT(*)::int AS total FROM resources"),
        query(
          "SELECT COUNT(*)::int AS total FROM resources WHERE user_id = $1",
          [userId],
        ),
        query(
          `SELECT r.id,
                  r.name,
                  r.subject,
                  r.file_type AS "type",
          r.file_size AS "size",
          r.resource_date AS "resourceDate",
          r.levels,
          r.bucket,
          r.file_path AS "filePath",
          r.file_url AS "url",
          r.user_id AS "ownerId",
          p.first_name AS "firstName",
                  p.last_name AS "lastName"
             FROM resources r
             LEFT JOIN user_profiles p ON p.user_id = r.user_id
            ORDER BY r.created_at DESC NULLS LAST, r.resource_date DESC NULLS LAST
            LIMIT 5`,
        ),
      ]);

    return res.json({
      stats: {
        totalResources: totalRows[0]?.total || 0,
        myUploads: myRows[0]?.total || 0,
      },
      recent: recentRows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        levels: row.levels || [],
        url: row.url || buildPublicUrl(row.bucket, row.filePath),
        uploadedBy: [row.firstName, row.lastName].filter(Boolean).join(" ") || "User",
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/resources", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { rows } = await query(
      `SELECT r.id,
              r.name,
              r.subject,
              r.file_type AS "type",
          r.file_size AS "size",
          r.resource_date AS "resourceDate",
          r.levels,
          r.bucket,
          r.file_path AS "filePath",
          r.file_url AS "url",
          r.user_id AS "ownerId",
          p.first_name AS "firstName",
              p.last_name AS "lastName"
         FROM resources r
         LEFT JOIN user_profiles p ON p.user_id = r.user_id
        ORDER BY r.created_at DESC NULLS LAST, r.resource_date DESC NULLS LAST`,
    );

    return res.json({
      resources: rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        levels: row.levels || [],
        url: row.url || buildPublicUrl(row.bucket, row.filePath),
        uploadedBy: [row.firstName, row.lastName].filter(Boolean).join(" ") || "User",
        ownerId: row.ownerId,
        canEdit: row.ownerId === userId,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/resources", upload.single("file"), async (req, res, next) => {
  try {
    const { name, subject, resourceDate, levels } = req.body || {};
    if (!name || !subject) {
      return res.status(400).json({ error: "name and subject are required." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "file is required." });
    }

    const levelList = normalizeLevels(levels);
    if (levelList.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one level is required." });
    }

    const { bucket, filePath } = await uploadToSupabase(req.file);
    const ext = path.extname(req.file.originalname || "")
      .replace(".", "")
      .toUpperCase();
    const type =
      ext || req.file.mimetype?.split("/")?.[1]?.toUpperCase() || "FILE";
    const size = formatBytes(req.file.size);

    const { rows } = await query(
      `INSERT INTO resources (
          user_id, name, subject, file_type, file_size, resource_date,
          bucket, file_path, levels
        )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, now()::date), $7, $8, $9)
       RETURNING id, name, subject,
                 file_type AS "type",
                 file_size AS "size",
                 resource_date AS "resourceDate",
                 levels,
                 bucket, file_path AS "filePath"`,
      [
        req.user.id,
        name,
        subject,
        type,
        size,
        resourceDate || null,
        bucket,
        filePath,
        levelList,
      ],
    );

    const row = rows[0];
    return res.status(201).json({
      resource: {
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        levels: row.levels || [],
        url: buildPublicUrl(row.bucket, row.filePath),
        uploadedBy: req.user.email,
        ownerId: req.user.id,
        canEdit: true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/resources/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, subject, levels } = req.body || {};
    const levelList = normalizeLevels(levels);
    if (!name && !subject && levelList.length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const { rows } = await query(
      `UPDATE resources
          SET name = COALESCE($2, name),
              subject = COALESCE($3, subject),
              levels = CASE
                WHEN $4::text[] IS NULL OR array_length($4::text[], 1) = 0
                  THEN levels
                ELSE $4::text[]
              END
        WHERE id = $1
          AND user_id = $5
      RETURNING id, name, subject,
                file_type AS "type",
                file_size AS "size",
                resource_date AS "resourceDate",
                levels,
                bucket, file_path AS "filePath",
                file_url AS "url"`,
      [id, name || null, subject || null, levelList, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Resource not found." });
    }

    const row = rows[0];
    return res.json({
      resource: {
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        levels: row.levels || [],
        url: row.url || buildPublicUrl(row.bucket, row.filePath),
        ownerId: req.user.id,
        canEdit: true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/resources/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT bucket, file_path AS "filePath"
         FROM resources
        WHERE id = $1
          AND user_id = $2`,
      [id, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Resource not found." });
    }

    await deleteFromSupabase(rows[0].bucket, rows[0].filePath);
    await query("DELETE FROM resources WHERE id = $1 AND user_id = $2", [
      id,
      req.user.id,
    ]);

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
