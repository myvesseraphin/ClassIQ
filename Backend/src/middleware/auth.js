import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { query } from "../db.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured.");
}

export const requireAuth = async (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies?.classiq_token;
  const resolvedToken = token || cookieToken;

  if (!resolvedToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  try {
    const payload = jwt.verify(resolvedToken, JWT_SECRET);
    const userId = String(payload?.sub || "").trim();
    const tokenVersion = Number(payload?.tv);
    if (!userId || !Number.isInteger(tokenVersion)) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    const { rows } = await query(
      `SELECT id, role, token_version AS "tokenVersion"
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user || Number(user.tokenVersion) !== tokenVersion) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.user = {
      id: user.id,
      role: user.role,
      tokenVersion: Number(user.tokenVersion),
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

export const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (roles && !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  return next();
};
