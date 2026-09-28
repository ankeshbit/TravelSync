// Axios instance for TravelSync API requests.
// Firebase ID tokens are attached to every protected request automatically.
// The old JWT / refresh-token interceptor has been replaced.
import axios from 'axios';
import { auth } from './firebase';

const LOGIN_ROUTE = '/login';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:3000/api',
});

let toastStoreRef = null;
let authStoreRef = null;

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_ROUTE) {
    window.location.href = LOGIN_ROUTE;
  }
};

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach a fresh Firebase ID token before every request.
api.interceptors.request.use(async (config) => {
  try {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      // getIdToken(false) returns cached token; refreshes automatically when near expiry
      const token = await firebaseUser.getIdToken(false);
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No user signed in — let the request proceed without a token.
    // The backend will return 401 if the route requires authentication.
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Firebase tokens expire after 1 hour. Try a forced refresh once.
      const originalRequest = error.config || {};
      if (!originalRequest._firebaseRetry) {
        originalRequest._firebaseRetry = true;
        try {
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            const freshToken = await firebaseUser.getIdToken(true); // force refresh
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${freshToken}`;
            return api(originalRequest);
          }
        } catch {
          // Token refresh failed — redirect to login
        }
      }
      // Still 401 after retry → session truly expired
      authStoreRef?.clearAuth();
      redirectToLogin();
    }

    // Show toast notifications for API errors
    if (toastStoreRef) {
      if (error.response) {
        const message = error.response.data?.message || 'An error occurred';
        if (status === 403) {
          toastStoreRef.showToast("You don't have permission to do that", 'error');
        } else if (status === 404) {
          toastStoreRef.showToast('Resource not found', 'error');
        } else if (status === 500) {
          toastStoreRef.showToast('Something went wrong on our end', 'error');
        } else if (status >= 400 && status !== 401) {
          toastStoreRef.showToast(message, 'error');
        }
      } else if (error.request) {
        toastStoreRef.showToast('Network error. Please check your connection.', 'error');
      } else {
        toastStoreRef.showToast('An unexpected error occurred', 'error');
      }
    }

    return Promise.reject(error);
  }
);

// Called from main.js after Pinia is ready
export const setupApiInterceptors = ({ toastStore, authStore }) => {
  toastStoreRef = toastStore;
  authStoreRef = authStore;
};

export default api;
