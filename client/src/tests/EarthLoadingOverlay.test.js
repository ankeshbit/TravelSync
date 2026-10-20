import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import EarthLoadingOverlay from '../components/EarthLoadingOverlay.vue';
import { useAppLoader } from '../composables/useAppLoader';
import { useAuthStore } from '../stores/auth';
import { useTripsStore } from '../stores/trips';

describe('EarthLoadingOverlay component', () => {
  it('renders correctly when visible is true with default message, logo and branding', () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
    });

    expect(wrapper.text()).toContain('TRAVELSYNC');
    expect(wrapper.text()).toContain('Getting your journey ready…');
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite');

    // Logo image and progress bar
    const logoImg = wrapper.find('img[alt="TravelSync"]');
    expect(logoImg.exists()).toBe(true);
    expect(logoImg.attributes('src')).toBeTruthy();
    expect(wrapper.find('.earth-progress-shimmer').exists()).toBe(true);
  });

  it('renders custom loading message when provided', () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
        message: 'Preparing your next adventure…',
      },
    });

    expect(wrapper.text()).toContain('Preparing your next adventure…');
    expect(wrapper.find('.sr-only').text()).toBe('Preparing your next adventure…');
  });

  it('renders graceful CSS fallback when WebGL is unavailable (e.g. in test jsdom)', () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
    });

    // In jsdom without hardware acceleration, CSS fallback globe is rendered
    expect(wrapper.find('.earth-fallback-globe').exists()).toBe(true);
  });

  it('does not render overlay DOM when visible is false', () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: false,
      },
    });

    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('handles visibility toggle cleanly without error', async () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
    });

    expect(wrapper.find('[role="status"]').exists()).toBe(true);

    await wrapper.setProps({ visible: false });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    await wrapper.setProps({ visible: true });
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
  });

  it('unmounts cleanly without throwing errors', () => {
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
    });

    expect(() => {
      wrapper.unmount();
    }).not.toThrow();
  });
});

describe('useAppLoader composable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes in loading state and resolves after auth is initialized', async () => {
    const authStore = useAuthStore();
    authStore.initialized = false;

    const loader = useAppLoader();

    expect(loader.isVisible).toBe(true);
    expect(loader.loadingMessage).toBe('Getting your journey ready…');

    // Mark auth initialized
    authStore.initialized = true;
    await nextTick();

    // Advance time past MIN_INITIAL_DURATION (750ms)
    vi.advanceTimersByTime(800);
    await nextTick();

    expect(loader.isInitialLoading).toBe(false);
  });

  it('handles trip data loading with anti-flicker delay and proper messaging', async () => {
    const authStore = useAuthStore();
    const tripsStore = useTripsStore();

    authStore.initialized = true;
    const loader = useAppLoader();

    // Fast-forward initial loading completion
    vi.advanceTimersByTime(800);
    await nextTick();

    // Initial load should be done
    expect(loader.isVisible).toBe(false);

    // Simulate trips fetch starting
    tripsStore.loading = true;
    await nextTick();

    // Should NOT show immediately (flicker protection during the first 160ms)
    vi.advanceTimersByTime(50);
    expect(loader.isDataLoading).toBe(false);

    // Advance past debounce threshold (160ms)
    vi.advanceTimersByTime(150);
    expect(loader.isDataLoading).toBe(true);
    expect(loader.isVisible).toBe(true);
    expect(loader.loadingMessage).toBe('Preparing your next adventure…');

    // Simulate trips fetch finished
    tripsStore.loading = false;
    await nextTick();

    // Minimum visible duration (400ms) prevents abrupt disappearance
    vi.advanceTimersByTime(450);
    expect(loader.isDataLoading).toBe(false);
    expect(loader.isVisible).toBe(false);
  });

  it('supports explicit startLoading and stopLoading tasks with reference counting', async () => {
    const authStore = useAuthStore();
    authStore.initialized = true;

    const loader = useAppLoader();
    vi.advanceTimersByTime(800);
    await nextTick();

    loader.startLoading('Syncing destinations…');
    expect(loader.isVisible).toBe(true);
    expect(loader.loadingMessage).toBe('Syncing destinations…');

    loader.stopLoading();
    expect(loader.isVisible).toBe(false);
  });
});
