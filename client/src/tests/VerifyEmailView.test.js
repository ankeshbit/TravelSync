import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import VerifyEmailView from '../views/VerifyEmailView.vue';
import { useAuthStore } from '../stores/auth';
import { sendEmailVerification } from 'firebase/auth';

const { mockPush, mockCurrentUser } = vi.hoisted(() => {
  return {
    mockPush: vi.fn(),
    mockCurrentUser: {
      email: 'test@example.com',
      emailVerified: false,
      reload: vi.fn().mockResolvedValue(),
      getIdToken: vi.fn().mockResolvedValue('fresh-token')
    }
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}));

vi.mock('firebase/auth', () => ({
  sendEmailVerification: vi.fn().mockResolvedValue()
}));

vi.mock('../firebase', () => ({
  auth: {
    currentUser: mockCurrentUser
  }
}));

describe('VerifyEmailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockCurrentUser.emailVerified = false;
  });

  it('starts resend cooldown on initial mount and persists end time in sessionStorage', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { email: 'test@example.com', emailVerified: false };

    const wrapper = mount(VerifyEmailView);
    await wrapper.vm.$nextTick();

    const storedEndTime = sessionStorage.getItem('verify_email_cooldown_end');
    expect(storedEndTime).toBeTruthy();
    expect(Number(storedEndTime)).toBeGreaterThan(Date.now());
    expect(wrapper.text()).toContain('Resend in');
  });

  it('resumes pre-existing cooldown from sessionStorage on mount', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { email: 'test@example.com', emailVerified: false };
    const futureEnd = Date.now() + 35 * 1000;
    sessionStorage.setItem('verify_email_cooldown_end', String(futureEnd));

    const wrapper = mount(VerifyEmailView);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toMatch(/Resend in (34|35|36)s/);
  });

  it('starts cooldown on auth/too-many-requests error when resending', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { email: 'test@example.com', emailVerified: false };

    const wrapper = mount(VerifyEmailView);
    await wrapper.vm.$nextTick();

    // Reset cooldown to 0 to enable clicking resend
    sessionStorage.removeItem('verify_email_cooldown_end');
    wrapper.vm.resendCooldown = 0;
    await wrapper.vm.$nextTick();

    sendEmailVerification.mockRejectedValueOnce({ code: 'auth/too-many-requests', message: 'Too many requests' });

    await wrapper.vm.handleResend();

    const storedEnd = sessionStorage.getItem('verify_email_cooldown_end');
    expect(storedEnd).toBeTruthy();
    expect(Number(storedEnd)).toBeGreaterThan(Date.now());
  });
});
