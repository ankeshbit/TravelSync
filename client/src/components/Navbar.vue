<template>
  <div>
    <!-- Desktop Navbar -->
    <header class="bg-white/90 dark:bg-slate-950/90 backdrop-blur-md font-['Plus_Jakarta_Sans'] text-sm antialiased docked full-width top-0 z-50 border-b border-gray-100 dark:border-slate-800 shadow-sm dark:shadow-none flex justify-between items-center w-full px-6 py-3 max-w-full fixed">
      <router-link to="/dashboard" class="flex items-center gap-2 group">
        <img src="/logo.png" alt="TravelSync" class="h-8 w-8 object-contain transition-transform group-hover:scale-110" />
        <span class="text-xl font-extrabold tracking-tight text-blue-900 dark:text-blue-50">TravelSync</span>
      </router-link>
      <nav class="hidden md:flex items-center gap-8">
        <router-link to="/dashboard" :class="isActive('/dashboard') ? 'text-blue-900 dark:text-blue-400 font-semibold border-b-2 border-blue-900 dark:border-blue-400 pb-1' : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-900'" class="transition-colors cursor-pointer active:scale-95 duration-200">My Trips</router-link>
        <router-link to="/explore" :class="isActive('/explore') ? 'text-blue-900 dark:text-blue-400 font-semibold border-b-2 border-blue-900 dark:border-blue-400 pb-1' : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-900'" class="transition-colors cursor-pointer active:scale-95 duration-200">Explore</router-link>
        <router-link to="/settings" :class="isActive('/settings') ? 'text-blue-900 dark:text-blue-400 font-semibold border-b-2 border-blue-900 dark:border-blue-400 pb-1' : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-900'" class="transition-colors cursor-pointer active:scale-95 duration-200">Settings</router-link>
      </nav>
      <div class="flex items-center gap-4">
        <ThemeToggle />
        <button class="material-symbols-outlined text-gray-500 hover:text-blue-900 dark:text-slate-400 dark:hover:text-blue-400 transition-colors duration-200">notifications</button>
        <button @click="handleLogout" class="material-symbols-outlined text-gray-500 hover:text-blue-900 dark:text-slate-400 dark:hover:text-blue-400 transition-colors duration-200" title="Logout">logout</button>
        <div class="w-8 h-8 rounded-full overflow-hidden border border-outline-variant dark:border-slate-700 bg-surface-container dark:bg-slate-800 flex items-center justify-center text-primary dark:text-blue-400 font-bold transition-colors duration-200">
            <img
              v-if="userPicture"
              :src="userPicture"
              alt="Profile"
              class="w-full h-full object-cover"
            />
            <span v-else>{{ userInitials }}</span>
          </div>
      </div>
    </header>

    <!-- Bottom Nav for Mobile -->
    <nav class="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-xl">
      <router-link to="/dashboard" :class="isActive('/dashboard') ? 'text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl scale-110' : 'text-gray-400 dark:text-gray-500 hover:text-blue-900 dark:hover:text-blue-400'" class="flex flex-col items-center px-4 py-2 duration-200">
        <span class="material-symbols-outlined" :style="isActive('/dashboard') ? 'font-variation-settings: \'FILL\' 1;' : ''">luggage</span>
        <span class="font-['Plus_Jakarta_Sans'] text-[10px] font-bold">Trips</span>
      </router-link>
      <router-link to="/explore" :class="isActive('/explore') ? 'text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl scale-110' : 'text-gray-400 dark:text-gray-500 hover:text-blue-900 dark:hover:text-blue-400'" class="flex flex-col items-center px-4 py-2 duration-200">
        <span class="material-symbols-outlined" :style="isActive('/explore') ? 'font-variation-settings: \'FILL\' 1;' : ''">explore</span>
        <span class="font-['Plus_Jakarta_Sans'] text-[10px] font-bold">Explore</span>
      </router-link>
      <router-link to="/settings" :class="isActive('/settings') ? 'text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl scale-110' : 'text-gray-400 dark:text-gray-500 hover:text-blue-900 dark:hover:text-blue-400'" class="flex flex-col items-center px-4 py-2 duration-200">
        <span class="material-symbols-outlined" :style="isActive('/settings') ? 'font-variation-settings: \'FILL\' 1;' : ''">person</span>
        <span class="font-['Plus_Jakarta_Sans'] text-[10px] font-bold">Profile</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import ThemeToggle from './ThemeToggle.vue';

const route = useRoute();
const router = useRouter();

const isActive = (path) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard' || route.path.startsWith('/trips');
  }
  return route.path === path;
};

// Fetch user info from localStorage if present
const userInitials = computed(() => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.name ? user.name.substring(0, 2).toUpperCase() : 'U';
    } catch(e) {}
  }
  return 'U';
});

// Build the full photo URL from the stored relative path
const userPicture = computed(() => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.picture) {
        const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
        return `${base}${user.picture}`;
      }
    } catch(e) {}
  }
  return '';
});

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};
</script>
