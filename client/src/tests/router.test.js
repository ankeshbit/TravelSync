import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../views/LandingView.vue', () => ({ default: { template: '<div>Landing</div>' } }));
vi.mock('../views/LoginView.vue', () => ({ default: { template: '<div>Login</div>' } }));
vi.mock('../views/RegisterView.vue', () => ({ default: { template: '<div>Register</div>' } }));
vi.mock('../views/ForgotPasswordView.vue', () => ({ default: { template: '<div>ForgotPassword</div>' } }));
vi.mock('../views/DashboardView.vue', () => ({ default: { template: '<div>Dashboard</div>' } }));
vi.mock('../views/TripDetailView.vue', () => ({ default: { template: '<div>TripDetail</div>' } }));
vi.mock('../views/EditTripView.vue', () => ({ default: { template: '<div>EditTrip</div>' } }));
vi.mock('../views/ExploreView.vue', () => ({ default: { template: '<div>Explore</div>' } }));
vi.mock('../views/SettingsView.vue', () => ({ default: { template: '<div>Settings</div>' } }));
vi.mock('../views/NotFoundView.vue', () => ({ default: { template: '<div>NotFound</div>' } }));
vi.mock('../views/MapView.vue', () => ({ default: { template: '<div>Map</div>' } }));
vi.mock('../views/ExpensesView.vue', () => ({ default: { template: '<div>Expenses</div>' } }));
vi.mock('../views/VerifyEmailView.vue', () => ({ default: { template: '<div>VerifyEmail</div>' } }));

import router from '../router';
import { useAuthStore } from '../stores/auth';

describe('Router navigation guards', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.initialized = true;
    authStore.firebaseUser = null;
    authStore.currentUser = null;
    await router.push('/forgot-password');
  });

  it('redirects unauthenticated users to /login with redirect query param', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    await router.push('/dashboard');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard');
  });

  it('redirects unverified user to /verify-email', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: false };

    await router.push('/dashboard');
    expect(router.currentRoute.value.path).toBe('/verify-email');
  });

  it('redirects authenticated verified users from /login to /dashboard', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: true };

    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('redirects authenticated verified users to redirect query target if present', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: true };

    await router.push('/login?redirect=/explore');
    expect(router.currentRoute.value.path).toBe('/explore');
  });

  it('allows authenticated verified users to access protected routes', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: true };

    await router.push('/settings');
    expect(router.currentRoute.value.path).toBe('/settings');
  });

  it('allows unauthenticated users to access public routes like /forgot-password', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    await router.push('/forgot-password');
    expect(router.currentRoute.value.path).toBe('/forgot-password');
  });

  it('allows unauthenticated users to access the landing page at /', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('rejects unsafe redirects like //evil.com or /\\evil.com and falls back to /dashboard', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: true };

    await router.push('/login?redirect=//evil.com');
    expect(router.currentRoute.value.path).toBe('/dashboard');

    await router.push('/login?redirect=/\\evil.com');
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('blocks unauthenticated access to /offline-trips when offline and redirects to /login', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;
    authStore.currentUser = null;
    localStorage.removeItem('user');

    // Simulate navigator.onLine = false
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      await router.push('/offline-trips');
      expect(router.currentRoute.value.path).toBe('/login');
      expect(router.currentRoute.value.query.offlineBlocked).toBe('true');
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('permits access to /offline-trips when offline for verified previously authenticated account', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;
    authStore.currentUser = null;
    localStorage.setItem('user', JSON.stringify({ id: 'cached-user-1', email: 'offline@travelsync.local' }));

    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      await router.push('/offline-trips');
      expect(router.currentRoute.value.path).toBe('/offline-trips');
    } finally {
      localStorage.removeItem('user');
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });
});
