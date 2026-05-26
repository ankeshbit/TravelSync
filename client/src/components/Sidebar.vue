<template>
  <div>
    <!-- Mobile drawer backdrop -->
    <div 
      v-if="isSidebarOpen" 
      @click="closeSidebar" 
      class="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
    ></div>

    <!-- Responsive Sidebar Drawer / Collapsible Icon Rail -->
    <aside 
      class="bg-gray-50 dark:bg-slate-950 font-['Plus_Jakarta_Sans'] text-sm font-medium fixed h-full left-0 top-0 border-r border-gray-200 dark:border-slate-800 flat flex flex-col p-4 gap-2 pt-20 z-40 transition-all duration-300"
      :class="[
        isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-16 lg:w-64'
      ]"
    >
      <nav class="flex flex-col gap-1">
        <router-link 
          to="/dashboard" 
          @click="closeSidebar"
          :class="isActive('/dashboard') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" 
          class="px-4 py-2 md:px-0 lg:px-4 flex items-center gap-3 md:gap-0 lg:gap-3 justify-start md:justify-center lg:justify-start active:scale-95 transition-all duration-150 rounded-lg"
        >
          <span class="material-symbols-outlined" :style="isActive('/dashboard') ? 'font-variation-settings: \'FILL\' 1;' : ''">map</span>
          <span class="inline md:hidden lg:inline opacity-100 md:opacity-0 lg:opacity-100 transition-opacity duration-300 ease-in-out lg:delay-150">My Trips</span>
        </router-link>
        
        <router-link 
          to="/explore" 
          @click="closeSidebar"
          :class="isActive('/explore') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" 
          class="px-4 py-2 md:px-0 lg:px-4 flex items-center gap-3 md:gap-0 lg:gap-3 justify-start md:justify-center lg:justify-start active:scale-95 transition-all duration-150 rounded-lg"
        >
          <span class="material-symbols-outlined" :style="isActive('/explore') ? 'font-variation-settings: \'FILL\' 1;' : ''">explore</span>
          <span class="inline md:hidden lg:inline opacity-100 md:opacity-0 lg:opacity-100 transition-opacity duration-300 ease-in-out lg:delay-150">Explore</span>
        </router-link>

        <router-link 
          to="/settings" 
          @click="closeSidebar"
          :class="isActive('/settings') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-900'" 
          class="px-4 py-2 md:px-0 lg:px-4 flex items-center gap-3 md:gap-0 lg:gap-3 justify-start md:justify-center lg:justify-start active:scale-95 transition-all duration-150 rounded-lg"
        >
          <span class="material-symbols-outlined" :style="isActive('/settings') ? 'font-variation-settings: \'FILL\' 1;' : ''">settings</span>
          <span class="inline md:hidden lg:inline opacity-100 md:opacity-0 lg:opacity-100 transition-opacity duration-300 ease-in-out lg:delay-150">Settings</span>
        </router-link>
      </nav>
    </aside>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { useSidebar } from '../composables/useSidebar';

const route = useRoute();
const { isSidebarOpen, closeSidebar } = useSidebar();

const isActive = (path) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard' || route.path.startsWith('/trips');
  }
  return route.path === path;
};
</script>
