const parseBooleanEnv = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
};

const resolveSameSite = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const configured = String(process.env.COOKIE_SAME_SITE || "")
    .trim()
    .toLowerCase();

  if (["lax", "strict", "none"].includes(configured)) {
    return configured;
  }

  // Cross-origin frontend/backend deployments need SameSite=None for cookies.
  return isProduction ? "none" : "lax";
};

export const getAppCookieOptions = ({ httpOnly = false } = {}) => {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = resolveSameSite();
  const secureOverride = parseBooleanEnv(process.env.COOKIE_SECURE);
  const secure =
    secureOverride === null ? isProduction || sameSite === "none" : secureOverride;

  return {
    httpOnly,
    sameSite,
    secure,
    path: "/",
  };
};
