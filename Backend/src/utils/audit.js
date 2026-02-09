import { query } from "../db.js";

export const logAudit = async (req, action, context = {}) => {
  try {
    const userId = req.user?.id || null;
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    await query(
      `INSERT INTO audit_logs (user_id, action, context, ip, user_agent)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [userId, action, JSON.stringify(context || {}), ip, userAgent],
    );
  } catch (error) {
    // Audit logging must never break the request
    console.error("Audit log failed", error);
  }
};
