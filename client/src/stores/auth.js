import { defineStore } from 'pinia';
import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
let hydratePromise = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
  },
  actions: {
    setAccessToken(token) {
      this.accessToken = token || null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
    },
    setSession({ accessToken, user }) {
      this.setAccessToken(accessToken);
      if (user && typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
      }
    },
    clearAuth({ clearUser = true } = {}) {
      this.accessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        if (clearUser) {
          localStorage.removeItem('user');
        }
      }
    },
    async hydrateSession() {
      if (this.initialized) {
        return this.isAuthenticated;
      }

      if (hydratePromise) {
        return hydratePromise;
      }

      hydratePromise = (async () => {
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
          }

          const response = await axios.post(
            `${apiBaseUrl}/auth/refresh`,
            {},
            {
              withCredentials: true,
              headers: { 'x-skip-auth-refresh': '1' },
            }
          );

          this.accessToken = response.data?.accessToken || null;
        } catch {
          this.accessToken = null;
        } finally {
          this.initialized = true;
          const isAuth = this.isAuthenticated;
          hydratePromise = null;
          return isAuth;
        }
      })();

      return hydratePromise;
    },
  },
});
