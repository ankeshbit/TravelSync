<template>
  <div>
    <!-- Mobile-only Top Bar -->
    <header class="md:hidden bg-[#EFECE6]/95 dark:bg-[#141512]/95 backdrop-blur-md border-b border-[#E3E0D8] dark:border-[#30312C] flex justify-between items-center w-full px-4 py-3 fixed top-0 left-0 z-30 transition-colors">
      <div class="flex items-center gap-3">
        <button 
          @click="toggleSidebar" 
          class="text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] p-1 rounded-lg flex items-center justify-center transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <span class="material-symbols-outlined text-2xl">menu</span>
        </button>

        <router-link to="/dashboard" class="flex items-center gap-2">
          <img :src="logoUrl" alt="TravelSync" class="w-7 h-7 object-contain rounded-lg shadow-sm" />
          <span class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">TravelSync</span>
        </router-link>
      </div>

      <div class="flex items-center gap-2">
        <ThemeToggle />
        <router-link to="/settings" class="w-8 h-8 rounded-full bg-[#4A4D40] dark:bg-[#292A25] text-[#D5D3CA] border border-[#414239] font-bold flex items-center justify-center text-xs shadow-sm overflow-hidden" aria-label="Account Settings">
          <img 
            v-if="userPicture" 
            :src="userPicture" 
            alt="Profile" 
            class="w-full h-full object-cover rounded-full"
          />
          <span v-else>{{ userInitials }}</span>
        </router-link>
      </div>
    </header>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSidebar } from '../composables/useSidebar';
import { useAuthStore } from '../stores/auth';
import { getBaseUrl } from '../utils/url';
import logoUrl from '../assets/logo.png';
import ThemeToggle from './ThemeToggle.vue';

const { toggleSidebar } = useSidebar();
const authStore = useAuthStore();

const userPicture = computed(() => {
  const pic = authStore.currentUser?.picture;
  if (!pic) return null;
  if (pic.startsWith('http')) return pic;
  return `${getBaseUrl()}${pic}`;
});

const userInitials = computed(() => {
  const name = authStore.currentUser?.name || authStore.firebaseUser?.displayName || 'User';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
});
</script>
