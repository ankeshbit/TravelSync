<template>
  <div class="min-h-screen bg-[#F7F6F2] dark:bg-[#111210] text-[#1C1D1A] dark:text-[#D5D3CA] font-['Plus_Jakarta_Sans'] transition-colors duration-200">
    <!-- Mobile top bar -->
    <Navbar />

    <!-- Sidebar (fixed on desktop, drawer on mobile) -->
    <Sidebar />

    <!-- Main Content Canvas: handles desktop sidebar offset cleanly -->
    <div class="md:pl-64 flex flex-col min-h-screen w-full min-w-0 transition-all duration-300">
      <main :class="computedMainClass">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Navbar from './Navbar.vue';
import Sidebar from './Sidebar.vue';

const props = defineProps({
  mainClass: {
    type: String,
    default: ''
  }
});

const defaultMainClass = 'flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-16 md:pt-8 pb-16 min-w-0';

const computedMainClass = computed(() => {
  return props.mainClass || defaultMainClass;
});
</script>
