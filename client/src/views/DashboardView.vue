<template>
  <div class="min-h-screen bg-surface">
    <Navbar />
    <Sidebar />

    <main class="md:ml-64 pt-24 pb-20 px-6 md:px-10 max-w-7xl mx-auto">
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 class="font-h1 text-h1 text-on-background">My Trips</h1>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">Manage and plan your upcoming adventures together.</p>
        </div>
        <router-link to="/trips/create" class="bg-primary-container text-on-secondary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md">
          <span class="material-symbols-outlined">add</span>
          Create Trip
        </router-link>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-20">
        <p class="text-lg text-on-surface-variant">Loading trips...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-error-container text-on-error-container p-4 rounded-xl mb-6">
        {{ error }}
      </div>

      <!-- Content -->
      <template v-else>
        <!-- Grid of Trips -->
        <section v-if="trips.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          <TripCard 
            v-for="trip in trips" 
            :key="trip._id" 
            :trip="trip" 
            @click="goToTrip(trip._id)" 
          />
          
          <!-- Add New Placeholder Card -->
          <router-link to="/trips/create" class="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-10 bg-gray-50/50 hover:bg-gray-50 transition-colors group cursor-pointer">
          <div class="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-blue-900 text-3xl">add_location_alt</span>
          </div>
          <h3 class="font-h3 text-h3 text-blue-900 mb-2">New Adventure?</h3>
          <p class="font-body-md text-body-md text-gray-500 text-center max-w-[200px]">Start planning your next destination with friends.</p>
        </router-link>
        </section>

        <!-- Empty State -->
        <section v-if="!loading && trips.length === 0" class="mt-20 py-20 border-t border-gray-100">
          <div class="flex flex-col items-center text-center">
            <div class="w-32 h-32 bg-surface-container-low rounded-full flex items-center justify-center mb-6">
              <span class="material-symbols-outlined text-6xl text-outline-variant">travel_explore</span>
            </div>
            <h2 class="font-h2 text-h2 text-on-background mb-4">No trips yet</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant max-w-3xl mb-8">
              Your journey begins here. Create your first trip itinerary and invite your travel companions to collaborate in real-time.
            </p>
            <router-link to="/trips/create" class="bg-primary-container text-on-secondary px-8 py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all">
              Start Planning
            </router-link>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import TripCard from '../components/TripCard.vue';

const router = useRouter();
const trips = ref([]);
const loading = ref(true);
const error = ref('');

const fetchTrips = async () => {
  try {
    loading.value = true;
    error.value = '';
    const res = await api.get('/trips');
    trips.value = res.data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch trips. Please try again.';
  } finally {
    loading.value = false;
  }
};

const goToTrip = (id) => {
  router.push(`/trips/${id}`);
};

onMounted(() => {
  fetchTrips();
});
</script>
