import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { authLimiter, resetLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../utils/audit.js";
import { getAppCookieOptions } from "../utils/cookies.js";

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const RESET_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";
const RETURN_RESET_TOKEN =
  process.env.RETURN_RESET_TOKEN === "true" ||
  process.env.NODE_ENV !== "production";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const smtpEnabled = SMTP_HOST && SMTP_USER && SMTP_PASS;
const mailer = smtpEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

const buildUserResponse = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  firstName: row.firstName || null,
  lastName: row.lastName || null,
  emailVerified: row.emailVerified ?? null,
  avatarUrl: row.avatarUrl || null,
  school: row.school || null,
});

const isValidEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const isUuid = (value) => UUID_REGEX.test(value || "");

const validatePassword = (password) => {
  if (typeof password !== "string") return false;
  const value = password.trim();
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
};

const getCookieOptions = () => getAppCookieOptions({ httpOnly: true });

const sendVerifyEmail = async (email, code, firstName) => {
  if (!mailer) return false;
  const greetingName = firstName || "User";
  const verificationCode = code;
  await mailer.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Verify your ClassIQ account",
    text: `Hello ${greetingName}, your ClassIQ verification code is: ${verificationCode}.`,
    html: `<div style="background-color: #FDFDFD; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 500px; margin: 0 auto; text-align: center;">
        <div style="margin-bottom: 40px;">
          <img src="https://icnbcqeehlnyicfmpmkg.supabase.co/storage/v1/object/public/Books/public/logo.png" alt="ClassIQ" style="height: 42px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="margin-bottom: 32px;">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto;">
            <path d="M12 2L3 7V12C3 18 12 22 12 22C12 22 21 18 21 12V7L12 2Z" fill="#1877F2" fill-opacity="0.05"/>
            <path d="M12 2L3 7V12C3 18 12 22 12 22C12 22 21 18 21 12V7L12 2Z" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke="#1877F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.03em;">
          Hello, ${greetingName}
        </h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 40px; max-width: 380px; margin-left: auto; margin-right: auto;">
          Use the verification code below to confirm your ClassIQ account.
        </p>
        <div style="margin-bottom: 40px;">
          <p style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 16px;">
            Security Code
          </p>
          <div style="display: inline-block; padding: 20px 44px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 10px 20px rgba(0,0,0,0.02);">
            <span style="font-size: 48px; font-weight: 900; letter-spacing: 0.15em; color: #1877F2; font-variant-numeric: tabular-nums;">
              ${verificationCode}
            </span>
          </div>
        </div>
        <div style="max-width: 400px; margin: 0 auto 48px; padding: 24px; background: #f8fafc; border-radius: 24px; border: 1px solid #f1f5f9;">
          <p style="font-size: 13px; color: #0f172a; line-height: 1.5; margin: 0;">
            <strong>Secure Practice:</strong> Never share this code. If you didn't request this, no further action is required.
          </p>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <p style="font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.2em;">
            ClassIQ <span style="color: #1877F2;">Data Driven Success</span>
          </p>
        </div>
      </div>
    </div>`,
  });
  return true;
};

