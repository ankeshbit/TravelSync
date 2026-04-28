<template>
  <ToastNotification />
  <router-view />
</template>

<script setup>
import { onErrorCaptured } from 'vue';
import { useToastStore } from './stores/toast';
import { useDarkMode } from './composables/useDarkMode';
import ToastNotification from './components/ToastNotification.vue';

const toastStore = useToastStore();
const { isDarkMode } = useDarkMode();

onErrorCaptured((err) => {
  console.error('Uncaught component error:', err);
  toastStore.showToast('Something went wrong. Please try again.', 'error');
  return false;
});
</script>
