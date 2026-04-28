<template>
  <div class="bg-surface text-on-surface min-h-screen">
    <Navbar />

    <main class="pt-24 pb-20 px-4 md:px-margin min-h-screen flex items-center justify-center">
      <div class="w-full max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.05)] overflow-hidden">
        <div class="relative h-48 w-full">
          <img class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=1000"/>
          <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent"></div>
          <div class="absolute bottom-6 left-8">
            <h1 class="font-h1 text-h1 text-primary">Edit Trip</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">Update the details of your adventure</p>
          </div>
        </div>

        <div v-if="loading" class="p-8 text-center text-on-surface-variant">
          Loading trip data...
        </div>

        <form v-else @submit.prevent="submitForm" class="p-8 space-y-6">
          <div v-if="error" class="bg-error-container text-on-error-container p-3 rounded-lg text-sm">
            {{ error }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div class="md:col-span-2">
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2" for="trip-name">Trip Name</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="edit">edit</span>
                <input v-model="form.name" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="trip-name" type="text" required />
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2" for="destination">Destination</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="location_on">location_on</span>
                <input v-model="form.destination" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="destination" type="text" required />
              </div>
            </div>
            <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2" for="start-date">Start Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="calendar_today">calendar_today</span>
                <input v-model="form.startDate" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="start-date" type="date" required />
              </div>
            </div>
            <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2" for="end-date">End Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="event">event</span>
                <input v-model="form.endDate" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="end-date" type="date" required />
              </div>
            </div>
          </div>
          <div class="pt-6 border-t border-outline-variant flex flex-col md:flex-row gap-4 items-center justify-end">
            <button @click="$router.push(`/trips/${route.params.id}`)" class="w-full md:w-auto px-8 py-3 rounded-full font-body-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors border border-outline-variant active:scale-95 duration-150" type="button">
                Cancel
            </button>
            <button :disabled="saving" class="w-full md:w-auto px-10 py-3 bg-primary-container text-on-primary-container rounded-full font-body-md font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95 duration-150 disabled:opacity-70" type="submit">
                {{ saving ? 'Updating...' : 'Update Trip' }}
            </button>
          </div>
        </form>
      </div>
    </main>

    <div class="hidden md:flex flex-col p-4 gap-2 fixed h-full left-0 top-0 w-64 bg-gray-50 dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 font-['Plus_Jakarta_Sans'] text-sm font-medium z-40 pt-20">
      <div class="space-y-1">
        <router-link to="/dashboard" class="text-gray-500 dark:text-gray-400 px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-900 transition-all cursor-pointer active:translate-x-1 duration-150">
          <span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
          <span>Dashboard</span>
        </router-link>
        <router-link to="/dashboard" class="bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 rounded-lg px-4 py-2 flex items-center gap-3 active:translate-x-1 duration-150">
          <span class="material-symbols-outlined" data-icon="map" style="font-variation-settings: 'FILL' 1;">map</span>
          <span>My Trips</span>
        </router-link>
        <router-link to="/explore" class="text-gray-500 dark:text-gray-400 px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-900 transition-all cursor-pointer active:translate-x-1 duration-150">
          <span class="material-symbols-outlined" data-icon="explore">explore</span>
          <span>Explore</span>
        </router-link>
        <router-link to="/settings" class="text-gray-500 dark:text-gray-400 px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-900 transition-all cursor-pointer active:translate-x-1 duration-150">
          <span class="material-symbols-outlined" data-icon="settings">settings</span>
          <span>Settings</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import Navbar from '../components/Navbar.vue';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const error = ref('');

const form = reactive({
  name: '',
  destination: '',
  startDate: '',
  endDate: ''
});

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

const fetchTrip = async () => {
  try {
    loading.value = true;
    error.value = '';
    const res = await api.get(`/trips/${route.params.id}`);
    const trip = res.data;
    
    form.name = trip.name;
    form.destination = trip.destination;
    form.startDate = formatDateForInput(trip.startDate);
    form.endDate = formatDateForInput(trip.endDate);
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch trip details.';
  } finally {
    loading.value = false;
  }
};

const submitForm = async () => {
  if (new Date(form.endDate) < new Date(form.startDate)) {
    error.value = 'End date cannot be before start date.';
    return;
  }

  try {
    saving.value = true;
    error.value = '';
    await api.put(`/trips/${route.params.id}`, form);
    router.push(`/trips/${route.params.id}`);
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to update trip. Please try again.';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchTrip();
});
</script>
