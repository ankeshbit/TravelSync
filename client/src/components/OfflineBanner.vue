<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform -translate-y-4 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform -translate-y-4 opacity-0"
  >
    <div 
      v-if="isOffline" 
      class="bg-amber-600/95 dark:bg-amber-700/95 text-white shadow-md z-50 sticky top-0 px-4 py-2.5 backdrop-blur-md border-b border-amber-500/30"
    >
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="material-symbols-outlined text-[20px] animate-pulse">cloud_off</span>
          <p class="font-medium truncate">
            <span class="font-bold">You're currently offline.</span> Your downloaded travel companion data remains available on this device.
          </p>
        </div>
        
        <div class="flex items-center gap-2.5 flex-shrink-0">
          <router-link
            to="/offline-trips"
            class="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold transition-colors flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-[16px]">folder_special</span>
            <span>Offline Trips</span>
          </router-link>
          
          <button
            @click="handleCheckConnection"
            :disabled="checking"
            class="px-3 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Check backend reachability"
          >
            <span class="material-symbols-outlined text-[16px]" :class="{ 'animate-spin': checking }">refresh</span>
            <span>{{ checking ? 'Checking...' : 'Check Connection' }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue';
import { useConnectivity } from '../composables/useConnectivity';

const { isOffline, checkServerReachability } = useConnectivity();
const checking = ref(false);

async function handleCheckConnection() {
  checking.value = true;
  try {
    await checkServerReachability();
  } finally {
    checking.value = false;
  }
}
</script>
