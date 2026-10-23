<template>
  <EarthLoadingOverlay
    :visible="appLoader.isVisible"
    :message="appLoader.loadingMessage"
  />
  <OfflineBanner />
  <ToastNotification />
  <router-view />
  <TravelChatbot v-if="showChatbot" />
</template>

<script setup>
import { computed, onErrorCaptured, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useToastStore } from './stores/toast';
import { useDarkMode } from './composables/useDarkMode';
import { useAppLoader } from './composables/useAppLoader';
import ToastNotification from './components/ToastNotification.vue';
import OfflineBanner from './components/OfflineBanner.vue';
import TravelChatbot from './components/TravelChatbot.vue';

const EarthLoadingOverlay = defineAsyncComponent(() =>
  import('./components/EarthLoadingOverlay.vue')
);

const route = useRoute();
const toastStore = useToastStore();
const { isDarkMode } = useDarkMode();
const appLoader = useAppLoader();

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/verify-email'];
const showChatbot = computed(() => {
  if (!route || !route.path) return true;
  return !AUTH_PAGES.includes(route.path);
});

onErrorCaptured((err) => {
  console.error('Uncaught component error:', err);
  toastStore.showToast('Something went wrong. Please try again.', 'error');
  return false;
});
</script>
