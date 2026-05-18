<template>
  <div class="min-h-screen bg-surface dark:bg-slate-950 transition-colors duration-200">
    <Navbar />
    <Sidebar />

    <main class="md:ml-64 pt-24 pb-20 px-4 md:px-8 min-h-[calc(100vh-64px)]">
      <!-- Header -->
      <section class="mb-lg">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <!-- Fix: Added dark:text-slate-100 for primary text contrast -->
            <h1 class="text-3xl font-bold text-on-surface dark:text-slate-100">Explore</h1>
            <!-- Fix: Added dark:text-slate-400 for muted text contrast -->
            <p class="text-outline-variant dark:text-slate-400 mt-1">Discover popular destinations and travel inspiration</p>
          </div>
        </div>
      </section>

      <!-- Search Bar -->
      <section class="mb-lg">
        <div class="relative w-full max-w-2xl">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <!-- Fix: Applied dark mode input styles (bg-slate-900, border-slate-700, text-slate-100, focus:ring-slate-500) -->
          <input 
            v-model="searchQuery"
            @keyup.enter="performSearch"
            class="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-outline dark:border-slate-700 dark:text-slate-100 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10 dark:focus:ring-slate-500 transition-all font-body-md text-body-md dark:placeholder-slate-500" 
            placeholder="Search destinations (e.g., Paris, Tokyo, New York)" 
            type="text"
          />
        </div>
      </section>

      <!-- Featured Destinations -->
      <section class="mb-lg">
        <div class="flex items-center justify-between mb-4">
          <!-- Fix: Added dark:text-slate-100 for section title -->
          <h2 class="text-2xl font-bold text-on-surface dark:text-slate-100">Popular Destinations</h2>
          <!-- Fix: Added dark:text-slate-400 for count text -->
          <span class="text-outline-variant dark:text-slate-400 text-sm">{{ filteredDestinations.length }} places</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          <!-- Fix: Applied card bg (slate-900) and border (white/10) for dark mode -->
          <article
            v-for="destination in filteredDestinations"
            :key="destination.id"
            class="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-gray-200 dark:border-white/10 transition-all cursor-pointer hover:border-primary"
            @click="viewDestination(destination)"
          >
            <div class="h-48 w-full relative bg-surface-variant dark:bg-slate-800 overflow-hidden">
              <!-- Fix: Added dark:brightness-90 to reduce eye strain and used destination.alt -->
              <img :alt="destination.alt || destination.name" :src="destination.image" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300 dark:brightness-90" />
              <div class="absolute top-4 right-4">
                <span class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-primary dark:text-blue-400 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">{{ destination.region }}</span>
              </div>
            </div>
            <div class="p-6">
              <!-- Fix: Added dark:text-slate-100 for card title -->
              <h3 class="font-h3 text-h3 text-on-surface dark:text-slate-100 mb-2">{{ destination.name }}</h3>
              <!-- Fix: Added dark:text-slate-400 for description contrast -->
              <p class="text-outline-variant dark:text-slate-400 text-sm mb-4 line-clamp-2">{{ destination.description }}</p>
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-primary dark:text-blue-400">star</span>
                  <!-- Fix: Added dark:text-slate-100 for rating text -->
                  <span class="font-semibold dark:text-slate-100">{{ destination.rating }}/5</span>
                </div>
                <!-- Fix: Added dark:text-slate-400 for trips text -->
                <span class="text-outline-variant dark:text-slate-400">{{ destination.trips }} trips planned</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Empty State -->
      <section v-if="filteredDestinations.length === 0 && searchQuery" class="py-12 text-center">
        <div class="w-16 h-16 bg-surface-container dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-200">
          <span class="material-symbols-outlined text-outline-variant dark:text-slate-400 text-3xl">travel_explore</span>
        </div>
        <!-- Fix: Added dark:text-slate-100 for empty state header -->
        <h3 class="text-lg font-semibold text-outline-variant dark:text-slate-100 mb-2">No destinations found</h3>
        <!-- Fix: Added dark:text-slate-400 for empty state subtext -->
        <p class="text-outline-variant dark:text-slate-400 text-sm max-w-sm mx-auto">Try searching with different keywords or explore popular destinations above</p>
      </section>

      <!-- Destination Detail Modal -->
      <div v-if="selectedDestination" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <!-- Fix: Applied modal bg (slate-800) and border (white/20) for dark mode -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-transparent dark:border-white/20">
          <div class="h-80 w-full relative bg-surface-variant dark:bg-slate-900">
            <!-- Fix: Added dark:brightness-90 and alt text -->
            <img :alt="selectedDestination.alt || selectedDestination.name" :src="selectedDestination.image" class="w-full h-full object-cover dark:brightness-90" />
            <button @click="selectedDestination = null" class="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors duration-200">
              <span class="material-symbols-outlined dark:text-slate-100">close</span>
            </button>
          </div>
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <!-- Fix: Added dark:text-slate-100 for modal title -->
                <h2 class="text-h2 text-on-surface dark:text-slate-100 mb-2">{{ selectedDestination.name }}</h2>
                <!-- Fix: Added dark:text-slate-400 for modal region -->
                <p class="text-outline-variant dark:text-slate-400">{{ selectedDestination.region }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-lg text-primary dark:text-blue-400">star</span>
                <!-- Fix: Added dark:text-slate-100 for modal rating -->
                <span class="font-semibold text-lg dark:text-slate-100">{{ selectedDestination.rating }}</span>
              </div>
            </div>
            <!-- Fix: Added dark:text-slate-300 for description text -->
            <p class="text-body-md text-on-surface-variant dark:text-slate-300 mb-6">{{ selectedDestination.description }}</p>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="p-4 bg-surface-container dark:bg-slate-700/50 rounded-lg transition-colors duration-200">
                <p class="text-outline-variant dark:text-slate-400 text-xs mb-1">Trips Planned</p>
                <p class="text-2xl font-bold text-primary dark:text-blue-400">{{ selectedDestination.trips }}</p>
              </div>
              <div class="p-4 bg-surface-container dark:bg-slate-700/50 rounded-lg transition-colors duration-200">
                <p class="text-outline-variant dark:text-slate-400 text-xs mb-1">Best Time to Visit</p>
                <!-- Fix: Added dark:text-slate-100 for detail value -->
                <p class="font-semibold text-on-surface dark:text-slate-100">{{ selectedDestination.bestTime }}</p>
              </div>
            </div>
            <button
              @click="createTripToDestination"
              class="w-full bg-primary dark:bg-blue-600 text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined">add</span>
              Plan a Trip Here
            </button>
          </div>
        </div>
      </div>
    </main>

    <CreateTripModal 
      v-model:isOpen="showCreateModal" 
      :initialDestination="initialDestinationForModal"
      @trip-created="onTripCreated" 
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import CreateTripModal from '../components/CreateTripModal.vue';

const router = useRouter();
const searchQuery = ref('');
const selectedDestination = ref(null);
const showCreateModal = ref(false);
const initialDestinationForModal = ref('');

// Popular destinations data
const destinations = ref([
  {
    id: 1,
    name: 'Paris',
    region: 'Europe',
    description: 'The City of Light offers iconic landmarks, world-class museums, and charming cafes. Perfect for romance and culture.',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    trips: 1249,
    bestTime: 'April - May, Sept - Oct'
  },
  {
    id: 2,
    name: 'Tokyo',
    region: 'Asia',
    description: 'A vibrant blend of ancient traditions and cutting-edge technology. Experience temples, street food, and neon lights.',
    // Fix: Replaced broken Tokyo image with high-quality Unsplash photo as requested
    image: 'https://plus.unsplash.com/premium_photo-1661914240950-b0124f20a5c1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Tokyo skyline at night',
    rating: 4.7,
    trips: 892,
    bestTime: 'March - May, Sept - Nov'
  },
  {
    id: 3,
    name: 'New York',
    region: 'North America',
    description: 'The city that never sleeps. Broadway shows, world-renowned museums, and iconic skyline views await.',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=600',
    rating: 4.6,
    trips: 2103,
    bestTime: 'April - May, Sept - Oct'
  },
  {
    id: 4,
    name: 'Barcelona',
    region: 'Europe',
    description: 'Gaudí\'s architectural masterpieces, Mediterranean beaches, and vibrant nightlife in a perfect package.',
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    trips: 1156,
    bestTime: 'April - May, Sept - Oct'
  },
  {
    id: 5,
    name: 'Dubai',
    region: 'Middle East',
    description: 'Luxury, innovation, and desert adventures. Shop at world\'s largest malls and enjoy stunning desert safaris.',
    // Fix: Updated to high-quality Unsplash photo for consistency
    image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    alt: 'Dubai skyline and Burj Khalifa',
    rating: 4.5,
    trips: 743,
    bestTime: 'Nov - March'
  },
  {
    id: 6,
    name: 'Bangkok',
    region: 'Asia',
    description: 'Golden temples, bustling markets, and street food heaven. Experience authentic Thai culture and hospitality.',
    // Fix: Updated to the specific high-quality Unsplash photo requested by the user
    image: 'https://plus.unsplash.com/premium_photo-1661963188068-1bac46e28727?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Bangkok temple at sunset',
    rating: 4.6,
    trips: 1034,
    bestTime: 'Nov - Feb'
  }
]);

// Filter destinations based on search
const filteredDestinations = computed(() => {
  if (!searchQuery.value) return destinations.value;
  const query = searchQuery.value.toLowerCase();
  return destinations.value.filter(d => 
    d.name.toLowerCase().includes(query) || 
    d.region.toLowerCase().includes(query)
  );
});

const performSearch = () => {
  // Search is already reactive
};

const viewDestination = (destination) => {
  selectedDestination.value = destination;
};

const createTripToDestination = () => {
  initialDestinationForModal.value = selectedDestination.value ? selectedDestination.value.name : '';
  showCreateModal.value = true;
  selectedDestination.value = null;
};

const onTripCreated = (trip) => {
  router.push(`/trips/${trip._id}`);
};
</script>
