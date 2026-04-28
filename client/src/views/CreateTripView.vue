<template>
  <div class="bg-surface text-on-surface min-h-screen">
    <Navbar />

    <main class="relative flex items-center justify-center py-xl px-gutter min-h-[calc(100vh-64px)]">
      <div class="absolute inset-0 z-0 overflow-hidden opacity-50 pointer-events-none">
        <div class="w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-surface-container-high via-surface-container-low to-surface"></div>
      </div>
      <div class="relative z-10 w-full max-w-2xl mt-16">
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.1)] overflow-hidden">
          <div class="relative h-48 w-full bg-primary-container">
            <img alt="Trip Planning" class="w-full h-full object-cover mix-blend-overlay" src="https://images.unsplash.com/photo-1504280741564-9694ce213903?auto=format&fit=crop&q=80&w=1000" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-lg">
              <h2 class="font-h2 text-h2 text-white">Create New Trip</h2>
              <p class="font-body-md text-body-md text-white/80">Start your next collaborative adventure</p>
            </div>
          </div>
          <form @submit.prevent="submitForm" class="p-lg space-y-lg">
            <div v-if="error" class="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
              {{ error }}
            </div>
            <div class="space-y-sm">
              <label class="block font-label-sm text-label-sm text-on-surface" for="trip-name">
                  Trip Name <span class="text-error">*</span>
              </label>
              <div class="relative">
                <input v-model="form.name" class="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-body-md text-body-md outline-none" id="trip-name" placeholder="e.g., European Summer" required type="text"/>
              </div>
            </div>
            <div class="space-y-sm">
              <label class="block font-label-sm text-label-sm text-on-surface" for="destination">
                  Destination <span class="text-error">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="location_on">location_on</span>
                <input v-model="form.destination" class="w-full pl-xl pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-body-md text-body-md outline-none" id="destination" placeholder="e.g., Paris, France" required type="text"/>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div class="space-y-sm">
                <label class="block font-label-sm text-label-sm text-on-surface" for="start-date">
                    Start Date <span class="text-error">*</span>
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="calendar_today">calendar_today</span>
                  <input v-model="form.startDate" class="w-full pl-xl pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-body-md text-body-md outline-none" id="start-date" required type="date"/>
                </div>
              </div>
              <div class="space-y-sm">
                <label class="block font-label-sm text-label-sm text-on-surface" for="end-date">
                    End Date <span class="text-error">*</span>
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="event">event</span>
                  <input v-model="form.endDate" class="w-full pl-xl pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-body-md text-body-md outline-none" id="end-date" required type="date"/>
                </div>
              </div>
            </div>
            <div class="pt-md border-t border-outline-variant flex flex-col md:flex-row-reverse items-center gap-md">
              <button :disabled="loading" class="w-full md:w-auto px-xl py-3 bg-primary-container text-on-secondary rounded-lg font-h3 text-h3 hover:bg-primary transition-all active:scale-95 shadow-sm disabled:opacity-70" type="submit">
                  {{ loading ? 'Creating...' : 'Create Trip' }}
              </button>
              <button @click="$router.push('/dashboard')" class="w-full md:w-auto px-xl py-3 bg-transparent border border-outline-variant text-on-surface-variant rounded-lg font-h3 text-h3 hover:bg-surface-variant transition-all active:scale-95" type="button">
                  Cancel
              </button>
            </div>
          </form>
        </div>
        <div class="mt-lg grid grid-cols-1 md:grid-cols-3 gap-md opacity-70">
          <div class="p-md bg-white border border-outline-variant rounded-lg flex items-center gap-md">
            <span class="material-symbols-outlined text-primary" data-icon="group">group</span>
            <span class="font-label-sm text-label-sm">Share with friends</span>
          </div>
          <div class="p-md bg-white border border-outline-variant rounded-lg flex items-center gap-md">
            <span class="material-symbols-outlined text-primary" data-icon="cloud_sync">cloud_sync</span>
            <span class="font-label-sm text-label-sm">Auto-sync across devices</span>
          </div>
          <div class="p-md bg-white border border-outline-variant rounded-lg flex items-center gap-md">
            <span class="material-symbols-outlined text-primary" data-icon="map">map</span>
            <span class="font-label-sm text-label-sm">Offline map access</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import Navbar from '../components/Navbar.vue';

const router = useRouter();
const loading = ref(false);
const error = ref('');

const form = reactive({
  name: '',
  destination: '',
  startDate: '',
  endDate: ''
});

const submitForm = async () => {
  if (!form.name || !form.destination || !form.startDate || !form.endDate) {
    error.value = 'Please fill out all required fields.';
    return;
  }
  
  if (new Date(form.endDate) < new Date(form.startDate)) {
    error.value = 'End date cannot be before start date.';
    return;
  }

  try {
    loading.value = true;
    error.value = '';
    await api.post('/trips', form);
    router.push('/dashboard');
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to create trip. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