const createEmailVerification = async (userId) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await query(
    `INSERT INTO email_verifications (user_id, code, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, code, token, expiresAt],
  );
  return { code, token };
};

const sendResetEmail = async (email, code, firstName) => {
  if (!mailer) return false;
  const greetingName = firstName || "User";
  const verificationCode = code;
  await mailer.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "ClassIQ Password Reset",
    text: `Hello ${greetingName}, your ClassIQ password reset code is: ${verificationCode}. It expires in ${RESET_TTL_MINUTES} minutes.`,
    html: `<div style="background-color: #FDFDFD; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 500px; margin: 0 auto; text-align: center;">
        <div style="margin-bottom: 40px;">
          <img src="https://icnbcqeehlnyicfmpmkg.supabase.co/storage/v1/object/public/Books/public/logo.png" alt="ClassIQ" style="height: 42px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="margin-bottom: 32px;">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto;">
            <path d="M12 2L3 7V12C3 18 12 22 12 22C12 22 21 18 21 12V7L12 2Z" fill="#1877F2" fill-opacity="0.05"/>
            <path d="M12 2L3 7V12C3 18 12 22 12 22C12 22 21 18 21 12V7L12 2Z" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke="#1877F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.03em;">
          Hello, ${greetingName}
        </h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 40px; max-width: 380px; margin-left: auto; margin-right: auto;">
          You requested a password reset for your ClassIQ account. Enter the verification code below to proceed.
        </p>
        <div style="margin-bottom: 40px;">
          <p style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 16px;">
            Security Code
          </p>
          <div style="display: inline-block; padding: 20px 44px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 10px 20px rgba(0,0,0,0.02);">
            <span style="font-size: 48px; font-weight: 900; letter-spacing: 0.15em; color: #1877F2; font-variant-numeric: tabular-nums;">
              ${verificationCode}
            </span>
          </div>
        </div>
        <div style="max-width: 400px; margin: 0 auto 48px; padding: 24px; background: #f8fafc; border-radius: 24px; border: 1px solid #f1f5f9;">
          <p style="font-size: 13px; color: #0f172a; line-height: 1.5; margin: 0;">
            <strong>Secure Practice:</strong> Never share this code. If you didn't request this, no further action is required.
          </p>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <p style="font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.2em;">
            ClassIQ <span style="color: #1877F2;">Data Driven Success</span>
          </p>
        </div>
      </div>
    </div>`,
  });
  return true;
};

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Valid email and password required." });
    }

      const { rows } = await query(
        `SELECT u.id, u.email, u.role, u.password_hash AS "passwordHash",
                u.email_verified AS "emailVerified",
                p.first_name AS "firstName", p.last_name AS "lastName",
                p.avatar_url AS "avatarUrl", p.school_name AS "school"
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE u.email = $1`,
        [email],
      );

    const user = rows[0];
    if (!user) {
      await logAudit(req, "login_failed", { email });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await logAudit(req, "login_failed", { email });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      try {
        const verification = await createEmailVerification(user.id);
        await sendVerifyEmail(email, verification.code, user.firstName);
      } catch (mailError) {
        console.error("Failed to send verification email", mailError);
      }
      return res.status(403).json({
        error: "Email not verified. Please check your inbox.",
      });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.cookie("classiq_token", token, getCookieOptions());
    await logAudit(req, "login_success", { userId: user.id });
    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body || {};
    if (!isValidEmail(email) || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include upper, lower, number, and symbol.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const normalizedRole =
      role && ["student", "teacher"].includes(role) ? role : "student";
    const { rows: inserted } = await query(
      `INSERT INTO users (email, password_hash, role, email_verified)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, email_verified AS "emailVerified"`,
      [email, passwordHash, normalizedRole, false],
    );

    const user = inserted[0];
    await query(
      `INSERT INTO user_profiles (user_id, first_name, last_name)
       VALUES ($1, $2, $3)`,
      [user.id, firstName, lastName],
    );

    if (REQUIRE_EMAIL_VERIFICATION) {
      try {
        const verification = await createEmailVerification(user.id);
        await sendVerifyEmail(email, verification.code, firstName);
      } catch (mailError) {
        console.error("Failed to send verification email", mailError);
      }
      return res.status(201).json({
        message: "Account created. Please verify your email to continue.",
      });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    res.cookie("classiq_token", token, getCookieOptions());
    return res.status(201).json({
      user: { ...user, firstName, lastName, emailVerified: user.emailVerified },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already exists." });
    }
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
      const { rows } = await query(
        `SELECT u.id, u.email, u.role,
                u.email_verified AS "emailVerified",
                p.first_name AS "firstName", p.last_name AS "lastName",
                p.avatar_url AS "avatarUrl",
                p.school_name AS "school"
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE u.id = $1`,
        [req.user.id],
      );

    if (!rows[0]) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ user: buildUserResponse(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.post("/request-password-reset", resetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email is required." });
    }

    const { rows } = await query(
      `SELECT u.id, p.first_name AS "firstName"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.email = $1`,
      [email],
    );
    const user = rows[0];

    if (!user) {
      return res.json({
        message: "If the account exists, a reset code was sent.",
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO password_resets (user_id, code, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, code, token, expiresAt],
    );

    const response = {
      message: "If the account exists, a reset code was sent.",
    };
    try {
      await sendResetEmail(email, code, user?.firstName);
    } catch (mailError) {
      console.error("Failed to send reset email", mailError);
    }
    await logAudit(req, "password_reset_requested", { email });
    if (RETURN_RESET_TOKEN) {
      response.dev = { code, resetToken: token };
    }
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.post("/verify-reset-code", resetLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!isValidEmail(email) || !code) {
      return res.status(400).json({ error: "Email and code are required." });
    }

    const { rows } = await query(
      `SELECT pr.token, pr.expires_at AS "expiresAt"
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
        WHERE u.email = $1
          AND pr.code = $2
          AND pr.used_at IS NULL
        ORDER BY pr.created_at DESC
        LIMIT 1`,
      [email, code],
    );

    const reset = rows[0];
    if (!reset) {
      return res.status(400).json({ error: "Invalid reset code." });
    }

    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Reset code expired." });
    }

    return res.json({ resetToken: reset.token });
  } catch (error) {
    return next(error);
  }
});

router.post("/reset-password", resetLimiter, async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body || {};
    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json({ error: "Reset token and new password are required." });
    }

    const { rows } = await query(
      `SELECT id, user_id AS "userId", expires_at AS "expiresAt", used_at AS "usedAt"
         FROM password_resets
        WHERE token = $1`,
      [resetToken],
    );

    const reset = rows[0];
    if (!reset || reset.usedAt) {
      return res.status(400).json({ error: "Invalid reset token." });
    }

    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Reset token expired." });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include upper, lower, number, and symbol.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      reset.userId,
    ]);
    await query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, [
      reset.id,
    ]);
    await query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, $2, $3)`,
      [
        reset.userId,
        "Password reset successful",
        "Your ClassIQ password was reset. If this wasn't you, please contact support.",
      ],
    );

    await logAudit(req, "password_reset_success", { userId: reset.userId });
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    return next(error);
  }
});

