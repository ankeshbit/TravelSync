<template>
  <div class="min-h-screen bg-surface dark:bg-slate-950 flex flex-col items-center justify-center px-6">
    <div class="text-center max-w-md">
      <!-- Logo and Branding -->
      <div class="mb-12 flex items-center justify-center gap-3">
        <img src="/logo.png" alt="TravelSync" class="h-10 w-10 object-contain" />
        <h1 class="text-2xl font-bold text-on-surface dark:text-on-surface">TravelSync</h1>
      </div>

      <!-- Error Content -->
      <div class="w-24 h-24 bg-surface-container dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
        <span class="material-symbols-outlined text-6xl text-outline-variant dark:text-slate-600">error_outline</span>
      </div>
      <h2 class="text-h1 text-on-surface dark:text-white mb-3">Page Not Found</h2>
      <p class="text-body-md text-on-surface-variant dark:text-slate-400 mb-8">The page you're looking for doesn't exist. Let's get you back on track.</p>
      <router-link to="/dashboard" class="inline-block bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
        Back to Dashboard
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>
