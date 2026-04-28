<template>
  <div class="min-h-screen bg-surface">
    <Navbar />
    <Sidebar />

    <main class="md:ml-64 pt-24 pb-20 px-4 md:px-margin min-h-[calc(100vh-64px)]">
      <!-- Header -->
      <section class="mb-lg">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-on-surface">Explore</h1>
            <p class="text-outline-variant mt-1">Discover popular destinations and travel inspiration</p>
          </div>
        </div>
      </section>

      <!-- Search Bar -->
      <section class="mb-lg">
        <div class="relative w-full max-w-2xl">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            v-model="searchQuery"
            @keyup.enter="performSearch"
            class="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-outline rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-body-md text-body-md" 
            placeholder="Search destinations (e.g., Paris, Tokyo, New York)" 
            type="text"
          />
        </div>
      </section>

      <!-- Featured Destinations -->
      <section class="mb-lg">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-on-surface">Popular Destinations</h2>
          <span class="text-outline-variant text-sm">{{ filteredDestinations.length }} places</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          <article
            v-for="destination in filteredDestinations"
            :key="destination.id"
            class="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-gray-200 dark:border-slate-800 transition-all cursor-pointer hover:border-primary"
            @click="viewDestination(destination)"
          >
            <div class="h-48 w-full relative bg-surface-variant overflow-hidden">
              <img :alt="destination.name" :src="destination.image" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              <div class="absolute top-4 right-4">
                <span class="bg-white/90 backdrop-blur-sm text-primary font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">{{ destination.region }}</span>
              </div>
            </div>
            <div class="p-6">
              <h3 class="font-h3 text-h3 text-on-surface mb-2">{{ destination.name }}</h3>
              <p class="text-outline-variant text-sm mb-4 line-clamp-2">{{ destination.description }}</p>
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px] text-primary">star</span>
                  <span class="font-semibold">{{ destination.rating }}/5</span>
                </div>
                <span class="text-outline-variant">{{ destination.trips }} trips planned</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Empty State -->
      <section v-if="filteredDestinations.length === 0 && searchQuery" class="py-12 text-center">
        <div class="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-outline-variant text-3xl">travel_explore</span>
        </div>
        <h3 class="text-lg font-semibold text-outline-variant mb-2">No destinations found</h3>
        <p class="text-outline-variant text-sm max-w-sm mx-auto">Try searching with different keywords or explore popular destinations above</p>
      </section>

      <!-- Destination Detail Modal -->
      <div v-if="selectedDestination" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="h-80 w-full relative bg-surface-variant">
            <img :alt="selectedDestination.name" :src="selectedDestination.image" class="w-full h-full object-cover" />
            <button @click="selectedDestination = null" class="absolute top-4 right-4 bg-white/90 p-2 rounded-full hover:bg-white transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 class="text-h2 text-on-surface mb-2">{{ selectedDestination.name }}</h2>
                <p class="text-outline-variant">{{ selectedDestination.region }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-lg text-primary">star</span>
                <span class="font-semibold text-lg">{{ selectedDestination.rating }}</span>
              </div>
            </div>
            <p class="text-body-md text-on-surface-variant mb-6">{{ selectedDestination.description }}</p>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="p-4 bg-surface-container rounded-lg">
                <p class="text-outline-variant text-xs mb-1">Trips Planned</p>
                <p class="text-2xl font-bold text-primary">{{ selectedDestination.trips }}</p>
              </div>
              <div class="p-4 bg-surface-container rounded-lg">
                <p class="text-outline-variant text-xs mb-1">Best Time to Visit</p>
                <p class="font-semibold text-on-surface">{{ selectedDestination.bestTime }}</p>
              </div>
            </div>
            <button
              @click="createTripToDestination"
              class="w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined">add</span>
              Plan a Trip Here
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';

const router = useRouter();
const searchQuery = ref('');
const selectedDestination = ref(null);

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
    image: 'https://images.unsplash.com/photo-1540959375944-7049f642e9cf?auto=format&fit=crop&q=80&w=800&h=600',
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
    image: 'https://images.unsplash.com/photo-1512453459798-e876285ac66d?auto=format&fit=crop&q=80&w=800&h=600',
    rating: 4.5,
    trips: 743,
    bestTime: 'Nov - March'
  },
  {
    id: 6,
    name: 'Bangkok',
    region: 'Asia',
    description: 'Golden temples, bustling markets, and street food heaven. Experience authentic Thai culture and hospitality.',
    image: 'https://images.unsplash.com/photo-1505778276668-fc7ee4d8cf55?auto=format&fit=crop&q=80&w=800&h=600',
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
  router.push('/trips/create');
};
</script>
