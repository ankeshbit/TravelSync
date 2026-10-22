import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsView from '../views/SettingsView.vue';
import { useAuthStore } from '../stores/auth';
import api from '../api';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue()
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: { email: 'user@example.com' } }
}));

vi.mock('../api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { name: 'Test User', email: 'user@example.com' } }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } })
  },
  resetEmailVerifyToast: vi.fn()
}));

describe('SettingsView account deletion', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('preserves non-app localStorage keys (e.g. theme) while removing app-specific keys after deletion', async () => {
    const authStore = useAuthStore();
    authStore.currentUser = { id: 'u1', name: 'Test User', email: 'user@example.com' };

    // Set various localStorage keys before deletion
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('custom_preference', 'enabled');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
    localStorage.setItem('token', 'old-token');
    localStorage.setItem('refreshToken', 'old-refresh');
    localStorage.setItem('travelsync_cache_version', '1');

    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          ThemeToggle: { template: '<div></div>' },
          OtpModal: { template: '<div class="otp-modal-stub"></div>' }
        }
      }
    });

    // Directly invoke the handleDeleteAccount handler from the component instance
    await wrapper.vm.handleDeleteAccount('123456');

    expect(api.delete).toHaveBeenCalledWith('/auth/me', { data: { otp: '123456' }, skipErrorToast: true });
    expect(mockPush).toHaveBeenCalledWith('/login');

    // App keys are removed
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('travelsync_cache_version')).toBeNull();

    // User preferences are preserved
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('custom_preference')).toBe('enabled');
  });
});
