import axios from 'axios';
import { clearAuthSession } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    const isOnLoginPage = window.location.pathname === '/login';

    // Only force logout on 401 from protected APIs, not during login itself
    if (error.response?.status === 401 && !isAuthEndpoint && !isOnLoginPage) {
      const isDisplaced = error.response?.data?.code === 'SESSION_DISPLACED' ||
        error.response?.data?.message?.includes('logged in from another device');

      clearAuthSession();

      if (isDisplaced) {
        // Flag for App.jsx to show the security modal on the login page
        sessionStorage.setItem('session_displaced', '1');
      }

      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
