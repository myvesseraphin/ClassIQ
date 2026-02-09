import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.cookies?.classiq_token;
  const resolvedToken = token || cookieToken;

  if (!resolvedToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  try {
    const payload = jwt.verify(resolvedToken, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
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
