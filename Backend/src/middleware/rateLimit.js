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
