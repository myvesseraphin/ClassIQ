import crypto from "crypto";
import { getAppCookieOptions } from "../utils/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getCookieOptions = () => getAppCookieOptions({ httpOnly: false });

export const ensureCsrfCookie = (req, res, next) => {
  if (!req.cookies?.csrf_token) {
    res.cookie("csrf_token", crypto.randomUUID(), getCookieOptions());
  }
  return next();
};

export const requireCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token." });
  }
  return next();
};
