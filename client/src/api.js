import axios from 'axios';

const SKIP_REFRESH_HEADER = 'x-skip-auth-refresh';
const LOGIN_ROUTE = '/login';

const api = axios.create({
  // Use Vite environment variable, fallback to localhost for development
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

let authStoreRef = null;
let toastStoreRef = null;
let refreshPromise = null;

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_ROUTE) {
    window.location.href = LOGIN_ROUTE;
  }
};

const refreshAccessToken = async () => {
  if (!authStoreRef) {
    throw new Error('Auth store is not initialized.');
  }

  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', {}, {
        headers: { [SKIP_REFRESH_HEADER]: '1' }
      })
      .then((response) => {
        const newToken = response.data?.accessToken;
        if (!newToken) {
          throw new Error('No access token returned from refresh endpoint.');
        }
        authStoreRef.setAccessToken(newToken);
        return newToken;
      })
      .catch((err) => {
        authStoreRef.clearAuth();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Request interceptor: automatically attach JWT token
api.interceptors.request.use((config) => {
  const token = authStoreRef?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;
    const isRefreshRequest = originalRequest.headers?.[SKIP_REFRESH_HEADER] === '1';

    if (status === 401 && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        redirectToLogin();
      }
    }

    if (status === 401 && isRefreshRequest) {
      authStoreRef?.clearAuth();
      redirectToLogin();
    }

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

// Setup function to be called after app is initialized with Pinia
export const setupApiInterceptors = ({ toastStore, authStore }) => {
  toastStoreRef = toastStore;
  authStoreRef = authStore;
};

export default api;
