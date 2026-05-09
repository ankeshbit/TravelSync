<template>
  <button 
    @click="toggleDarkMode" 
    class="relative p-2 rounded-full text-outline hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors duration-200 overflow-hidden"
    aria-label="Toggle dark mode"
  >
    <div class="relative w-6 h-6 flex items-center justify-center">
      <!-- Sun Icon (Light Mode) -->
      <span 
        class="material-symbols-outlined absolute transition-all duration-300 transform"
        :class="isDarkMode ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'"
      >
        light_mode
      </span>
      
      <!-- Moon Icon (Dark Mode) -->
      <span 
        class="material-symbols-outlined absolute transition-all duration-300 transform"
        :class="isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'"
      >
        dark_mode
      </span>
    </div>
  </button>
</template>

<script setup>
import { useDarkMode } from '../composables/useDarkMode';

const { isDarkMode, toggleDarkMode } = useDarkMode();
</script>
