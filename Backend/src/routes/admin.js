import express from "express";
import dotenv from "dotenv";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

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

export default router;







