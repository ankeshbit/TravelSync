import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignOut = vi.fn().mockResolvedValue();
const mockGetIdToken = vi.fn().mockResolvedValue('refreshed-token');
const mockAuth = {
  currentUser: {
    getIdToken: mockGetIdToken
  }
};

vi.mock('firebase/auth', () => ({
  signOut: mockSignOut
}));

vi.mock('../firebase', () => ({
  auth: mockAuth
}));

describe('api.js interceptors', () => {
  let api;
  let locationHref;

  beforeEach(async () => {
    vi.clearAllMocks();
    locationHref = 'http://localhost:3000/dashboard';
    mockGetIdToken.mockResolvedValue('refreshed-token');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        get href() { return locationHref; },
        set href(val) { locationHref = val; },
        pathname: '/dashboard',
        search: ''
      }
    });

    const mod = await import('../api');
    api = mod.default;
  });

  it('retries request on first 401 by requesting fresh ID token', async () => {
    const mockSuccessResponse = { data: { success: true }, status: 200, headers: {}, config: {} };
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      if (config._firebaseRetry) {
        expect(config.headers.Authorization).toBe('Bearer refreshed-token');
        return mockSuccessResponse;
      }
      const err = new Error('Unauthorized');
      err.response = { status: 401, data: {} };
      err.config = config;
      throw err;
    });

    const res = await api.get('/test');
    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    expect(res.data.success).toBe(true);
    api.defaults.adapter = originalAdapter;
  });

  it('does not retry when _firebaseRetry is already set and calls signOut', async () => {
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      const err = new Error('Unauthorized');
      err.response = { status: 401, data: {} };
      err.config = config;
      throw err;
    });

    await expect(api.get('/test')).rejects.toThrow();
    expect(mockSignOut).toHaveBeenCalled();
    expect(locationHref).toContain('/login?redirect=');
    api.defaults.adapter = originalAdapter;
  });

  it('does not trigger redirect loop if already on /login', async () => {
    locationHref = 'http://localhost:3000/login';
    window.location.pathname = '/login';

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      const err = new Error('Unauthorized');
      err.response = { status: 401, data: {} };
      err.config = { ...config, _firebaseRetry: true };
      throw err;
    });

    await expect(api.get('/test')).rejects.toThrow();
    expect(mockSignOut).toHaveBeenCalled();
    expect(locationHref).toBe('http://localhost:3000/login');
    api.defaults.adapter = originalAdapter;
  });

  it('does not sign out on 403 with EMAIL_NOT_VERIFIED and redirects to /verify-email', async () => {
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      const err = new Error('Forbidden');
      err.response = { status: 403, data: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' } };
      err.config = config;
      throw err;
    });

    await expect(api.get('/test')).rejects.toThrow();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(locationHref).toBe('/verify-email');
    api.defaults.adapter = originalAdapter;
  });

  it('handles ACCOUNT_DELETED explicitly: shows toast, clears auth, signs out, and redirects to /login without redirect query', async () => {
    const mockToastStore = { showToast: vi.fn() };
    const mockAuthStore = { clearAuth: vi.fn() };
    const { setupApiInterceptors } = await import('../api');
    setupApiInterceptors({ toastStore: mockToastStore, authStore: mockAuthStore });

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      const err = new Error('Account deleted');
      err.response = { status: 401, data: { code: 'ACCOUNT_DELETED', message: 'Account deleted' } };
      err.config = config;
      throw err;
    });

    await expect(api.get('/test')).rejects.toThrow();
    expect(mockToastStore.showToast).toHaveBeenCalledWith('Your account has been deleted', 'error');
    expect(mockAuthStore.clearAuth).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    expect(locationHref).toBe('/login');
    api.defaults.adapter = originalAdapter;
  });

  it('bypasses global error toast on OWNS_SHARED_TRIPS 409 error', async () => {
    const mockToastStore = { showToast: vi.fn() };
    const { setupApiInterceptors } = await import('../api');
    setupApiInterceptors({ toastStore: mockToastStore, authStore: {} });

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = vi.fn().mockImplementation(async (config) => {
      const err = new Error('Owns shared trips');
      err.response = { status: 409, data: { code: 'OWNS_SHARED_TRIPS', message: 'You own shared trips', trips: ['Trip A'] } };
      err.config = config;
      throw err;
    });

    await expect(api.delete('/auth/me')).rejects.toThrow();
    expect(mockToastStore.showToast).not.toHaveBeenCalled();
    api.defaults.adapter = originalAdapter;
  });
});
