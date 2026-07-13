import axios from "axios";

// Every backend route is namespaced under /DemoApp, matching the NeuroNest
// DemoApp template convention (see backend/DemoApp/app.py).
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const api = axios.create({ baseURL: `${API_BASE}/DemoApp` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mood_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