router.post("/request-email-verification", resetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email is required." });
    }

    const { rows } = await query(
      `SELECT u.id, u.email_verified AS "emailVerified",
              p.first_name AS "firstName"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.email = $1`,
      [email],
    );
    const user = rows[0];

    if (!user || user.emailVerified) {
      return res.json({ message: "If the account exists, a code was sent." });
    }

    const verification = await createEmailVerification(user.id);
    try {
      await sendVerifyEmail(email, verification.code, user.firstName);
    } catch (mailError) {
      console.error("Failed to send verification email", mailError);
    }

    return res.json({ message: "If the account exists, a code was sent." });
  } catch (error) {
    return next(error);
  }
});

router.post("/verify-email", resetLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!isValidEmail(email) || !code) {
      return res.status(400).json({ error: "Email and code are required." });
    }

    const { rows } = await query(
      `SELECT ev.id, ev.expires_at AS "expiresAt"
         FROM email_verifications ev
         JOIN users u ON u.id = ev.user_id
        WHERE u.email = $1
          AND ev.code = $2
          AND ev.verified_at IS NULL
        ORDER BY ev.created_at DESC
        LIMIT 1`,
      [email, code],
    );

    const verification = rows[0];
    if (!verification) {
      return res.status(400).json({ error: "Invalid verification code." });
    }
    if (new Date(verification.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Verification code expired." });
    }

    await query(
      `UPDATE users
          SET email_verified = true
        WHERE email = $1`,
      [email],
    );
    await query(
      `UPDATE email_verifications
          SET verified_at = now()
        WHERE id = $1`,
      [verification.id],
    );
    await logAudit(req, "email_verified", { email });

    return res.json({ message: "Email verified successfully." });
  } catch (error) {
    return next(error);
  }
});

router.get("/schools", async (req, res, next) => {
  try {
    const queryText = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 20);

    if (!queryText) {
      const { rows } = await query(
        `SELECT id, name, location
           FROM schools
          ORDER BY name
          LIMIT $1`,
        [limit],
      );
      return res.json({ schools: rows });
    }

    const likeQuery = `%${queryText}%`;
    const { rows } = await query(
      `SELECT id, name, location
         FROM schools
        WHERE lower(name) LIKE lower($1)
        ORDER BY name
        LIMIT $2`,
      [likeQuery, limit],
    );

    return res.json({ schools: rows });
  } catch (error) {
    return next(error);
  }
});
router.post("/request-access", async (req, res, next) => {
  try {
    const { fullName, email, schoolId, schoolName, school, gradeLevel } =
      req.body || {};
    const rawSchool =
      typeof schoolName === "string"
        ? schoolName.trim()
        : typeof school === "string"
          ? school.trim()
          : typeof gradeLevel === "string"
            ? gradeLevel.trim()
            : "";
    let resolvedSchoolId = null;
    let resolvedSchoolName = rawSchool;

    if (schoolId) {
      if (!isUuid(schoolId)) {
        return res.status(400).json({ error: "Invalid school id." });
      }
      const { rows } = await query(
        `SELECT id, name
           FROM schools
          WHERE id = $1`,
        [schoolId],
      );

      if (!rows[0]) {
        return res.status(400).json({ error: "School not found." });
      }

      resolvedSchoolId = rows[0].id;
      resolvedSchoolName = rows[0].name;
    }

    if (!fullName || !isValidEmail(email) || !resolvedSchoolName) {
      return res
        .status(400)
        .json({ error: "Full name, email, and school are required." });
    }

    const { rows } = await query(
      `INSERT INTO access_requests (
          full_name,
          email,
          school,
          school_id
        )
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, created_at AS "createdAt"`,
      [fullName, email, resolvedSchoolName, resolvedSchoolId],
    );

    return res.status(201).json({ request: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", requireAuth, requireCsrf, (req, res) => {
  res.clearCookie("classiq_token", getCookieOptions());
  logAudit(req, "logout", {}).catch(() => {});
  return res.json({ success: true });
});

export default router;



