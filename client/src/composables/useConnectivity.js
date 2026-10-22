import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../api';

const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const isServerReachable = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const lastChecked = ref(null);
let checkTimer = null;

async function checkServerReachability() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    isOnline.value = false;
    isServerReachable.value = false;
    lastChecked.value = new Date().toISOString();
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('/api/recommendations/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    const ok = res.status < 500;
    isServerReachable.value = ok;
    isOnline.value = true;
    lastChecked.value = new Date().toISOString();
    return ok;
  } catch (err) {
    // If request failed or timed out, backend is not currently reachable
    isServerReachable.value = false;
    lastChecked.value = new Date().toISOString();
    return false;
  }
}

function handleOnline() {
  isOnline.value = true;
  checkServerReachability();
}

function handleOffline() {
  isOnline.value = false;
  isServerReachable.value = false;
}

export function useConnectivity() {
  const isOffline = computed(() => !isOnline.value || !isServerReachable.value);

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Heartbeat every 30 seconds while window is active
      if (!checkTimer) {
        checkTimer = setInterval(() => {
          if (document.visibilityState === 'visible') {
            checkServerReachability();
          }
        }, 30000);
      }
    }
  });

  onUnmounted(() => {
    // Keep listeners alive globally if needed, or remove per component instance
  });

  return {
    isOnline,
    isServerReachable,
    isOffline,
    lastChecked,
    checkServerReachability
  };
}
