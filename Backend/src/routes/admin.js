import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import XLSX from "xlsx";
import pool, { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../utils/audit.js";
import {
  extractTimetableFromImageWithGemini,
  isGeminiEnabled,
} from "../utils/gemini.js";

dotenv.config();

const router = express.Router();
router.use(requireAuth, requireRole(["admin"]));
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => UUID_REGEX.test(String(value || ""));

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

const formatDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return null;
  return `${value}%`;
};

const clamp = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const toTextOrNull = (value) => {
  const text = String(value || "").trim();
  return text ? text : null;
};

const buildPublicResourceUrl = (bucket, filePath) => {
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

const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);
const ALLOWED_REQUEST_STATUSES = new Set(["pending", "approved", "rejected"]);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_LOOKUP = new Map([
  ["mon", 0],
  ["monday", 0],
  ["tue", 1],
  ["tues", 1],
  ["tuesday", 1],
  ["wed", 2],
  ["wednesday", 2],
  ["thu", 3],
  ["thur", 3],
  ["thurs", 3],
  ["thursday", 3],
  ["fri", 4],
  ["friday", 4],
  ["sat", 5],
  ["saturday", 5],
  ["sun", 6],
  ["sunday", 6],
]);

const TIMETABLE_ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const TIMETABLE_ALLOWED_EXTENSIONS = new Set([
  ".csv",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const normalizeHeaderToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toTimeString = (hours, minutes) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

const formatTime = (value) => (value ? String(value).slice(0, 5) : null);

const timeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};

const parseDayValue = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const whole = Math.trunc(numeric);
    if (whole >= 0 && whole <= 6) return whole;
    if (whole >= 1 && whole <= 7) return whole - 1;
  }

  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
  if (!text) return null;

  if (DAY_LOOKUP.has(text)) return DAY_LOOKUP.get(text);
  const short = text.slice(0, 3);
  if (DAY_LOOKUP.has(short)) return DAY_LOOKUP.get(short);

  return null;
};

const parseTimeValue = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toTimeString(value.getHours(), value.getMinutes());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60) % (24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return toTimeString(hours, minutes);
    }

    if (value >= 1 && value < 24) {
      const totalMinutes = Math.round(value * 60);
      const boundedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
      const hours = Math.floor(boundedMinutes / 60);
      const minutes = boundedMinutes % 60;
      return toTimeString(hours, minutes);
    }

    const fraction = ((value % 1) + 1) % 1;
    const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return toTimeString(hours, minutes);
  }

  const text = String(value || "").trim();
  if (!text) return null;

  const basicMatch = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?$/,
  );
  if (basicMatch) {
    let hours = Number(basicMatch[1]);
    const minutes = Number(basicMatch[2] || "0");
    const period = String(basicMatch[3] || "").toLowerCase();

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (minutes < 0 || minutes > 59) return null;

    if (period) {
      if (hours < 1 || hours > 12) return null;
      if (period === "pm" && hours !== 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;
    } else if (hours < 0 || hours > 23) {
      return null;
    }

    return toTimeString(hours, minutes);
  }

  const dateAttempt = new Date(`1970-01-01T${text}`);
  if (!Number.isNaN(dateAttempt.getTime())) {
    return toTimeString(dateAttempt.getHours(), dateAttempt.getMinutes());
  }

  return null;
};

const parseTimeRange = (value) => {
  const text = String(value || "").trim();
  if (!text) return { startTime: null, endTime: null };

  const parts = text
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { startTime: null, endTime: null };

  return {
    startTime: parseTimeValue(parts[0]),
    endTime: parseTimeValue(parts[1]),
  };
};

const isRowEmpty = (row) => {
  if (!row || typeof row !== "object") return true;
  return Object.values(row).every(
    (value) => String(value === null || value === undefined ? "" : value).trim() === "",
  );
};

const pickFromRow = (rowMap, keys) => {
  for (const key of keys) {
    const token = normalizeHeaderToken(key);
    if (rowMap.has(token)) return rowMap.get(token);
  }
  return null;
};

const DAY_KEYS = ["day", "weekday", "dayofweek", "week_day", "week day"];
const START_KEYS = [
  "start",
  "starttime",
  "start time",
  "from",
  "timefrom",
  "begin",
  "begin time",
];
const END_KEYS = [
  "end",
  "endtime",
  "end time",
  "to",
  "timeto",
  "finish",
  "finish time",
];
const RANGE_KEYS = ["time", "timerange", "time range", "slot", "period"];
const TITLE_KEYS = [
  "title",
  "subject",
  "class",
  "course",
  "lesson",
  "activity",
  "topic",
  "session",
];
const ROOM_KEYS = ["room", "location", "venue", "classroom", "hall"];
const INSTRUCTOR_KEYS = ["instructor", "teacher", "lecturer", "tutor", "staff"];

const parseImportedScheduleRows = (rows, { defaultInstructor } = {}) => {
  if (!Array.isArray(rows)) return { classes: [], skipped: [] };

  const classes = [];
  const skipped = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (isRowEmpty(row)) return;

    const rowMap = new Map(
      Object.entries(row || {}).map(([key, value]) => [
        normalizeHeaderToken(key),
        value,
      ]),
    );

    const dayRaw = pickFromRow(rowMap, DAY_KEYS);
    const startRaw = pickFromRow(rowMap, START_KEYS);
    const endRaw = pickFromRow(rowMap, END_KEYS);
    const rangeRaw = pickFromRow(rowMap, RANGE_KEYS);
    const titleRaw = pickFromRow(rowMap, TITLE_KEYS);
    const roomRaw = pickFromRow(rowMap, ROOM_KEYS);
    const instructorRaw = pickFromRow(rowMap, INSTRUCTOR_KEYS);

    const day = parseDayValue(dayRaw);

    const rangeTimes = parseTimeRange(rangeRaw);
    const startTime = parseTimeValue(startRaw) || rangeTimes.startTime;
    const endTime = parseTimeValue(endRaw) || rangeTimes.endTime;
    const title = toTextOrNull(titleRaw);
    const room = toTextOrNull(roomRaw);
    const instructor = toTextOrNull(instructorRaw) || toTextOrNull(defaultInstructor);

    if (day === null) {
      skipped.push({ row: rowNumber, reason: "Missing or invalid day value." });
      return;
    }
    if (!startTime || !endTime) {
      skipped.push({ row: rowNumber, reason: "Missing or invalid start/end time." });
      return;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      skipped.push({
        row: rowNumber,
        reason: "End time must be later than start time.",
      });
      return;
    }

    if (!title) {
      skipped.push({ row: rowNumber, reason: "Missing class title/subject." });
      return;
    }

    if (classes.length >= 300) {
      skipped.push({ row: rowNumber, reason: "Maximum 300 rows are allowed." });
      return;
    }

    classes.push({
      day,
      startTime,
      endTime,
      title: title.slice(0, 220),
      room: room ? room.slice(0, 120) : null,
      instructor: instructor ? instructor.slice(0, 120) : null,
    });
  });

  return { classes, skipped };
};

const parseBooleanInput = (value) => {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "on";
};

