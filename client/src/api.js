import axios from 'axios';
import router from './router';

const api = axios.create({
  // Use Vite environment variable, fallback to localhost for development
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

// Request interceptor: automatically attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // This will be handled by component-level catch blocks which use the toast store
    // We just re-throw the error
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Setup function to be called after app is initialized with Pinia
export const setupApiInterceptors = (toastStore) => {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      // Show error toast based on status code
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'An error occurred';
        
        if (status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
        } else if (status === 403) {
          toastStore.showToast("You don't have permission to do that", 'error');
        } else if (status === 404) {
          toastStore.showToast('Resource not found', 'error');
        } else if (status === 500) {
          toastStore.showToast('Something went wrong on our end', 'error');
        } else if (status >= 400) {
          toastStore.showToast(message, 'error');
        }
      } else if (error.request) {
        toastStore.showToast('Network error. Please check your connection.', 'error');
      } else {
        toastStore.showToast('An unexpected error occurred', 'error');
      }
      return Promise.reject(error);
    }
  );
};

export default api;
