import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

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

  it('redirects authenticated users from /login to /dashboard', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1' };

    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('redirects authenticated users to redirect query target if present', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1' };

    await router.push('/login?redirect=/explore');
    expect(router.currentRoute.value.path).toBe('/explore');
  });

  it('allows authenticated users to access protected routes', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1' };

    await router.push('/settings');
    expect(router.currentRoute.value.path).toBe('/settings');
  });

  it('allows unauthenticated users to access public routes like /forgot-password', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    await router.push('/forgot-password');
    expect(router.currentRoute.value.path).toBe('/forgot-password');
  });
});