const resolveTeacherById = async (teacherId) => {
  const { rows } = await query(
    `SELECT u.id,
            u.email,
            p.first_name AS "firstName",
            p.last_name AS "lastName"
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1
        AND u.role = 'teacher'`,
    [teacherId],
  );

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name:
      [row.firstName, row.lastName].filter(Boolean).join(" ") ||
      row.email ||
      "Teacher",
  };
};

const mapScheduleClass = (row) => ({
  id: row.id,
  day: row.day,
  dayLabel: DAY_LABELS[row.day] || `Day ${row.day}`,
  startTime: formatTime(row.startTime),
  endTime: formatTime(row.endTime),
  title: row.title,
  room: row.room || null,
  instructor: row.instructor || null,
});

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const timetableStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeBase = path
      .basename(file.originalname || "timetable", ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 40);
    cb(null, `${safeBase || "timetable"}-${Date.now()}${ext}`);
  },
});

const timetableUpload = multer({
  storage: timetableStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const ext = path.extname(file?.originalname || "").toLowerCase();
    const allowed =
      TIMETABLE_ALLOWED_MIME_TYPES.has(mime) ||
      TIMETABLE_ALLOWED_EXTENSIONS.has(ext);
    if (!allowed) {
      return cb(
        new Error("Only Excel, CSV, or image timetable files are allowed."),
      );
    }
    return cb(null, true);
  },
});

const removeUploadedFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (_) {
  }
};

