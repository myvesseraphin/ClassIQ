export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

import axios from "axios";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
