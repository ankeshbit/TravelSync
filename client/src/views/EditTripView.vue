<template>
  <div class="bg-surface text-on-surface min-h-screen dark:bg-slate-950 transition-colors duration-200">
    <Navbar />
    <Sidebar />

    <main class="md:ml-16 lg:ml-64 pt-24 pb-20 px-4 md:px-8 min-h-[calc(100vh-64px)] flex items-center justify-center transition-all duration-300">
      <div class="w-full max-w-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.05)] overflow-hidden">
        <div class="relative h-48 w-full">
          <img class="w-full h-full object-cover dark:brightness-90" src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=1000"/>
          <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest dark:from-slate-900 via-transparent to-transparent"></div>
          <div class="absolute bottom-6 left-8">
            <h1 class="font-h1 text-h1 text-primary dark:text-blue-400">Edit Trip</h1>
            <p class="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Update the details of your adventure</p>
          </div>
        </div>

        <div v-if="loading" class="p-8 text-center text-on-surface-variant dark:text-slate-400">
          Loading trip data...
        </div>

        <form v-else @submit.prevent="submitForm" class="p-8 space-y-6">
          <div v-if="error" class="bg-error-container text-on-error-container p-3 rounded-lg text-sm">
            {{ error }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div class="md:col-span-2">
              <label class="block font-label-sm text-label-sm text-on-surface-variant dark:text-slate-300 mb-2" for="trip-name">Trip Name</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400 text-lg" data-icon="edit">edit</span>
                <input v-model="form.name" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="trip-name" type="text" required />
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block font-label-sm text-label-sm text-on-surface-variant dark:text-slate-300 mb-2" for="destination">Destination</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400 text-lg" data-icon="location_on">location_on</span>
                <input v-model="form.destination" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="destination" type="text" required />
              </div>
            </div>
            <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant dark:text-slate-300 mb-2" for="start-date">Start Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400 text-lg" data-icon="calendar_today">calendar_today</span>
                <input v-model="form.startDate" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="start-date" type="date" required />
              </div>
            </div>
            <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant dark:text-slate-300 mb-2" for="end-date">End Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400 text-lg" data-icon="event">event</span>
                <input v-model="form.endDate" class="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" id="end-date" type="date" required />
              </div>
            </div>
          </div>
          <div class="pt-6 border-t border-outline-variant dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-end">
            <button @click="$router.push(`/trips/${route.params.id}`)" class="w-full md:w-auto px-8 py-3 rounded-full font-body-md font-semibold text-on-surface-variant dark:text-slate-300 hover:bg-surface-container dark:hover:bg-slate-800 transition-colors border border-outline-variant dark:border-slate-700 active:scale-95 duration-150" type="button">
                Cancel
            </button>
            <button :disabled="saving" class="w-full md:w-auto px-10 py-3 bg-primary dark:bg-blue-600 text-white rounded-full font-body-md font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95 duration-150 disabled:opacity-70" type="submit">
                {{ saving ? 'Updating...' : 'Update Trip' }}
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';

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
