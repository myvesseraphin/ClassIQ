import rateLimit from "express-rate-limit";

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again later.",
});

export const resetLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many requests. Please try again later.",
});

export const uploadLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many uploads. Please try again later.",
});

export const aiLimiter = buildLimiter({
  windowMs: Number.parseInt(process.env.AI_LIMIT_WINDOW_MS || "60000", 10) || 60000,
  max: Number.parseInt(process.env.AI_LIMIT_MAX || "5", 10) || 5,
  message: "ClassIQ AI is cooling down. Please wait and try again.",
});
