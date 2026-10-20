<template>
  <AppLayout mainClass="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 flex items-center justify-center min-w-0">
      <div class="w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl shadow-sm overflow-hidden">
        <div class="relative h-48 w-full">
          <img 
            class="w-full h-full object-cover dark:brightness-90" 
            :src="coverImageUrl || DEFAULT_TRIP_COVER_IMAGE"
            :alt="form.name || form.destination || 'Edit Trip'"
            @error="onImgError"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#111210]/90 via-[#111210]/40 to-transparent"></div>
          <div class="absolute bottom-6 left-8">
            <h1 class="text-3xl font-extrabold text-white">Edit Trip</h1>
            <p class="text-sm text-[#D5D3CA] mt-1">Update the details of your adventure</p>
          </div>
        </div>

        <div v-if="loading" class="p-8 text-center text-[#575851] dark:text-[#A5A69B]">
          Loading trip data...
        </div>

        <form v-else @submit.prevent="submitForm" class="p-8 space-y-6">
          <div v-if="error" class="bg-[#C77F78]/10 border border-[#C77F78]/30 text-[#C77F78] p-3.5 rounded-xl text-sm">
            {{ error }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2" for="trip-name">Trip Name</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-lg" data-icon="edit">edit</span>
                <input v-model="form.name" class="w-full pl-10 pr-4 py-2.5 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl text-sm focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 transition-all" id="trip-name" type="text" required />
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2" for="destination">Destination</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-lg" data-icon="location_on">location_on</span>
                <input v-model="form.destination" class="w-full pl-10 pr-4 py-2.5 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl text-sm focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 transition-all" id="destination" type="text" required />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2" for="start-date">Start Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-lg" data-icon="calendar_today">calendar_today</span>
                <input v-model="form.startDate" class="w-full pl-10 pr-4 py-2.5 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl text-sm focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 transition-all" id="start-date" type="date" required />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2" for="end-date">End Date</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-lg" data-icon="event">event</span>
                <input v-model="form.endDate" class="w-full pl-10 pr-4 py-2.5 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl text-sm focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 transition-all" id="end-date" type="date" required />
              </div>
            </div>
          </div>
          <div class="pt-6 border-t border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row gap-3 items-center justify-end">
            <button @click="$router.push(`/trips/${route.params.id}`)" class="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-[#575851] dark:text-[#A5A69B] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] transition-colors border border-[#E3E0D8] dark:border-[#30312C] active:scale-95" type="button">
                Cancel
            </button>
            <button :disabled="saving" class="w-full sm:w-auto px-6 py-2.5 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] rounded-xl text-sm font-bold shadow-sm border border-[#A7A99A]/40 transition-all active:scale-95 disabled:opacity-70" type="submit">
                {{ saving ? 'Updating...' : 'Update Trip' }}
            </button>
          </div>
        </form>
      </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import AppLayout from '../components/AppLayout.vue';
import { DEFAULT_TRIP_COVER_IMAGE } from '../constants';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const coverImageUrl = ref('');

const onImgError = (e) => {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
};

const form = reactive({
  name: '',
  destination: '',
  startDate: '',
  endDate: ''
});

let originalStartDate = '';
let originalEndDate = '';

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  if (typeof dateString === 'string' && dateString.length >= 10) {
    return dateString.slice(0, 10);
  }
  const d = new Date(dateString);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fetchTrip = async () => {
  try {
    loading.value = true;
    error.value = '';
    const res = await api.get(`/trips/${route.params.id}`);
    const trip = res.data;
    
    coverImageUrl.value = trip.coverImageUrl || '';
    form.name = trip.name;
    form.destination = trip.destination;
    form.startDate = formatDateForInput(trip.startDate);
    form.endDate = formatDateForInput(trip.endDate);
    originalStartDate = form.startDate;
    originalEndDate = form.endDate;
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch trip details.';
  } finally {
    loading.value = false;
  }
};

const submitForm = async () => {
  if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
    error.value = 'End date cannot be before start date.';
    return;
  }

  try {
    saving.value = true;
    error.value = '';
    const payload = {
      name: form.name,
      destination: form.destination
    };
    if (form.startDate !== originalStartDate) {
      payload.startDate = form.startDate;
    }
    if (form.endDate !== originalEndDate) {
      payload.endDate = form.endDate;
    }
    await api.put(`/trips/${route.params.id}`, payload);
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
