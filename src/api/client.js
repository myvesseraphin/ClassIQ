import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const mediaBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    return `${mediaBaseUrl}${url}`;
  }
  return url;
};
