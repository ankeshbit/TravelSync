// Pinia auth store — Firebase-backed authentication state
// Replaces the old JWT/refresh-token store while keeping the same public interface
// so all existing components continue to work.
import { defineStore } from 'pinia';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  loginWithEmail as fbLoginWithEmail,
  registerWithEmail as fbRegisterWithEmail,
  loginWithGoogle as fbLoginWithGoogle,
  loginWithGitHub as fbLoginWithGitHub,
  logout as fbLogout,
  getIdToken,
  getFirebaseErrorMessage,
} from '../services/authService';
import api from '../api';

let syncUserPromise = null;

// Resolved once Firebase has determined the initial auth state (prevents race conditions)
let authReadyResolve;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolve = resolve;
});

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // The raw Firebase user object (or null when signed out)
    firebaseUser: null,
    // The database user profile returned by /api/auth/me
    currentUser: null,
    // True once the onAuthStateChanged listener has fired at least once
    initialized: false,
    // General loading flag used by login / register actions
    loading: false,
    // Error state if syncing profile with backend database fails
    syncError: null,
  }),

  getters: {
    // True when a Firebase user is present — replaces the old accessToken check
    isAuthenticated: (state) => Boolean(state.firebaseUser),
  },

  actions: {
    // ── Firebase listener ─────────────────────────────────────────────────────

    /**
     * Start the Firebase auth state listener.
     * Called once from main.js on app startup.
     * Resolves authReadyPromise after the first callback fires so the router
     * never redirects before Firebase has restored the session.
     */
    initializeAuth() {
      const fallbackTimer = setTimeout(() => {
        if (!this.initialized) {
          this.initialized = true;
          authReadyResolve(Boolean(this.firebaseUser));
        }
      }, 5000);

      onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(fallbackTimer);
        this.firebaseUser = firebaseUser;

        // Immediately mark initialized and unblock app before DB sync
        if (!this.initialized) {
          this.initialized = true;
          authReadyResolve(Boolean(this.firebaseUser));
        }

        if (this.firebaseUser) {
          // Sync database user in the background if real firebase user
          if (firebaseUser) {
            try {
              await this._syncMongoUser();
            } catch {
              // Non-fatal — the user is still authenticated via Firebase
            }
          }
        } else {
          this.currentUser = null;
          // Clean up any stale local storage from the old JWT system
          if (typeof window !== 'undefined') {
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      });
    },

    /**
     * Update user properties in state and local storage
     * @param {Object} userData
     */
    updateUser(userData) {
      if (!userData) return;
      this.currentUser = { ...(this.currentUser || {}), ...userData };
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(this.currentUser));
      }
    },

    /**
     * Wait for Firebase to finish restoring the session.
     * The router beforeEach guard calls this instead of hydrateSession().
     */
    async waitForAuth() {
      return authReadyPromise;
    },

    // Kept for backward compatibility — the router previously called hydrateSession().
    async hydrateSession() {
      return this.waitForAuth();
    },

    // ── Auth actions ──────────────────────────────────────────────────────────

    async loginWithEmail(email, password) {
      this.loading = true;
      try {
        const user = await fbLoginWithEmail(email, password);
        if (user) {
          this.firebaseUser = user;
          if (user.emailVerified) {
            try {
              await this._syncMongoUser();
            } catch {
              // Non-fatal
            }
          }
        }
        return user;
      } finally {
        this.loading = false;
      }
    },

    async registerWithEmail(name, email, password) {
      this.loading = true;
      try {
        await fbRegisterWithEmail(name, email, password);
        // onAuthStateChanged fires automatically
      } finally {
        this.loading = false;
      }
    },

    async loginWithGoogle() {
      this.loading = true;
      try {
        const user = await fbLoginWithGoogle();
        if (user) {
          this.firebaseUser = user;
          if (user.emailVerified) {
            try {
              await this._syncMongoUser();
            } catch {
              // Non-fatal
            }
          }
        }
        return user;
      } finally {
        this.loading = false;
      }
    },

    async loginWithGitHub() {
      this.loading = true;
      try {
        const user = await fbLoginWithGitHub();
        if (user) {
          this.firebaseUser = user;
          if (user.emailVerified) {
            try {
              await this._syncMongoUser();
            } catch {
              // Non-fatal
            }
          }
        }
        return user;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        // Best-effort call to invalidate server-side session metadata
        await api.post('/auth/logout').catch(() => {});
      } finally {
        await fbLogout();
        this.firebaseUser = null;
        this.currentUser = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    },

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Call /api/auth/me to fetch (or create) the PostgreSQL / database user.
     * Deduplicates in-flight requests to eliminate race conditions between
     * action dispatch and the onAuthStateChanged observer.
     */
    async _syncMongoUser() {
      if (this.firebaseUser && !this.firebaseUser.emailVerified) {
        return null;
      }
      if (syncUserPromise) {
        return syncUserPromise;
      }
      syncUserPromise = (async () => {
        try {
          const pendingName = typeof window !== 'undefined' ? localStorage.getItem('pendingUserName') : null;
          if (pendingName) {
            try {
              await api.put('/auth/me', { name: pendingName });
              localStorage.removeItem('pendingUserName');
            } catch {
              // If error, will retry later
            }
          }
          const res = await api.get('/auth/me');
          this.currentUser = res.data;
          // Keep localStorage in sync so Navbar/Settings avatar works immediately
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(res.data));
          }
          return res.data;
        } finally {
          syncUserPromise = null;
        }
      })();
      return syncUserPromise;
    },

    async syncUser() {
      return this._syncMongoUser();
    },

    // ── Legacy compatibility stubs ────────────────────────────────────────────
    // These were called by old components; they are no-ops now or delegate.

    setAccessToken() {},
    setUser(user) { this.currentUser = user || null; },
    setSession({ user } = {}) { if (user) this.setUser(user); },
    clearAuth() {
      syncUserPromise = null;
      this.firebaseUser = null;
      this.currentUser = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    },
  },
});

export { getFirebaseErrorMessage };
