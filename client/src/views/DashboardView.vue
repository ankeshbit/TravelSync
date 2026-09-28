<template>
  <div class="min-h-screen bg-[#080D1A] text-slate-100 font-['Plus_Jakarta_Sans'] flex">
    <Navbar />
    <Sidebar />

    <!-- Main Content Area -->
    <main class="flex-1 md:pl-64 pt-16 md:pt-8 pb-16 px-6 md:px-10 transition-all duration-300 max-w-7xl mx-auto w-full">
      <!-- Top Bar: Title & Actions -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">My Trips</h1>
          <p class="text-sm text-slate-400 mt-1">Manage and plan your upcoming adventures together.</p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Search Trips Input -->
          <div class="relative w-full sm:w-64">
            <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search trips..."
              class="w-full bg-[#111C33] border border-[#1E2E4E] text-sm text-white placeholder-slate-400 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <!-- Create Trip Button -->
          <button 
            @click="showCreateModal = true" 
            class="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex-shrink-0"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Create Trip</span>
          </button>
        </div>
      </header>

      <!-- Overview Statistics Summary Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <!-- Total Trips -->
        <div class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-blue-500/40 transition-colors shadow-lg">
          <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">explore</span>
          </div>
          <div>
            <p class="text-xs font-medium text-slate-400">Total Trips</p>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded"></span>
              <span v-else>{{ summary.totalTrips }}</span>
            </h3>
          </div>
        </div>

        <!-- Upcoming Trips -->
        <div class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-emerald-500/40 transition-colors shadow-lg">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">calendar_month</span>
          </div>
          <div>
            <p class="text-xs font-medium text-slate-400">Upcoming Trips</p>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded"></span>
              <span v-else>{{ summary.upcomingTrips }}</span>
            </h3>
          </div>
        </div>

        <!-- Total Members -->
        <div class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-indigo-500/40 transition-colors shadow-lg">
          <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">groups</span>
          </div>
          <div>
            <p class="text-xs font-medium text-slate-400">Total Members</p>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-slate-800 animate-pulse rounded"></span>
              <span v-else>{{ summary.totalMembers }}</span>
            </h3>
          </div>
        </div>

        <!-- Total Spent -->
        <div class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-amber-500/40 transition-colors shadow-lg">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">payments</span>
          </div>
          <div>
            <p class="text-xs font-medium text-slate-400">Total Spent</p>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              <span v-if="summaryLoading" class="inline-block w-16 h-6 bg-slate-800 animate-pulse rounded"></span>
              <span v-else>{{ formatCurrency(summary.totalSpent, summary.currency) }}</span>
            </h3>
          </div>
        </div>
      </div>

      <!-- Filter Tabs Row -->
      <div class="flex items-center gap-2 mb-8">
        <button 
          v-for="tab in ['All Trips', 'Upcoming', 'Past']" 
          :key="tab"
          @click="activeFilter = tab"
          :class="activeFilter === tab ? 'bg-[#122347] text-blue-400 font-semibold border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-[#111C33] font-medium border border-transparent'"
          class="px-4 py-1.5 rounded-xl text-xs transition-all duration-200"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading && trips.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        <div v-for="n in 3" :key="n" class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl h-80 overflow-hidden flex flex-col">
          <div class="h-44 w-full bg-[#131F38]"></div>
          <div class="p-5 space-y-3">
            <div class="h-5 w-3/4 bg-[#1E2E4E] rounded"></div>
            <div class="h-4 w-1/2 bg-[#1E2E4E] rounded"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-950/40 border border-red-900 text-red-300 p-4 rounded-xl mb-6 text-sm">
        {{ error }}
      </div>

      <!-- Empty State -->
      <div v-else-if="displayTrips.length === 0" class="text-center py-16 bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-8 flex flex-col items-center justify-center">
        <div class="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
          <span class="material-symbols-outlined text-3xl">luggage</span>
        </div>
        <h3 class="text-lg font-bold text-white mb-1.5">No trips found</h3>
        <p class="text-xs text-slate-400 max-w-sm mb-6">
          {{ searchQuery ? `No trips matching "${searchQuery}"` : "You haven't planned any trips yet. Create your first adventure!" }}
        </p>
        <button 
          v-if="!searchQuery"
          @click="showCreateModal = true" 
          class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[16px]">add</span>
          <span>Create Trip</span>
        </button>
      </div>

      <!-- Trip Cards Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TripCard 
          v-for="trip in displayTrips" 
          :key="trip.id || trip._id" 
          :trip="trip" 
          @click="goToTrip(trip.id || trip._id)" 
        />
      </section>
    </main>

    <!-- Create Trip Modal -->
    <CreateTripModal 
      v-model:isOpen="showCreateModal" 
      :initialDestination="initialDestination"
      @trip-created="onTripCreated" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import TripCard from '../components/TripCard.vue';
import CreateTripModal from '../components/CreateTripModal.vue';
import { useTripsStore } from '../stores/trips';
import api from '../api';
import { formatCurrency } from '../utils/format';

const router = useRouter();
const route = useRoute();
const tripsStore = useTripsStore();
const { trips, loading, error } = storeToRefs(tripsStore);

const activeFilter = ref('Upcoming');
const searchQuery = ref('');
const initialDestination = ref('');
const showCreateModal = ref(false);

const summary = ref({
  totalTrips: 0,
  upcomingTrips: 0,
  totalMembers: 0,
  totalSpent: 0,
  currency: 'USD'
});
const summaryLoading = ref(true);

const fetchSummary = async () => {
  try {
    const res = await api.get('/trips/summary');
    if (res.data) {
      summary.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch trips summary:', err);
  } finally {
    summaryLoading.value = false;
  }
};

const displayTrips = computed(() => {
  let list = Array.isArray(trips.value) ? trips.value : [];

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(t => 
      (t.name && t.name.toLowerCase().includes(q)) || 
      (t.destination && t.destination.toLowerCase().includes(q))
    );
  }

  if (activeFilter.value === 'Upcoming') {
    return list.filter(t => t.status !== 'completed');
  } else if (activeFilter.value === 'Past') {
    return list.filter(t => t.status === 'completed');
  }

  return list;
});

const onTripCreated = (trip) => {
  const newTripId = trip.id || trip._id;
  if (trip && !trips.value.some(existingTrip => (existingTrip.id || existingTrip._id) === newTripId)) {
    trips.value.unshift(trip);
    fetchSummary();
  }
};

const goToTrip = (id) => {
  router.push(`/trips/${id}`);
};

onMounted(() => {
  tripsStore.fetchTrips();
  fetchSummary();
  if (route.query.create) {
    initialDestination.value = route.query.dest || '';
    showCreateModal.value = true;
    router.replace({ path: route.path, query: {} }).catch(() => {});
  }
});
</script>
