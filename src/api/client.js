import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const mediaBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

const getCookie = (name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const ensureCsrfCookie = async () => {
  if (getCookie("csrf_token")) return;
  try {
    await axios.get(`${apiBaseUrl}/health`, { withCredentials: true });
  } catch (err) {
    // Ignore CSRF warm-up failures; request may still proceed.
  }
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    await ensureCsrfCookie();
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("classiq_user");
      const currentPath = window.location.pathname || "";
      if (currentPath.startsWith("/library")) {
        window.location.href = "/library-login";
      } else if (!currentPath.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
export const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    return `${mediaBaseUrl}${url}`;
  }
  return url;
};
