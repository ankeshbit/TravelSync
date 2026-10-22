import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripsStore } from '../stores/trips';

export const useAppLoader = defineStore('appLoader', () => {
  const authStore = useAuthStore();
  const tripsStore = useTripsStore();

  const isInitialLoading = ref(false);
  const isDataLoading = ref(false);
  const customLoadingCount = ref(0);
  const customMessage = ref('');
  const loadingMessage = ref('Getting your journey ready…');

  const COLD_LOAD_DELAY = 300;    // ms delay before showing overlay on cold load
  const DATA_DEBOUNCE_DELAY = 300;  // ms debounce before showing overlay for subsequent requests
  const MIN_DATA_DURATION = 300;    // ms minimum visible duration once overlay is shown

  let dataDebounceTimer = null;
  let dataShownAt = 0;
  let dataHideTimer = null;
  let initialTimer = null;

  function finishInitialLoad() {
    if (initialTimer) {
      clearTimeout(initialTimer);
      initialTimer = null;
    }
    isInitialLoading.value = false;
  }

  // ── 1. Initial Authentication Restoration ──────────────────────────────────
  if (!authStore.initialized) {
    initialTimer = setTimeout(() => {
      initialTimer = null;
      if (!authStore.initialized) {
        isInitialLoading.value = true;
      }
    }, COLD_LOAD_DELAY);

    const stopAuthWatch = watch(
      () => authStore.initialized,
      (initialized) => {
        if (initialized) {
          finishInitialLoad();
          stopAuthWatch();
        }
      }
    );

    // Safety fallback: never leave user stuck if Firebase session fails completely
    setTimeout(() => {
      finishInitialLoad();
    }, 6000);
  }

  // ── 2. Trip Data Loading & Anti-Flicker Timing ─────────────────────────────
  watch(
    () => tripsStore.loading,
    (isLoading) => {
      if (isInitialLoading.value) return;

      if (isLoading) {
        if (dataHideTimer) {
          clearTimeout(dataHideTimer);
          dataHideTimer = null;
        }

        // Delay showing overlay to avoid flicker on fast responses
        if (!dataDebounceTimer && !isDataLoading.value) {
          dataDebounceTimer = setTimeout(() => {
            dataDebounceTimer = null;
            if (tripsStore.loading) {
              loadingMessage.value = 'Preparing your next adventure…';
              dataShownAt = Date.now();
              isDataLoading.value = true;
            }
          }, DATA_DEBOUNCE_DELAY);
        }
      } else {
        // Request completed or failed
        if (dataDebounceTimer) {
          clearTimeout(dataDebounceTimer);
          dataDebounceTimer = null;
        }

        if (isDataLoading.value) {
          const visibleDuration = Date.now() - dataShownAt;
          const remaining = Math.max(0, MIN_DATA_DURATION - visibleDuration);
          dataHideTimer = setTimeout(() => {
            dataHideTimer = null;
            isDataLoading.value = false;
          }, remaining);
        }
      }
    }
  );

  // ── 3. Manual Reference-Counted Tasks ──────────────────────────────────────
  function startLoading(msg = 'Preparing your next adventure…') {
    customLoadingCount.value += 1;
    if (msg) customMessage.value = msg;
  }

  function stopLoading() {
    if (customLoadingCount.value > 0) {
      customLoadingCount.value -= 1;
    }
    if (customLoadingCount.value === 0) {
      customMessage.value = '';
    }
  }

  // ── 4. Reactive Visibility & Active Message ───────────────────────────────
  const isVisible = computed(() => {
    return isInitialLoading.value || isDataLoading.value || customLoadingCount.value > 0;
  });

  const currentMessage = computed(() => {
    if (isInitialLoading.value) {
      return 'Getting your journey ready…';
    }
    if (customLoadingCount.value > 0 && customMessage.value) {
      return customMessage.value;
    }
    if (isDataLoading.value) {
      return 'Preparing your next adventure…';
    }
    return loadingMessage.value;
  });

  return {
    isVisible,
    loadingMessage: currentMessage,
    isInitialLoading,
    isDataLoading,
    startLoading,
    stopLoading,
  };
});
