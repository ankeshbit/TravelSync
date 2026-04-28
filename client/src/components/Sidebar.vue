<template>
  <aside class="bg-gray-50 dark:bg-slate-950 font-['Plus_Jakarta_Sans'] text-sm font-medium fixed h-full left-0 top-0 w-64 border-r border-gray-200 dark:border-slate-800 flat hidden md:flex flex-col p-4 gap-2 pt-20 z-40">
    <nav class="flex flex-col gap-1">
      <router-link to="/dashboard" :class="isActive('/dashboard') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" class="px-4 py-2 flex items-center gap-3 transition-all active:translate-x-1 duration-150">
        <span class="material-symbols-outlined" :style="isActive('/dashboard') ? 'font-variation-settings: \'FILL\' 1;' : ''">map</span>
        My Trips
      </router-link>
      <router-link to="/explore" :class="isActive('/explore') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" class="px-4 py-2 flex items-center gap-3 transition-all active:translate-x-1 duration-150">
        <span class="material-symbols-outlined" :style="isActive('/explore') ? 'font-variation-settings: \'FILL\' 1;' : ''">explore</span>
        Explore
      </router-link>
      <router-link to="/settings" :class="isActive('/settings') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" class="px-4 py-2 flex items-center gap-3 transition-all active:translate-x-1 duration-150">
        <span class="material-symbols-outlined" :style="isActive('/settings') ? 'font-variation-settings: \'FILL\' 1;' : ''">settings</span>
        Settings
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const isActive = (path) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard' || route.path.startsWith('/trips');
  }
  return route.path === path;
};
</script>
