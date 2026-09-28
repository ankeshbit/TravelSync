<template>
  <div class="min-h-screen bg-[#080D1A] text-slate-100 font-['Plus_Jakarta_Sans'] flex">
    <Navbar />
    <Sidebar />

    <!-- Main Content Area -->
    <main class="flex-1 md:pl-64 pt-16 md:pt-8 pb-16 px-6 md:px-10 transition-all duration-300 max-w-7xl mx-auto w-full">
      <!-- Top Header -->
      <header class="mb-6">
        <h1 class="text-3xl font-extrabold text-white tracking-tight">Explore Destinations</h1>
        <p class="text-sm text-slate-400 mt-1">Discover popular destinations and get inspired for your next trip.</p>
      </header>

      <!-- Search Input with Search & Clear Icons -->
      <div class="relative w-full mb-8">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search destinations (e.g., Paris, Tokyo, Bali, New York)"
          class="w-full bg-[#111C33] border border-[#1E2E4E] text-sm text-white placeholder-slate-400 pl-12 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-blue-500 shadow-lg shadow-black/20 transition-all"
        />
        <button 
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg"
          title="Clear search"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- Destinations Section -->
      <section class="mb-10">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-bold text-white tracking-tight">Destinations</h2>
          <span v-if="!loading && destinations.length > 0" class="text-xs font-semibold text-slate-400">
            {{ destinations.length }} {{ destinations.length === 1 ? 'destination' : 'destinations' }} found
          </span>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div 
            v-for="n in 4" 
            :key="n" 
            class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl overflow-hidden animate-pulse flex flex-col h-72"
          >
            <div class="h-44 bg-[#131F38] w-full"></div>
            <div class="p-4 flex-1 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="h-5 bg-[#1E2E4E] rounded w-3/4"></div>
                <div class="h-3.5 bg-[#1E2E4E] rounded w-1/2"></div>
              </div>
              <div class="h-8 bg-[#1E2E4E] rounded-xl w-full mt-3"></div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto my-12">
          <span class="material-symbols-outlined text-red-400 text-4xl mb-3">error</span>
          <h3 class="text-lg font-bold text-white mb-2">Failed to load destinations</h3>
          <p class="text-sm text-slate-400 mb-6">{{ error }}</p>
          <button 
            @click="loadDestinations(searchQuery)" 
            class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/30 active:scale-95"
          >
            Try Again
          </button>
        </div>

        <!-- Empty State -->
        <div v-else-if="destinations.length === 0" class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-10 text-center max-w-md mx-auto my-12">
          <span class="material-symbols-outlined text-slate-500 text-5xl mb-3">travel_explore</span>
          <h3 class="text-lg font-bold text-white mb-1">No destinations found</h3>
          <p class="text-sm text-slate-400 mb-6">
            <span v-if="searchQuery">No destinations matching "<span class="text-white">{{ searchQuery }}</span>".</span>
            <span v-else>No trips have been planned yet. Start by creating the first trip!</span>
          </p>
          <div class="flex items-center justify-center gap-3">
            <button 
              v-if="searchQuery" 
              @click="clearSearch"
              class="px-4 py-2.5 bg-[#1E2E4E] hover:bg-[#2A3E66] text-white text-xs font-semibold rounded-xl transition-all active:scale-95"
            >
              Clear Search
            </button>
            <button 
              @click="planNewTrip"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/30 active:scale-95"
            >
              Plan a Trip
            </button>
          </div>
        </div>

        <!-- Destinations Cards Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <article 
            v-for="dest in destinations"
            :key="dest.name"
            @click="planTripHere(dest.name)"
            class="bg-[#0F172A] border border-[#1E2E4E] hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col group justify-between"
          >
            <!-- Card Image -->
            <div class="h-44 w-full relative bg-[#131F38] overflow-hidden">
              <img 
                :src="getCoverImage(dest.coverImageUrl)" 
                :alt="dest.name"
                @error="handleImageError"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95" 
              />
              <div class="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-transparent to-black/20"></div>

              <!-- Trips Planned Badge -->
              <div class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-xs text-white">
                <span class="material-symbols-outlined text-[14px] text-blue-400">luggage</span>
                <span class="font-medium">{{ dest.tripCount }} {{ dest.tripCount === 1 ? 'trip planned' : 'trips planned' }}</span>
              </div>
            </div>

            <!-- Card Info -->
            <div class="p-4 flex flex-col justify-between flex-1">
              <div>
                <h3 class="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1" :title="dest.name">
                  {{ dest.name }}
                </h3>
                <p v-if="dest.averageBudgetPerPerson > 0" class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px] text-emerald-400">payments</span>
                  <span>Avg. ₹{{ Number(dest.averageBudgetPerPerson).toLocaleString() }} / person</span>
                </p>
              </div>

              <!-- Plan a Trip Here Action Button -->
              <button 
                @click.stop="planTripHere(dest.name)"
                class="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
              >
                <span class="material-symbols-outlined text-[16px]">add_location_alt</span>
                <span>Plan a Trip Here</span>
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- Create Trip Modal triggered from Destination -->
    <CreateTripModal 
      v-model:isOpen="showCreateModal" 
      :initialDestination="initialDestinationForModal"
      @trip-created="onTripCreated" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useExploreStore } from '../stores/explore';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import CreateTripModal from '../components/CreateTripModal.vue';
import { DEFAULT_TRIP_COVER_IMAGE } from '../constants';

const router = useRouter();
const exploreStore = useExploreStore();
const { destinations, loading, error } = storeToRefs(exploreStore);

const searchQuery = ref('');
const showCreateModal = ref(false);
const initialDestinationForModal = ref('');

const getCoverImage = (url) => {
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url;
  }
  return DEFAULT_TRIP_COVER_IMAGE;
};

const handleImageError = (event) => {
  event.target.src = DEFAULT_TRIP_COVER_IMAGE;
};

let debounceTimer = null;
const loadDestinations = (query = '') => {
  exploreStore.fetchDestinations(query);
};

watch(searchQuery, (newVal) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    loadDestinations(newVal);
  }, 300);
});

const clearSearch = () => {
  searchQuery.value = '';
  loadDestinations('');
};

const planTripHere = (destinationName) => {
  initialDestinationForModal.value = destinationName;
  showCreateModal.value = true;
};

const planNewTrip = () => {
  initialDestinationForModal.value = '';
  showCreateModal.value = true;
};

const onTripCreated = (trip) => {
  router.push(`/trips/${trip._id || trip.id}`);
};

onMounted(() => {
  loadDestinations('');
});
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
