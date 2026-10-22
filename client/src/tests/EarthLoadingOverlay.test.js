import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import EarthLoadingOverlay, { _resetWebGLSupportCache } from '../components/EarthLoadingOverlay.vue';
import { useAppLoader } from '../composables/useAppLoader';
import { useAuthStore } from '../stores/auth';
import { useTripsStore } from '../stores/trips';

const mockRendererDispose = vi.fn();
const mockRendererSetSize = vi.fn();
const mockSceneInstances = [];
const mockRendererInstances = [];
const mockLoaderCallbacks = [];

vi.mock('three', () => ({
  Scene: vi.fn(function () {
    const s = { add: vi.fn() };
    mockSceneInstances.push(s);
    return s;
  }),
  PerspectiveCamera: vi.fn(function () {
    return { position: { z: 0 }, updateProjectionMatrix: vi.fn() };
  }),
  WebGLRenderer: vi.fn(function () {
    const r = {
      setSize: mockRendererSetSize,
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: mockRendererDispose,
    };
    mockRendererInstances.push(r);
    return r;
  }),
  Group: vi.fn(function () {
    return { add: vi.fn(), rotation: { z: 0, x: 0 } };
  }),
  SphereGeometry: vi.fn(function () {
    return { dispose: vi.fn() };
  }),
  MeshStandardMaterial: vi.fn(function () {
    return { dispose: vi.fn(), map: null, needsUpdate: false };
  }),
  Mesh: vi.fn(function () {
    return {
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn(), map: null, needsUpdate: false },
      rotation: { y: 0 },
    };
  }),
  ShaderMaterial: vi.fn(function () {
    return { dispose: vi.fn() };
  }),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(function () {
    return { position: { set: vi.fn() } };
  }),
  TextureLoader: vi.fn(function () {
    return {
      load: vi.fn((url, onLoad) => {
        mockLoaderCallbacks.push(onLoad);
      }),
    };
  }),
  CanvasTexture: vi.fn(function () {
    return { dispose: vi.fn(), colorSpace: '' };
  }),
  Texture: vi.fn(function () {
    return { dispose: vi.fn() };
  }),
  SRGBColorSpace: 'srgb',
  AdditiveBlending: 1,
  BackSide: 2,
}));

describe('EarthLoadingOverlay component', () => {
  let origGetContext;
  let origResizeObserver;
  let mockObserve;
  let mockDisconnect;
  let mockRemoveEventListener;

  beforeEach(() => {
    _resetWebGLSupportCache();
    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type && type.includes('webgl')) {
        return {
          getParameter: vi.fn().mockReturnValue(1),
          getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
        };
      }
      return { fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), clearRect: vi.fn() };
    };
    origResizeObserver = window.ResizeObserver;

    mockObserve = vi.fn();
    mockDisconnect = vi.fn();
    window.ResizeObserver = vi.fn(function () {
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: vi.fn(),
      };
    });

    mockRemoveEventListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: mockRemoveEventListener,
      addListener: vi.fn(),
      removeListener: mockRemoveEventListener,
    }));
  });

  afterEach(() => {
    _resetWebGLSupportCache();
    HTMLCanvasElement.prototype.getContext = origGetContext;
    window.ResizeObserver = origResizeObserver;
    vi.clearAllMocks();
  });

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

  it('renders graceful CSS fallback when WebGL is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = () => null;
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
    });

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

  it('show, hide, show again re-creates the scene and cleanup removes observer and listener', async () => {
    const loseContextMock = vi.fn();
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type.includes('webgl')) {
        return {
          getParameter: vi.fn().mockReturnValue(1),
          getExtension: vi.fn(() => ({ loseContext: loseContextMock })),
        };
      }
      return { fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), clearRect: vi.fn() };
    };

    const initialSceneCount = mockSceneInstances.length;
    const wrapper = mount(EarthLoadingOverlay, {
      props: {
        visible: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    // Allow dynamic import and initThree to execute
    await new Promise((r) => setTimeout(r, 20));

    expect(mockSceneInstances.length).toBeGreaterThan(initialSceneCount);
    const sceneCountAfterFirstShow = mockSceneInstances.length;

    // Hide overlay
    await wrapper.setProps({ visible: false });
    await nextTick();

    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockRendererDispose).toHaveBeenCalled();

    // Show overlay again: re-creates the Three.js scene
    await wrapper.setProps({ visible: true });
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockSceneInstances.length).toBeGreaterThan(sceneCountAfterFirstShow);

    // Unmount cleans up observer and matchMedia listener
    wrapper.unmount();
    expect(mockRemoveEventListener).toHaveBeenCalled();
  });

  it('unmount mid-load does not throw and texture callback guards against use after disposal', async () => {
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type.includes('webgl')) {
        return {
          getParameter: vi.fn().mockReturnValue(1),
          getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
        };
      }
      return { fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), clearRect: vi.fn() };
    };

    const wrapper = mount(EarthLoadingOverlay, {
      props: { visible: true },
      attachTo: document.body,
    });

    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    // Unmount before texture loader finishes
    expect(() => wrapper.unmount()).not.toThrow();

    // Invoke texture loader callback after unmount: should not throw
    expect(() => {
      for (const cb of mockLoaderCallbacks) {
        cb({ dispose: vi.fn() });
      }
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

  it('shows overlay only when cold load takes longer than 300ms, and fast load does not show overlay', async () => {
    const authStore = useAuthStore();
    authStore.initialized = false;

    const loader = useAppLoader();

    // Fast load: not shown immediately
    expect(loader.isVisible).toBe(false);

    // After 200ms (fast response), still not visible
    vi.advanceTimersByTime(200);
    expect(loader.isVisible).toBe(false);

    // Advance past 300ms: overlay becomes visible for slow load
    vi.advanceTimersByTime(150);
    expect(loader.isInitialLoading).toBe(true);
    expect(loader.isVisible).toBe(true);

    // Mark auth initialized: finishes initial load
    authStore.initialized = true;
    await nextTick();

    expect(loader.isInitialLoading).toBe(false);
    expect(loader.isVisible).toBe(false);
  });

  it('handles trip data loading with 300ms debounce delay and proper messaging', async () => {
    const authStore = useAuthStore();
    const tripsStore = useTripsStore();

    authStore.initialized = true;
    const loader = useAppLoader();

    // Initial load should be done immediately
    expect(loader.isVisible).toBe(false);

    // Simulate trips fetch starting
    tripsStore.loading = true;
    await nextTick();

    // Should NOT show immediately during the first 250ms
    vi.advanceTimersByTime(250);
    expect(loader.isDataLoading).toBe(false);

    // Advance past debounce threshold (300ms)
    vi.advanceTimersByTime(60);
    expect(loader.isDataLoading).toBe(true);
    expect(loader.isVisible).toBe(true);
    expect(loader.loadingMessage).toBe('Preparing your next adventure…');

    // Simulate trips fetch finished
    tripsStore.loading = false;
    await nextTick();

    // Minimum visible duration prevents abrupt disappearance
    vi.advanceTimersByTime(350);
    expect(loader.isDataLoading).toBe(false);
    expect(loader.isVisible).toBe(false);
  });

  it('supports explicit startLoading and stopLoading tasks with reference counting', async () => {
    const authStore = useAuthStore();
    authStore.initialized = true;

    const loader = useAppLoader();

    loader.startLoading('Syncing destinations…');
    expect(loader.isVisible).toBe(true);
    expect(loader.loadingMessage).toBe('Syncing destinations…');

    loader.stopLoading();
    expect(loader.isVisible).toBe(false);
  });
});
