<template>
  <EarthLoadingOverlay
    :visible="appLoader.isVisible"
    :message="appLoader.loadingMessage"
  />
  <ToastNotification />
  <router-view />
</template>

<script setup>
import { onErrorCaptured } from 'vue';
import { useToastStore } from './stores/toast';
import { useDarkMode } from './composables/useDarkMode';
import { useAppLoader } from './composables/useAppLoader';
import ToastNotification from './components/ToastNotification.vue';
import EarthLoadingOverlay from './components/EarthLoadingOverlay.vue';

const toastStore = useToastStore();
const { isDarkMode } = useDarkMode();
const appLoader = useAppLoader();

onErrorCaptured((err) => {
  console.error('Uncaught component error:', err);
  toastStore.showToast('Something went wrong. Please try again.', 'error');
  return false;
});
</script>