router.get("/search", async (req, res, next) => {
  try {
    const queryText = String(req.query.q || "").trim();
    if (!queryText) {
      return res.json({
        query: "",
        results: {
          users: [],
          requests: [],
          resources: [],
          lessons: [],
        },
      });
    }

    const likeQuery = `%${queryText}%`;

    const [usersResult, requestsResult, resourcesResult, lessonsResult] =
      await Promise.all([
        query(
          `SELECT u.id,
                  u.email,
                  u.role,
                  u.email_verified AS "emailVerified",
                  u.created_at AS "createdAt",
                  p.first_name AS "firstName",
                  p.last_name AS "lastName"
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE (u.email ILIKE $1 OR p.first_name ILIKE $1 OR p.last_name ILIKE $1)
            ORDER BY u.created_at DESC
            LIMIT 6`,
          [likeQuery],
        ),
        query(
          `SELECT id,
                  full_name AS "fullName",
                  email,
                  school,
                  status,
                  created_at AS "createdAt"
             FROM access_requests
            WHERE (full_name ILIKE $1 OR email ILIKE $1 OR school ILIKE $1)
            ORDER BY created_at DESC
            LIMIT 6`,
          [likeQuery],
        ),
        query(
          `SELECT id,
                  name,
                  subject,
                  file_type AS "type",
                  created_at AS "createdAt"
             FROM resources
            WHERE (name ILIKE $1 OR subject ILIKE $1)
            ORDER BY created_at DESC NULLS LAST
            LIMIT 6`,
          [likeQuery],
        ),
        query(
          `SELECT l.id,
                  c.grade_level AS "gradeLevel",
                  c.class_name AS "className",
                  s.name AS subject,
                  l.topic,
                  l.updated_at AS "updatedAt"
             FROM class_subject_lessons l
             JOIN classes c ON c.id = l.class_id
             JOIN subjects s ON s.id = l.subject_id
            WHERE (c.class_name ILIKE $1 OR c.grade_level ILIKE $1 OR s.name ILIKE $1 OR l.topic ILIKE $1)
            ORDER BY l.updated_at DESC
            LIMIT 6`,
          [likeQuery],
        ),
      ]);

    return res.json({
      query: queryText,
      results: {
        users: usersResult.rows.map((row) => ({
          id: row.id,
          title:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.email ||
            "User",
          subtitle: [row.role, row.emailVerified ? "verified" : "unverified"]
            .filter(Boolean)
            .join(" | "),
          route: `/admin/users?userId=${row.id}`,
        })),
        requests: requestsResult.rows.map((row) => ({
          id: row.id,
          title: row.fullName || row.email || "Access request",
          subtitle: [row.email, row.status, formatShortDate(row.createdAt)]
            .filter(Boolean)
            .join(" | "),
          route: `/admin/requests?requestId=${row.id}`,
        })),
        resources: resourcesResult.rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: [row.subject, row.type].filter(Boolean).join(" | "),
          route: `/admin/resources?resourceId=${row.id}`,
        })),
        lessons: lessonsResult.rows.map((row) => ({
          id: row.id,
          title: `${row.gradeLevel || ""} ${row.className || ""} - ${row.subject || "Subject"}`.trim(),
          subtitle: row.topic || null,
          route: `/admin/settings?lessonId=${row.id}`,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const roleParam = String(req.query.role || "").trim().toLowerCase();
    const roleFilter = ALLOWED_ROLES.has(roleParam) ? roleParam : null;
    const queryText = String(req.query.q || "").trim();
    const likeQuery = queryText ? `%${queryText}%` : null;
    const limit = clamp(req.query.limit || 50, 1, 200);
    const offset = clamp(req.query.offset || 0, 0, 200000);

    const [countResult, rowsResult, roleCountsResult] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE ($1::text IS NULL OR u.role = $1)
            AND (
              $2::text IS NULL
              OR u.email ILIKE $2
              OR p.first_name ILIKE $2
              OR p.last_name ILIKE $2
              OR p.staff_number ILIKE $2
              OR p.student_id ILIKE $2
            )`,
        [roleFilter, likeQuery],
      ),
      query(
        `SELECT u.id,
                u.email,
                u.role,
                u.email_verified AS "emailVerified",
                u.created_at AS "createdAt",
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                p.avatar_url AS "avatarUrl",
                p.grade_level AS "gradeLevel",
                p.class_name AS "className",
                p.staff_number AS "staffNumber",
                p.student_id AS "studentIdLabel",
                COALESCE(s.name, p.school_name) AS "schoolName"
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN schools s ON s.id = p.school_id
          WHERE ($1::text IS NULL OR u.role = $1)
            AND (
              $2::text IS NULL
              OR u.email ILIKE $2
              OR p.first_name ILIKE $2
              OR p.last_name ILIKE $2
              OR p.staff_number ILIKE $2
              OR p.student_id ILIKE $2
            )
          ORDER BY u.created_at DESC
          LIMIT $3 OFFSET $4`,
        [roleFilter, likeQuery, limit, offset],
      ),
      query(
        `SELECT role, COUNT(*)::int AS total
           FROM users
          GROUP BY role`,
      ),
    ]);

    const total = countResult.rows[0]?.total || 0;
    const roleCounts = roleCountsResult.rows.reduce((acc, row) => {
      const key = String(row.role || "").trim().toLowerCase();
      if (!key) return acc;
      acc[key] = row.total || 0;
      return acc;
    }, {});

    return res.json({
      total,
      roleCounts: {
        student: roleCounts.student || 0,
        teacher: roleCounts.teacher || 0,
        admin: roleCounts.admin || 0,
      },
      users: rowsResult.rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        emailVerified: Boolean(row.emailVerified),
        createdAt: formatShortDate(row.createdAt),
        createdAtRaw: row.createdAt,
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "User",
        avatarUrl: row.avatarUrl || null,
        schoolName: row.schoolName || null,
        gradeLevel: row.gradeLevel || null,
        className: row.className || null,
        staffNumber: row.staffNumber || null,
        studentIdLabel: row.studentIdLabel || null,
      })),
      limit,
      offset,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!isUuid(userId)) {
      return res.status(400).json({ error: "Invalid user id." });
    }

    const { role, emailVerified } = req.body || {};
    const nextRole = String(role || "").trim().toLowerCase();
    const roleValue = ALLOWED_ROLES.has(nextRole) ? nextRole : null;

    const emailVerifiedValue =
      typeof emailVerified === "boolean" ? emailVerified : null;

    if (roleValue === null && emailVerifiedValue === null) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    if (userId === req.user.id && roleValue && roleValue !== "admin") {
      return res.status(400).json({
        error: "You cannot remove your own admin role.",
      });
    }

    const { rows: updatedRows } = await query(
      `UPDATE users
          SET role = COALESCE($2, role),
              email_verified = COALESCE($3, email_verified)
        WHERE id = $1
        RETURNING id, email, role, email_verified AS "emailVerified"`,
      [userId, roleValue, emailVerifiedValue],
    );

    if (!updatedRows[0]) {
      return res.status(404).json({ error: "User not found." });
    }

    await logAudit(req, "admin_user_update", {
      userId,
      role: roleValue || undefined,
      emailVerified: emailVerifiedValue === null ? undefined : emailVerifiedValue,
    });

    const { rows } = await query(
      `SELECT u.id,
              u.email,
              u.role,
              u.email_verified AS "emailVerified",
              u.created_at AS "createdAt",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.avatar_url AS "avatarUrl",
              p.grade_level AS "gradeLevel",
              p.class_name AS "className",
              COALESCE(s.name, p.school_name) AS "schoolName"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN schools s ON s.id = p.school_id
        WHERE u.id = $1`,
      [userId],
    );
    const row = rows[0] || updatedRows[0];

    return res.json({
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        emailVerified: Boolean(row.emailVerified),
        createdAt: formatShortDate(row.createdAt),
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "User",
        avatarUrl: row.avatarUrl || null,
        schoolName: row.schoolName || null,
        gradeLevel: row.gradeLevel || null,
        className: row.className || null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/requests", async (req, res, next) => {
  try {
    const statusParam = String(req.query.status || "").trim().toLowerCase();
    const statusFilter = ALLOWED_REQUEST_STATUSES.has(statusParam)
      ? statusParam
      : null;
    const queryText = String(req.query.q || "").trim();
    const likeQuery = queryText ? `%${queryText}%` : null;
    const limit = clamp(req.query.limit || 50, 1, 200);
    const offset = clamp(req.query.offset || 0, 0, 200000);

    const [countResult, rowsResult, statusCountsResult] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           FROM access_requests ar
          WHERE ($1::text IS NULL OR ar.status = $1)
            AND (
              $2::text IS NULL
              OR ar.full_name ILIKE $2
              OR ar.email ILIKE $2
              OR ar.school ILIKE $2
            )`,
        [statusFilter, likeQuery],
      ),
      query(
        `SELECT ar.id,
                ar.full_name AS "fullName",
                ar.email,
                COALESCE(s.name, ar.school) AS school,
                ar.status,
                ar.created_at AS "createdAt"
           FROM access_requests ar
           LEFT JOIN schools s ON s.id = ar.school_id
          WHERE ($1::text IS NULL OR ar.status = $1)
            AND (
              $2::text IS NULL
              OR ar.full_name ILIKE $2
              OR ar.email ILIKE $2
              OR ar.school ILIKE $2
            )
          ORDER BY ar.created_at DESC
          LIMIT $3 OFFSET $4`,
        [statusFilter, likeQuery, limit, offset],
      ),
      query(
        `SELECT status, COUNT(*)::int AS total
           FROM access_requests
          GROUP BY status`,
      ),
    ]);

    return res.json({
      total: countResult.rows[0]?.total || 0,
      statusCounts: statusCountsResult.rows.reduce((acc, row) => {
        const key = String(row.status || "").trim().toLowerCase();
        if (!key) return acc;
        acc[key] = row.total || 0;
        return acc;
      }, {}),
      requests: rowsResult.rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        school: row.school,
        status: row.status,
        createdAt: formatShortDate(row.createdAt),
        createdAtRaw: row.createdAt,
      })),
      limit,
      offset,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/requests/:id", async (req, res, next) => {
  try {
    const requestId = req.params.id;
    if (!isUuid(requestId)) {
      return res.status(400).json({ error: "Invalid request id." });
    }

    const { status } = req.body || {};
    const statusValue = String(status || "").trim().toLowerCase();
    if (!ALLOWED_REQUEST_STATUSES.has(statusValue)) {
      return res.status(400).json({
        error: "Invalid status. Use pending, approved, or rejected.",
      });
    }

    const { rows } = await query(
      `UPDATE access_requests
          SET status = $2
        WHERE id = $1
        RETURNING id,
                  full_name AS "fullName",
                  email,
                  school,
                  status,
                  created_at AS "createdAt"`,
      [requestId, statusValue],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Access request not found." });
    }

    await logAudit(req, "admin_access_request_update", {
      requestId,
      status: statusValue,
    });

    return res.json({
      request: {
        id: rows[0].id,
        fullName: rows[0].fullName,
        email: rows[0].email,
        school: rows[0].school,
        status: rows[0].status,
        createdAt: formatShortDate(rows[0].createdAt),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/resources", async (req, res, next) => {
  try {
    const subjectFilter = toTextOrNull(req.query.subject);
    const queryText = String(req.query.q || "").trim();
    const likeQuery = queryText ? `%${queryText}%` : null;
    const limit = clamp(req.query.limit || 60, 1, 200);
    const offset = clamp(req.query.offset || 0, 0, 200000);

    const [countResult, rowsResult] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           FROM resources r
          WHERE ($1::text IS NULL OR r.subject = $1)
            AND (
              $2::text IS NULL
              OR r.name ILIKE $2
              OR r.subject ILIKE $2
              OR COALESCE(r.file_type, '') ILIKE $2
            )`,
        [subjectFilter, likeQuery],
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
                u.email AS "ownerEmail",
                p.first_name AS "firstName",
                p.last_name AS "lastName"
           FROM resources r
           LEFT JOIN users u ON u.id = r.user_id
           LEFT JOIN user_profiles p ON p.user_id = r.user_id
          WHERE ($1::text IS NULL OR r.subject = $1)
            AND (
              $2::text IS NULL
              OR r.name ILIKE $2
              OR r.subject ILIKE $2
              OR COALESCE(r.file_type, '') ILIKE $2
            )
          ORDER BY r.created_at DESC NULLS LAST, r.resource_date DESC NULLS LAST
          LIMIT $3 OFFSET $4`,
        [subjectFilter, likeQuery, limit, offset],
      ),
    ]);

    return res.json({
      total: countResult.rows[0]?.total || 0,
      resources: rowsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type || null,
        size: row.size || null,
        date: formatShortDate(row.resourceDate),
        levels: row.levels || [],
        url: row.url || buildPublicResourceUrl(row.bucket, row.filePath),
        bucket: row.bucket || null,
        filePath: row.filePath || null,
        ownerId: row.ownerId || null,
        uploadedBy:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.ownerEmail ||
          "User",
      })),
      limit,
      offset,
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/resources/:id", async (req, res, next) => {
  try {
    const resourceId = req.params.id;
    if (!isUuid(resourceId)) {
      return res.status(400).json({ error: "Invalid resource id." });
    }

    const { rows } = await query(
      `SELECT id,
              name,
              bucket,
              file_path AS "filePath"
         FROM resources
        WHERE id = $1`,
      [resourceId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Resource not found." });
    }

    const resource = rows[0];
    if (resource.bucket && resource.filePath) {
      await deleteFromSupabase(resource.bucket, resource.filePath);
    }

    await query(`DELETE FROM resources WHERE id = $1`, [resourceId]);
    await logAudit(req, "admin_resource_delete", {
      resourceId,
      name: resource.name,
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/classes", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id,
              c.grade_level AS "gradeLevel",
              c.class_name AS "className",
              COALESCE(s.name, c.school_name) AS "schoolName",
              c.school_id AS "schoolId"
         FROM classes c
         LEFT JOIN schools s ON s.id = c.school_id
        ORDER BY c.grade_level, c.class_name`,
    );

    return res.json({
      classes: rows.map((row) => ({
        id: row.id,
        gradeLevel: row.gradeLevel,
        className: row.className,
        schoolName: row.schoolName || null,
        schoolId: row.schoolId || null,
        label: `${row.gradeLevel || "--"} ${row.className || "--"}`.trim(),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/subjects", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, code, category
         FROM subjects
        ORDER BY name`,
    );

    return res.json({
      subjects: rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code || null,
        category: row.category || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/teachers", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id,
              u.email,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.department
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'teacher'
        ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
    );

    return res.json({
      teachers: rows.map((row) => ({
        id: row.id,
        email: row.email,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "Teacher",
        department: row.department || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/curriculum", async (req, res, next) => {
  try {
    const classId = String(req.query.classId || "").trim();
    const subjectId = String(req.query.subjectId || "").trim();
    const teacherId = String(req.query.teacherId || "").trim();

    if (classId && !isUuid(classId)) {
      return res.status(400).json({ error: "Invalid class id." });
    }
    if (subjectId && !isUuid(subjectId)) {
      return res.status(400).json({ error: "Invalid subject id." });
    }
    if (teacherId && !isUuid(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher id." });
    }

    const [lessonResult, progressResult, assessmentResult] = await Promise.all([
      query(
        `SELECT l.id,
                l.class_id AS "classId",
                l.subject_id AS "subjectId",
                l.teacher_id AS "teacherId",
                c.class_name AS "className",
                c.grade_level AS "gradeLevel",
                s.name AS "subjectName",
                l.term,
                l.week_number AS "weekNumber",
                l.unit_title AS "unitTitle",
                l.lesson_number AS "lessonNumber",
                l.topic,
                l.effective_date AS "effectiveDate",
                l.updated_at AS "updatedAt",
                p.first_name AS "teacherFirstName",
                p.last_name AS "teacherLastName",
                u.email AS "teacherEmail"
           FROM class_subject_lessons l
           JOIN classes c ON c.id = l.class_id
           JOIN subjects s ON s.id = l.subject_id
           LEFT JOIN users u ON u.id = l.teacher_id
           LEFT JOIN user_profiles p ON p.user_id = l.teacher_id
          WHERE ($1::uuid IS NULL OR l.class_id = $1)
            AND ($2::uuid IS NULL OR l.subject_id = $2)
            AND ($3::uuid IS NULL OR l.teacher_id = $3)
          ORDER BY c.grade_level, c.class_name, s.name, l.term NULLS LAST, l.week_number NULLS LAST`,
        [classId || null, subjectId || null, teacherId || null],
      ),
      query(
        `SELECT class_id AS "classId",
                subject_id AS "subjectId",
                teacher_id AS "teacherId",
                AVG(progress)::int AS "avgProgress"
           FROM student_subject_enrollments
          WHERE class_id IS NOT NULL
            AND subject_id IS NOT NULL
            AND ($1::uuid IS NULL OR class_id = $1)
            AND ($2::uuid IS NULL OR subject_id = $2)
            AND ($3::uuid IS NULL OR teacher_id = $3)
          GROUP BY class_id, subject_id, teacher_id`,
        [classId || null, subjectId || null, teacherId || null],
      ),
      query(
        `WITH student_base AS (
           SELECT u.id AS "studentId",
                  COALESCE(sp.class_id, up.class_id) AS "classId"
             FROM users u
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE u.role = 'student'
          )
          SELECT sb."classId",
                 COALESCE(a.subject_id, s.id) AS "subjectId",
                 a.teacher_id AS "teacherId",
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS completed,
                 AVG(a.grade_percent)::int AS "avgGrade"
            FROM assessments a
            JOIN student_base sb ON sb."studentId" = COALESCE(a.student_id, a.user_id)
            LEFT JOIN subjects s ON s.name = a.subject AND a.subject_id IS NULL
           WHERE sb."classId" IS NOT NULL
             AND COALESCE(a.subject_id, s.id) IS NOT NULL
             AND ($1::uuid IS NULL OR sb."classId" = $1)
             AND ($2::uuid IS NULL OR COALESCE(a.subject_id, s.id) = $2)
             AND ($3::uuid IS NULL OR a.teacher_id = $3)
           GROUP BY sb."classId", COALESCE(a.subject_id, s.id), a.teacher_id`,
        [classId || null, subjectId || null, teacherId || null],
      ),
    ]);

    const progressMap = new Map();
    for (const row of progressResult.rows) {
      const key = `${row.classId}:${row.subjectId}:${row.teacherId || "any"}`;
      progressMap.set(key, Number(row.avgProgress) || 0);
    }

    const assessmentMap = new Map();
    for (const row of assessmentResult.rows) {
      const key = `${row.classId}:${row.subjectId}:${row.teacherId || "any"}`;
      assessmentMap.set(key, {
        total: Number(row.total) || 0,
        completed: Number(row.completed) || 0,
        avgGrade: Number(row.avgGrade) || 0,
      });
    }

    const grouped = new Map();
    for (const row of lessonResult.rows) {
      const branchKey = `${row.classId}:${row.subjectId}:${row.term || "Current Term"}`;
      if (!grouped.has(branchKey)) {
        grouped.set(branchKey, {
          classId: row.classId,
          subjectId: row.subjectId,
          className: `${row.gradeLevel || ""} ${row.className || ""}`.trim(),
          subjectName: row.subjectName || "Subject",
          termName: row.term || "Current Term",
          units: [],
        });
      }

      const statsKey = `${row.classId}:${row.subjectId}:${row.teacherId || "any"}`;
      const statsFallbackKey = `${row.classId}:${row.subjectId}:any`;
      const progressValue =
        progressMap.get(statsKey) ??
        progressMap.get(statsFallbackKey) ??
        0;
      const assessmentStats =
        assessmentMap.get(statsKey) ??
        assessmentMap.get(statsFallbackKey) ?? { total: 0, completed: 0, avgGrade: 0 };
      const assessmentCompletionPct = assessmentStats.total
        ? clampPercent((assessmentStats.completed / assessmentStats.total) * 100)
        : 0;
      const completionPct = clampPercent(
        progressValue > 0 ? progressValue : assessmentCompletionPct,
      );
      const effectiveDate = row.effectiveDate ? new Date(row.effectiveDate) : null;
      const isDelayed =
        Boolean(effectiveDate) &&
        !Number.isNaN(effectiveDate.getTime()) &&
        Date.now() - effectiveDate.getTime() > 1000 * 60 * 60 * 24 * 14 &&
        completionPct < 80;

      grouped.get(branchKey).units.push({
        id: row.id,
        teacherId: row.teacherId,
        teacherName:
          [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(" ") ||
          row.teacherEmail ||
          "Unassigned",
        unitNumber: row.lessonNumber || row.weekNumber || null,
        unitTitle: row.unitTitle || row.topic || "Curriculum Unit",
        completionPct,
        assessmentCompletionPct,
        isDelayed,
        topics: [
          {
            id: `${row.id}-topic`,
            title: row.topic || "Topic",
            assessmentCompletionPct,
          },
        ],
      });
    }

    return res.json({
      tree: Array.from(grouped.values()),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/teacher-analytics", async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH teacher_base AS (
         SELECT u.id,
                u.email,
                p.first_name AS "firstName",
                p.last_name AS "lastName"
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE u.role = 'teacher'
       ),
       assignment_counts AS (
         SELECT teacher_id,
                COUNT(*)::int AS assignments
           FROM teacher_assignments
          GROUP BY teacher_id
       ),
       lesson_counts AS (
         SELECT COALESCE(teacher_id, updated_by) AS teacher_id,
                COUNT(*)::int AS lessons,
                COUNT(*) FILTER (WHERE updated_at >= now() - interval '30 days')::int AS "recentLessons"
           FROM class_subject_lessons
          WHERE COALESCE(teacher_id, updated_by) IS NOT NULL
          GROUP BY COALESCE(teacher_id, updated_by)
       ),
       assessment_stats AS (
         SELECT teacher_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
                AVG(grade_percent)::int AS "avgGrade"
           FROM assessments
          WHERE teacher_id IS NOT NULL
          GROUP BY teacher_id
       ),
       weak_topic_stats AS (
         SELECT teacher_id,
                weak_area,
                COUNT(*)::int AS hits,
                ROW_NUMBER() OVER (
                  PARTITION BY teacher_id
                  ORDER BY COUNT(*) DESC, weak_area
                ) AS rank
           FROM assessments
          WHERE teacher_id IS NOT NULL
            AND weak_area IS NOT NULL
            AND btrim(weak_area) <> ''
          GROUP BY teacher_id, weak_area
       ),
       login_stats AS (
         SELECT user_id AS teacher_id,
                MAX(created_at) AS "lastLoginAt"
           FROM audit_logs
          WHERE action IN ('login_success', 'login')
          GROUP BY user_id
       )
       SELECT t.id,
              t.email,
              t."firstName",
              t."lastName",
              COALESCE(ac.assignments, 0) AS assignments,
              COALESCE(lc.lessons, 0) AS lessons,
              COALESCE(lc."recentLessons", 0) AS "recentLessons",
              COALESCE(ast.total, 0) AS "assessmentTotal",
              COALESCE(ast.completed, 0) AS "assessmentCompleted",
              ast."avgGrade",
              ls."lastLoginAt",
              COALESCE(
                ARRAY_AGG(wts.weak_area ORDER BY wts.hits DESC, wts.weak_area)
                  FILTER (WHERE wts.rank <= 5),
                ARRAY[]::text[]
              ) AS "weakTopics"
         FROM teacher_base t
         LEFT JOIN assignment_counts ac ON ac.teacher_id = t.id
         LEFT JOIN lesson_counts lc ON lc.teacher_id = t.id
         LEFT JOIN assessment_stats ast ON ast.teacher_id = t.id
         LEFT JOIN weak_topic_stats wts ON wts.teacher_id = t.id
         LEFT JOIN login_stats ls ON ls.teacher_id = t.id
        GROUP BY t.id, t.email, t."firstName", t."lastName", ac.assignments, lc.lessons,
                 lc."recentLessons", ast.total, ast.completed, ast."avgGrade", ls."lastLoginAt"
        ORDER BY t."firstName" NULLS LAST, t."lastName" NULLS LAST, t.email`,
    );

    return res.json({
      teachers: rows.map((row) => {
        const consistency = row.assignments
          ? clampPercent((Number(row.recentLessons) / Number(row.assignments)) * 100)
          : row.recentLessons > 0
            ? 100
            : 0;
        const completionRate = row.assessmentTotal
          ? clampPercent(
              (Number(row.assessmentCompleted) / Number(row.assessmentTotal)) * 100,
            )
          : 0;
        return {
          id: row.id,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.email ||
            "Teacher",
          lessonLoggingConsistency: consistency,
          assessmentCompletionRate: completionRate,
          averageStudentPerformance: row.avgGrade || 0,
          recurringWeakTopicCount: Array.isArray(row.weakTopics) ? row.weakTopics.length : 0,
          weakTopics: Array.isArray(row.weakTopics) ? row.weakTopics : [],
          lastLogin: row.lastLoginAt ? formatDateTime(row.lastLoginAt) : null,
          lastLoginAt: row.lastLoginAt || null,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const userId = String(req.query.userId || "").trim();
    const action = String(req.query.action || "").trim();
    const dateFrom = String(req.query.dateFrom || "").trim();
    const dateTo = String(req.query.dateTo || "").trim();
    const queryText = String(req.query.q || "").trim();
    const likeQuery = queryText ? `%${queryText}%` : null;
    const limit = clamp(req.query.limit || 200, 1, 500);
    const offset = clamp(req.query.offset || 0, 0, 200000);

    if (userId && !isUuid(userId)) {
      return res.status(400).json({ error: "Invalid user id." });
    }
    if (action && !AUDIT_ACTION_FILTER.test(action)) {
      return res.status(400).json({ error: "Invalid action filter." });
    }

    const fromValue = dateFrom ? new Date(dateFrom) : null;
    const toValue = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : null;
    if (fromValue && Number.isNaN(fromValue.getTime())) {
      return res.status(400).json({ error: "Invalid dateFrom." });
    }
    if (toValue && Number.isNaN(toValue.getTime())) {
      return res.status(400).json({ error: "Invalid dateTo." });
    }

    const fromIso = fromValue ? fromValue.toISOString() : null;
    const toIso = toValue ? toValue.toISOString() : null;

    const [countResult, rowsResult, actionResult] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
           LEFT JOIN user_profiles p ON p.user_id = a.user_id
          WHERE ($1::uuid IS NULL OR a.user_id = $1)
            AND ($2::text IS NULL OR a.action = $2)
            AND ($3::timestamptz IS NULL OR a.created_at >= $3)
            AND ($4::timestamptz IS NULL OR a.created_at <= $4)
            AND (
              $5::text IS NULL
              OR a.action ILIKE $5
              OR COALESCE(u.email, '') ILIKE $5
              OR COALESCE(p.first_name, '') ILIKE $5
              OR COALESCE(p.last_name, '') ILIKE $5
              OR COALESCE(a.context::text, '') ILIKE $5
            )`,
        [userId || null, action || null, fromIso, toIso, likeQuery],
      ),
      query(
        `SELECT a.id,
                a.user_id AS "userId",
                a.action,
                a.context,
                a.ip,
                a.user_agent AS "userAgent",
                a.created_at AS "createdAt",
                u.email,
                u.role,
                p.first_name AS "firstName",
                p.last_name AS "lastName"
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
           LEFT JOIN user_profiles p ON p.user_id = a.user_id
          WHERE ($1::uuid IS NULL OR a.user_id = $1)
            AND ($2::text IS NULL OR a.action = $2)
            AND ($3::timestamptz IS NULL OR a.created_at >= $3)
            AND ($4::timestamptz IS NULL OR a.created_at <= $4)
            AND (
              $5::text IS NULL
              OR a.action ILIKE $5
              OR COALESCE(u.email, '') ILIKE $5
              OR COALESCE(p.first_name, '') ILIKE $5
              OR COALESCE(p.last_name, '') ILIKE $5
              OR COALESCE(a.context::text, '') ILIKE $5
            )
          ORDER BY a.created_at DESC
          LIMIT $6 OFFSET $7`,
        [userId || null, action || null, fromIso, toIso, likeQuery, limit, offset],
      ),
      query(
        `SELECT action, COUNT(*)::int AS total
           FROM audit_logs
          GROUP BY action
          ORDER BY total DESC, action ASC`,
      ),
    ]);

    return res.json({
      total: countResult.rows[0]?.total || 0,
      actions: actionResult.rows.map((row) => ({
        action: row.action,
        total: row.total || 0,
      })),
      logs: rowsResult.rows.map((row) => {
        const context = row.context && typeof row.context === "object" ? row.context : {};
        const entity =
          context.entity ||
          context.resourceId ||
          context.userId ||
          context.requestId ||
          context.name ||
          null;
        return {
          id: row.id,
          userId: row.userId || null,
          userEmail: row.email || null,
          userName:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.email ||
            "Unknown",
          role: row.role || null,
          action: row.action,
          entity,
          timestamp: formatDateTime(row.createdAt),
          timestampRaw: row.createdAt,
          ipAddress: row.ip || null,
          device: row.userAgent || null,
          context,
        };
      }),
      limit,
      offset,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/profile", async (req, res, next) => {
  try {
    const [profileResult, settingsResult] = await Promise.all([
      query(
        `SELECT u.id,
                u.email,
                u.role,
                u.email_verified AS "emailVerified",
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                p.avatar_url AS "avatarUrl",
                COALESCE(s.name, p.school_name) AS "schoolName"
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN schools s ON s.id = p.school_id
          WHERE u.id = $1`,
        [req.user.id],
      ),
      query(
        `SELECT notifications_enabled AS "notifications",
                auto_sync AS "autoSync"
           FROM user_settings
          WHERE user_id = $1`,
        [req.user.id],
      ),
    ]);

    if (!profileResult.rows[0]) {
      return res.status(404).json({ error: "Profile not found." });
    }

    return res.json({
      user: profileResult.rows[0],
      settings: settingsResult.rows[0] || { notifications: true, autoSync: true },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/profile", async (req, res, next) => {
  try {
    const { firstName, lastName, schoolName, avatarUrl, settings } =
      req.body || {};

    const firstNameValue = toTextOrNull(firstName);
    const lastNameValue = toTextOrNull(lastName);
    const schoolNameValue = toTextOrNull(schoolName);
    const avatarUrlValue = toTextOrNull(avatarUrl);

    if (
      firstNameValue === null &&
      lastNameValue === null &&
      schoolNameValue === null &&
      avatarUrlValue === null &&
      typeof settings !== "object"
    ) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    if (
      firstNameValue !== null ||
      lastNameValue !== null ||
      schoolNameValue !== null ||
      avatarUrlValue !== null
    ) {
      const { rows } = await query(
        `UPDATE user_profiles
            SET first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                school_name = COALESCE($4, school_name),
                avatar_url = COALESCE($5, avatar_url),
                updated_at = now()
          WHERE user_id = $1
        RETURNING first_name AS "firstName",
                  last_name AS "lastName",
                  school_name AS "schoolName",
                  avatar_url AS "avatarUrl"`,
        [
          req.user.id,
          firstNameValue,
          lastNameValue,
          schoolNameValue,
          avatarUrlValue,
        ],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "Profile not found." });
      }
    }

    let savedSettings = null;
    if (settings && typeof settings === "object") {
      const notifications =
        typeof settings.notifications === "boolean"
          ? settings.notifications
          : null;
      const autoSync =
        typeof settings.autoSync === "boolean" ? settings.autoSync : null;
      const { rows } = await query(
        `INSERT INTO user_settings (user_id, notifications_enabled, auto_sync)
         VALUES ($1, COALESCE($2, true), COALESCE($3, true))
         ON CONFLICT (user_id)
         DO UPDATE SET
           notifications_enabled = COALESCE($2, user_settings.notifications_enabled),
           auto_sync = COALESCE($3, user_settings.auto_sync)
         RETURNING notifications_enabled AS "notifications",
                   auto_sync AS "autoSync"`,
        [req.user.id, notifications, autoSync],
      );
      savedSettings = rows[0] || null;
    }

    await logAudit(req, "admin_profile_update", {
      firstName: firstNameValue || undefined,
      lastName: lastNameValue || undefined,
      schoolName: schoolNameValue || undefined,
      avatarUrl: avatarUrlValue || undefined,
    });

    const { rows: profileRows } = await query(
      `SELECT u.id,
              u.email,
              u.role,
              u.email_verified AS "emailVerified",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.avatar_url AS "avatarUrl",
              COALESCE(s.name, p.school_name) AS "schoolName"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN schools s ON s.id = p.school_id
        WHERE u.id = $1`,
      [req.user.id],
    );

    return res.json({
      user: profileRows[0],
      settings: savedSettings,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const [profileResult, countsResult, trendResult, requestResult, userResult] =
      await Promise.all([
        query(
          `SELECT p.first_name AS "firstName",
                  p.last_name AS "lastName",
                  p.school_name AS "schoolName",
                  p.avatar_url AS "avatarUrl",
                  u.email
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.id = $1`,
          [req.user.id],
        ),
        query(
          `SELECT
              (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students,
              (SELECT COUNT(*)::int FROM users WHERE role = 'teacher') AS teachers,
              (SELECT COUNT(*)::int FROM resources) AS resources,
              (SELECT COUNT(*)::int FROM assessments) AS assessments`,
        ),
        query(
          `SELECT date_trunc('month', created_at) AS month,
                  COUNT(*)::int AS total
             FROM users
            WHERE created_at >= date_trunc('month', now()) - interval '5 months'
            GROUP BY month
            ORDER BY month`,
        ),
        query(
          `SELECT ar.id,
                  ar.full_name AS "fullName",
                  ar.email,
                  COALESCE(s.name, ar.school) AS school,
                  ar.status,
                  ar.created_at AS "createdAt"
             FROM access_requests ar
             LEFT JOIN schools s ON s.id = ar.school_id
            ORDER BY ar.created_at DESC
            LIMIT 6`,
        ),
        query(
          `SELECT u.id,
                  u.email,
                  u.role,
                  u.created_at AS "createdAt",
                  p.first_name AS "firstName",
                  p.last_name AS "lastName",
                  p.avatar_url AS "avatarUrl"
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            ORDER BY u.created_at DESC
            LIMIT 6`,
        ),
      ]);

    const profile = profileResult.rows[0] || {};
    const counts = countsResult.rows[0] || {
      students: 0,
      teachers: 0,
      resources: 0,
      assessments: 0,
    };

    const summary = [
      {
        label: "Students",
        current: counts.students || 0,
        total: counts.students || 0,
        percent: formatPercent(counts.students ? 100 : 0),
      },
      {
        label: "Teachers",
        current: counts.teachers || 0,
        total: counts.teachers || 0,
        percent: formatPercent(counts.teachers ? 100 : 0),
      },
      {
        label: "Resources",
        current: counts.resources || 0,
        total: counts.resources || 0,
        percent: formatPercent(counts.resources ? 100 : 0),
      },
      {
        label: "Assessments",
        current: counts.assessments || 0,
        total: counts.assessments || 0,
        percent: formatPercent(counts.assessments ? 100 : 0),
      },
    ];

    const trend = trendResult.rows.map((row) => ({
      label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        row.month,
      ),
      val: row.total,
    }));

    return res.json({
      admin: {
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          profile.email ||
          "Administrator",
        school: profile.schoolName || "School not set",
        avatarUrl: profile.avatarUrl || null,
        email: profile.email || null,
      },
      summary,
      trend,
      requests: requestResult.rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        school: row.school,
        status: row.status,
        createdAt: formatShortDate(row.createdAt),
      })),
      recentUsers: userResult.rows.map((row) => ({
        id: row.id,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "User",
        email: row.email,
        role: row.role,
        avatarUrl: row.avatarUrl,
        createdAt: formatShortDate(row.createdAt),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/lesson-progress", async (req, res, next) => {
  try {
    const { classId, subjectId } = req.query || {};
    const classFilter = String(classId || "").trim();
    const subjectFilter = String(subjectId || "").trim();
    if (classFilter && !isUuid(classFilter)) {
      return res.status(400).json({ error: "Invalid class id." });
    }
    if (subjectFilter && !isUuid(subjectFilter)) {
      return res.status(400).json({ error: "Invalid subject id." });
    }

    const { rows } = await query(
      `SELECT l.id,
              l.class_id AS "classId",
              l.subject_id AS "subjectId",
              c.class_name AS "className",
              c.grade_level AS "gradeLevel",
              s.name AS "subjectName",
              l.teacher_id AS "teacherId",
              tp.first_name AS "teacherFirstName",
              tp.last_name AS "teacherLastName",
              tu.email AS "teacherEmail",
              l.unit_title AS "unitTitle",
              l.lesson_number AS "lessonNumber",
              l.topic,
              l.page_from AS "pageFrom",
              l.page_to AS "pageTo",
              l.term,
              l.week_number AS "weekNumber",
              l.notes,
              l.effective_date AS "effectiveDate",
              l.updated_at AS "updatedAt"
         FROM class_subject_lessons l
         JOIN classes c ON c.id = l.class_id
         JOIN subjects s ON s.id = l.subject_id
         LEFT JOIN users tu ON tu.id = l.teacher_id
         LEFT JOIN user_profiles tp ON tp.user_id = l.teacher_id
        WHERE ($1::uuid IS NULL OR l.class_id = $1)
          AND ($2::uuid IS NULL OR l.subject_id = $2)
        ORDER BY c.grade_level, c.class_name, s.name`,
      [classFilter || null, subjectFilter || null],
    );

    return res.json({
      lessons: rows.map((row) => ({
        id: row.id,
        classId: row.classId,
        subjectId: row.subjectId,
        className: row.className,
        gradeLevel: row.gradeLevel,
        subject: row.subjectName,
        teacherId: row.teacherId,
        teacher:
          [row.teacherFirstName, row.teacherLastName]
            .filter(Boolean)
            .join(" ") || row.teacherEmail || null,
        unitTitle: row.unitTitle,
        lessonNumber: row.lessonNumber,
        topic: row.topic,
        pageFrom: row.pageFrom,
        pageTo: row.pageTo,
        term: row.term,
        weekNumber: row.weekNumber,
        notes: row.notes,
        effectiveDate: formatShortDate(row.effectiveDate),
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/lesson-progress", async (req, res, next) => {
  try {
    const {
      classId,
      subjectId,
      teacherId,
      unitTitle,
      lessonNumber,
      topic,
      pageFrom,
      pageTo,
      term,
      weekNumber,
      notes,
      effectiveDate,
    } = req.body || {};

    if (!isUuid(classId || "")) {
      return res.status(400).json({ error: "Valid classId is required." });
    }
    if (!isUuid(subjectId || "")) {
      return res.status(400).json({ error: "Valid subjectId is required." });
    }
    if (!String(topic || "").trim()) {
      return res.status(400).json({ error: "Topic is required." });
    }
    if (teacherId && !isUuid(teacherId)) {
      return res.status(400).json({ error: "Invalid teacherId." });
    }

    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const pageFromValue = toNumberOrNull(pageFrom);
    const pageToValue = toNumberOrNull(pageTo);
    if (
      pageFromValue !== null &&
      pageToValue !== null &&
      pageFromValue > pageToValue
    ) {
      return res.status(400).json({
        error: "pageFrom cannot be greater than pageTo.",
      });
    }

    const resolvedTeacherId = isUuid(teacherId || "") ? teacherId : null;
    const { rows } = await query(
      `INSERT INTO class_subject_lessons (
          class_id,
          subject_id,
          teacher_id,
          updated_by,
          unit_title,
          lesson_number,
          topic,
          page_from,
          page_to,
          term,
          week_number,
          notes,
          effective_date,
          updated_at
        )
       VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11, $12,
          COALESCE($13::date, CURRENT_DATE),
          now()
        )
       ON CONFLICT (class_id, subject_id)
       DO UPDATE SET
          teacher_id = COALESCE(EXCLUDED.teacher_id, class_subject_lessons.teacher_id),
          updated_by = EXCLUDED.updated_by,
          unit_title = EXCLUDED.unit_title,
          lesson_number = EXCLUDED.lesson_number,
          topic = EXCLUDED.topic,
          page_from = EXCLUDED.page_from,
          page_to = EXCLUDED.page_to,
          term = EXCLUDED.term,
          week_number = EXCLUDED.week_number,
          notes = EXCLUDED.notes,
          effective_date = EXCLUDED.effective_date,
          updated_at = now()
       RETURNING id,
                 class_id AS "classId",
                 subject_id AS "subjectId",
                 teacher_id AS "teacherId",
                 unit_title AS "unitTitle",
                 lesson_number AS "lessonNumber",
                 topic,
                 page_from AS "pageFrom",
                 page_to AS "pageTo",
                 term,
                 week_number AS "weekNumber",
                 notes,
                 effective_date AS "effectiveDate",
                 updated_at AS "updatedAt"`,
      [
        classId,
        subjectId,
        resolvedTeacherId,
        req.user.id,
        String(unitTitle || "").trim() || null,
        toNumberOrNull(lessonNumber),
        String(topic || "").trim().slice(0, 220),
        pageFromValue,
        pageToValue,
        String(term || "").trim() || null,
        toNumberOrNull(weekNumber),
        String(notes || "").trim() || null,
        String(effectiveDate || "").trim() || null,
      ],
    );

    return res.json({ lesson: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/teacher-schedule", async (req, res, next) => {
  try {
    const teacherId = String(req.query.teacherId || "").trim();
    if (!isUuid(teacherId)) {
      return res.status(400).json({ error: "Valid teacherId is required." });
    }

    const teacher = await resolveTeacherById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found." });
    }

    const { rows } = await query(
      `SELECT id,
              day_of_week AS "day",
              start_time AS "startTime",
              end_time AS "endTime",
              title,
              room,
              instructor
         FROM schedule_classes
        WHERE user_id = $1
        ORDER BY day_of_week, start_time`,
      [teacher.id],
    );

    return res.json({
      teacher,
      classes: rows.map(mapScheduleClass),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/teacher-schedule", async (req, res, next) => {
  try {
    const teacherId = String(req.body?.teacherId || "").trim();
    if (!isUuid(teacherId)) {
      return res.status(400).json({ error: "Valid teacherId is required." });
    }

    const teacher = await resolveTeacherById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found." });
    }

    const day = parseDayValue(req.body?.day);
    const startTime = parseTimeValue(req.body?.startTime);
    const endTime = parseTimeValue(req.body?.endTime);
    const title = toTextOrNull(req.body?.title);
    const room = toTextOrNull(req.body?.room);
    const instructor =
      toTextOrNull(req.body?.instructor) || toTextOrNull(teacher.name);

    if (day === null || !startTime || !endTime || !title) {
      return res.status(400).json({
        error: "day, startTime, endTime, and title are required.",
      });
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return res.status(400).json({
        error: "End time must be later than start time.",
      });
    }

    const { rows } = await query(
      `INSERT INTO schedule_classes (
          user_id,
          day_of_week,
          start_time,
          end_time,
          title,
          room,
          instructor
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id,
                 day_of_week AS "day",
                 start_time AS "startTime",
                 end_time AS "endTime",
                 title,
                 room,
                 instructor`,
      [teacher.id, day, startTime, endTime, title, room, instructor],
    );

    await logAudit(req, "admin_teacher_schedule_add", {
      teacherId: teacher.id,
      title,
      day,
      startTime,
      endTime,
    });

    return res.status(201).json({
      teacher,
      class: mapScheduleClass(rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/teacher-schedule/:id", async (req, res, next) => {
  try {
    const classId = String(req.params.id || "").trim();
    if (!isUuid(classId)) {
      return res.status(400).json({ error: "Invalid timetable class id." });
    }

    const teacherIdRaw = String(req.query.teacherId || "").trim();
    const teacherId = teacherIdRaw ? teacherIdRaw : null;
    if (teacherId && !isUuid(teacherId)) {
      return res.status(400).json({ error: "Invalid teacherId." });
    }

    const { rows } = await query(
      `DELETE FROM schedule_classes
        WHERE id = $1
          AND ($2::uuid IS NULL OR user_id = $2)
      RETURNING id,
                user_id AS "teacherId",
                day_of_week AS "day",
                start_time AS "startTime",
                end_time AS "endTime",
                title`,
      [classId, teacherId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Timetable class not found." });
    }

    await logAudit(req, "admin_teacher_schedule_delete", {
      teacherId: rows[0].teacherId,
      classId,
      title: rows[0].title,
      day: rows[0].day,
      startTime: formatTime(rows[0].startTime),
      endTime: formatTime(rows[0].endTime),
    });

    return res.json({ success: true, id: classId });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/teacher-schedule/import",
  uploadLimiter,
  timetableUpload.single("file"),
  async (req, res, next) => {
    const uploadedPath = req.file?.path || null;
    try {
      const teacherId = String(req.body?.teacherId || "").trim();
      const replaceExisting = parseBooleanInput(req.body?.replaceExisting);

      if (!isUuid(teacherId)) {
        return res.status(400).json({ error: "Valid teacherId is required." });
      }

      const teacher = await resolveTeacherById(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Upload a timetable file first." });
      }

      const ext = path.extname(req.file.originalname || "").toLowerCase();
      const mime = String(req.file.mimetype || "").toLowerCase();
      const isImageUpload =
        mime.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".webp"].includes(ext);

      let normalizedRows = { classes: [], skipped: [] };

      if (isImageUpload) {
        if (!isGeminiEnabled()) {
          return res.status(400).json({
            error:
              "Image timetable parsing requires Gemini API keys in backend environment.",
          });
        }

        const parsed = await extractTimetableFromImageWithGemini({
          imagePath: req.file.path,
          mimeType: req.file.mimetype,
          teacherName: teacher.name,
        });

        normalizedRows = parseImportedScheduleRows(parsed?.rows || [], {
          defaultInstructor: teacher.name,
        });
      } else {
        let parsedRows = [];
        try {
          const workbook = XLSX.readFile(req.file.path, { cellDates: true });
          const sheetName = workbook.SheetNames?.[0];
          if (!sheetName) {
            return res.status(400).json({
              error: "The uploaded file does not contain any worksheet.",
            });
          }
          const worksheet = workbook.Sheets[sheetName];
          parsedRows = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
            raw: false,
          });
        } catch (_) {
          return res.status(400).json({
            error: "Could not read spreadsheet. Upload a valid Excel/CSV file.",
          });
        }
        normalizedRows = parseImportedScheduleRows(parsedRows, {
          defaultInstructor: teacher.name,
        });
      }

      if (!normalizedRows.classes.length) {
        return res.status(400).json({
          error: "No valid timetable rows were found in the uploaded file.",
          skipped: normalizedRows.skipped,
        });
      }

      const inserted = [];
      let replacedCount = 0;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (replaceExisting) {
          const deleteResult = await client.query(
            `DELETE FROM schedule_classes
              WHERE user_id = $1`,
            [teacher.id],
          );
          replacedCount = deleteResult.rowCount || 0;
        }

        for (const item of normalizedRows.classes) {
          const { rows } = await client.query(
            `INSERT INTO schedule_classes (
                user_id,
                day_of_week,
                start_time,
                end_time,
                title,
                room,
                instructor
              )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id,
                    day_of_week AS "day",
                    start_time AS "startTime",
                    end_time AS "endTime",
                    title,
                    room,
                    instructor`,
            [
              teacher.id,
              item.day,
              item.startTime,
              item.endTime,
              item.title,
              item.room,
              item.instructor,
            ],
          );
          if (rows[0]) inserted.push(rows[0]);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      await logAudit(req, "admin_teacher_schedule_import", {
        teacherId: teacher.id,
        source: isImageUpload ? "image" : "spreadsheet",
        replaceExisting,
        importedCount: inserted.length,
        skippedCount: normalizedRows.skipped.length,
      });

      return res.json({
        teacher,
        source: isImageUpload ? "image" : "spreadsheet",
        replaceExisting,
        replacedCount,
        importedCount: inserted.length,
        skipped: normalizedRows.skipped,
        classes: inserted.map(mapScheduleClass),
      });
    } catch (error) {
      return next(error);
    } finally {
      await removeUploadedFile(uploadedPath);
    }
  },
);

export default router;







