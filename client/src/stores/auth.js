import { defineStore } from 'pinia';
import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
let hydratePromise = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null,
    currentUser: null,
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
    setUser(user) {
      this.currentUser = user || null;
    },
    setSession({ accessToken, refreshToken, user }) {
      this.setAccessToken(accessToken);
      if (user) this.setUser(user);
      if (refreshToken && typeof window !== 'undefined') {
        localStorage.setItem('refreshToken', refreshToken);
      }
    },
    clearAuth() {
      this.accessToken = null;
      this.currentUser = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    },
    async hydrateSession() {
      if (this.initialized) {
        return this.isAuthenticated;
      }

      if (hydratePromise) {
        return hydratePromise;
      }

      const storedRefreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')
        : null;

      if (!storedRefreshToken) {
        this.initialized = true;
        hydratePromise = null;
        return false;
      }

      hydratePromise = (async () => {
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
          }

          const response = await axios.post(
            `${apiBaseUrl}/auth/refresh`,
            { refreshToken: storedRefreshToken },
            {
              withCredentials: true,
              headers: { 'x-skip-auth-refresh': '1' },
            }
          );

          if (response.data?.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }
          if (response.data?.user) {
            this.setUser(response.data.user);
          }
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
