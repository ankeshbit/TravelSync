<template>
  <div>
    <!-- Mobile-only Top Bar -->
    <header class="md:hidden bg-[#080D1A]/90 backdrop-blur-md border-b border-[#1E2E4E] flex justify-between items-center w-full px-4 py-3 fixed top-0 left-0 z-30">
      <div class="flex items-center gap-3">
        <button 
          @click="toggleSidebar" 
          class="text-slate-400 hover:text-white p-1 rounded-lg flex items-center justify-center"
          aria-label="Toggle Navigation Menu"
        >
          <span class="material-symbols-outlined text-2xl">menu</span>
        </button>

        <router-link to="/dashboard" class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <span class="material-symbols-outlined text-base">explore</span>
          </div>
          <span class="text-base font-bold text-white tracking-tight">TravelSync</span>
        </router-link>
      </div>

      <div class="flex items-center gap-3">
        <router-link to="/settings" class="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
          <span>{{ userInitials }}</span>
        </router-link>
      </div>
    </header>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSidebar } from '../composables/useSidebar';
import { useAuthStore } from '../stores/auth';

const { toggleSidebar } = useSidebar();
const authStore = useAuthStore();

const userInitials = computed(() => {
  const name = authStore.currentUser?.name || authStore.firebaseUser?.displayName || 'User';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
});
</script>
