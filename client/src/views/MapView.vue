<template>
  <div class="min-h-screen bg-[#080D1A] text-slate-100 font-['Plus_Jakarta_Sans'] flex">
    <Navbar />
    <Sidebar />

    <!-- Main Content Area -->
    <main class="flex-1 md:pl-64 pt-16 md:pt-8 pb-16 px-6 md:px-10 transition-all duration-300 max-w-7xl mx-auto w-full">
      <!-- Top Header -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <router-link 
              :to="`/trips/${tripId}`"
              class="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <span class="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Back to Trip</span>
            </router-link>
          </div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">Itinerary</h1>
          <p class="text-sm text-slate-400 mt-1">Plan your day-by-day itinerary and add places to visit.</p>
        </div>

        <div class="flex items-center gap-4">
          <!-- Live Indicator & Member Avatars -->
          <div class="flex items-center gap-3 bg-[#111C33] border border-[#1E2E4E] px-3.5 py-1.5 rounded-full shadow-md">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-xs font-bold text-emerald-400">Live</span>
            </div>

            <!-- Avatars -->
            <div class="flex items-center -space-x-2">
              <div 
                v-for="(member, idx) in activeMembersList" 
                :key="member.id || member._id || idx"
                class="w-6 h-6 rounded-full border-2 border-[#111C33] overflow-hidden bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white shadow"
                :title="member.name || member.email || 'Member'"
              >
                <img v-if="member.picture" :src="member.picture" :alt="member.name" class="w-full h-full object-cover" />
                <span v-else>{{ getInitials(member.name || member.email) }}</span>
              </div>
            </div>
          </div>

          <!-- Options -->
          <button class="w-9 h-9 rounded-xl bg-[#111C33] border border-[#1E2E4E] text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            <span class="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </header>

      <!-- Day Tabs Row -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        <button
          v-for="day in computedDaysList"
          :key="day.num"
          @click="activeDay = day.num"
          :class="activeDay === day.num ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-500' : 'bg-[#111C33] text-slate-300 hover:text-white border-[#1E2E4E]'"
          class="px-5 py-2 rounded-xl text-xs font-semibold border flex flex-col items-center min-w-[90px] transition-all"
        >
          <span>Day {{ day.num }}</span>
          <span class="text-[10px] opacity-75 font-normal">{{ day.date }}</span>
        </button>

        <button 
          @click="addDay"
          class="px-4 py-2 rounded-xl text-xs font-semibold bg-[#111C33]/60 hover:bg-[#111C33] text-slate-400 hover:text-white border border-dashed border-[#1E2E4E] flex items-center gap-1.5 transition-all whitespace-nowrap"
        >
          <span class="material-symbols-outlined text-[16px]">add</span>
          <span>Add Day</span>
        </button>
      </div>

      <!-- 2-Column Split: Scheduled Places Timeline (Left) & Map (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Column: Places Timeline List -->
        <section class="lg:col-span-5 flex flex-col gap-3">
          <div v-if="placesStore.loading" class="p-8 text-center bg-[#0F172A] border border-[#1E2E4E] rounded-2xl animate-pulse">
            <span class="text-xs text-slate-400">Loading places...</span>
          </div>

          <div v-else-if="currentDayPlaces.length === 0" class="text-center py-12 px-4 rounded-2xl bg-[#0F172A] border border-dashed border-[#1E2E4E]">
            <span class="material-symbols-outlined text-slate-500 text-3xl mb-1">place</span>
            <p class="text-sm font-medium text-slate-300">No places added for Day {{ activeDay }}</p>
            <p class="text-xs text-slate-500 mt-1 mb-3">Add stops to your itinerary for this day.</p>
            <button 
              @click="showAddPlace = true"
              class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>Add First Place</span>
            </button>
          </div>

          <div 
            v-for="(place, index) in currentDayPlaces"
            :key="place.id || place._id || index"
            class="p-3.5 rounded-2xl bg-[#0F172A] border border-[#1E2E4E] hover:border-blue-500/50 flex items-center gap-3.5 transition-all group shadow-md"
          >
            <!-- Thumbnail Icon/Category -->
            <div class="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">{{ getPlaceIcon(place.category) }}</span>
            </div>

            <!-- Place Details -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold mb-0.5">
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                <span class="capitalize">{{ place.category || 'Spot' }} · Day {{ place.dayNumber || activeDay }}</span>
              </div>
              <h4 class="text-sm font-bold text-white truncate">{{ place.name }}</h4>
              <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ place.address || place.note || 'No notes added' }}</p>
            </div>

            <!-- Actions -->
            <button 
              @click="removePlace(place.id || place._id)"
              class="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Remove place"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>

          <!-- Add Place Button -->
          <button 
            v-if="currentDayPlaces.length > 0"
            @click="showAddPlace = true"
            class="mt-2 py-3 px-4 rounded-xl border border-dashed border-[#1E2E4E] bg-[#111C33]/50 hover:bg-[#111C33] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Add Place</span>
          </button>
        </section>

        <!-- Right Column: Interactive Map -->
        <section class="lg:col-span-7 h-[480px] lg:h-[540px] rounded-2xl overflow-hidden border border-[#1E2E4E] relative bg-[#091124] shadow-2xl flex flex-col">
          <!-- Search Bar Floating Above Map -->
          <div class="absolute top-4 left-4 right-4 z-10">
            <div class="relative w-full">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input 
                ref="searchInput"
                type="text"
                placeholder="Search places to add..."
                class="w-full bg-[#0F172A]/90 backdrop-blur-md border border-[#1E2E4E] text-xs text-white placeholder-slate-400 pl-10 pr-10 py-2.5 rounded-xl shadow-lg focus:outline-none focus:border-blue-500"
              />
              <button class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <span class="material-symbols-outlined text-[16px]">tune</span>
              </button>
            </div>
          </div>

          <!-- Google Maps Container -->
          <div ref="mapContainer" class="w-full h-full"></div>

          <!-- Fallback Visual Map if Google Maps API key isn't active in dev -->
          <div v-if="!mapLoaded" class="absolute inset-0 bg-[#091124] flex items-center justify-center p-6">
            <div class="absolute inset-0 opacity-40 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div class="relative z-10 w-full h-full flex items-center justify-center">
              <template v-if="currentDayPlaces.length > 0">
                <div 
                  v-for="(p, pIdx) in currentDayPlaces.slice(0, 4)" 
                  :key="p.id || pIdx"
                  :style="{
                    position: 'absolute',
                    top: `${25 + (pIdx * 18)}%`,
                    left: `${20 + (pIdx * 16)}%`
                  }"
                  class="flex items-center gap-2 bg-[#0F172A] border border-blue-500/50 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-xl"
                >
                  <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span class="truncate max-w-[120px]">{{ p.name }}</span>
                </div>
              </template>
              <div v-else class="text-center p-6 bg-[#0F172A]/80 border border-[#1E2E4E] rounded-2xl backdrop-blur-md">
                <span class="material-symbols-outlined text-3xl text-slate-500 mb-1">map</span>
                <p class="text-xs font-medium text-slate-300">Map view for {{ trip?.destination || 'Destination' }}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Places added to Day {{ activeDay }} will appear here.</p>
              </div>
            </div>
          </div>

          <!-- Map Floating Controls -->
          <div class="absolute right-4 bottom-6 flex flex-col gap-2 z-10">
            <button class="w-8 h-8 rounded-lg bg-[#0F172A]/90 backdrop-blur-md border border-[#1E2E4E] text-slate-300 hover:text-white flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
            <button class="w-8 h-8 rounded-lg bg-[#0F172A]/90 backdrop-blur-md border border-[#1E2E4E] text-slate-300 hover:text-white flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <button class="w-8 h-8 rounded-lg bg-[#0F172A]/90 backdrop-blur-md border border-[#1E2E4E] text-slate-300 hover:text-white flex items-center justify-center shadow mt-2">
              <span class="material-symbols-outlined text-[18px]">my_location</span>
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- Add Place Modal -->
    <div v-if="showAddPlace" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-[#0F172A] border border-[#1E2E4E] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold text-white">Add Place to Day {{ activeDay }}</h3>
          <button @click="showAddPlace = false" class="text-slate-400 hover:text-white">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <form @submit.prevent="handleAddPlaceSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Place Name</label>
            <input 
              v-model="newPlace.name" 
              type="text" 
              required
              placeholder="e.g. Central Park" 
              class="w-full bg-[#111C33] border border-[#1E2E4E] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Address / Location</label>
            <input 
              v-model="newPlace.address" 
              type="text" 
              placeholder="e.g. New York, NY" 
              class="w-full bg-[#111C33] border border-[#1E2E4E] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Category</label>
            <select 
              v-model="newPlace.category" 
              class="w-full bg-[#111C33] border border-[#1E2E4E] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="attraction">Attraction</option>
              <option value="food">Restaurant / Cafe</option>
              <option value="hotel">Hotel / Stay</option>
              <option value="activity">Activity</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Notes (optional)</label>
            <textarea 
              v-model="newPlace.note" 
              rows="2"
              placeholder="Any details or reminders..." 
              class="w-full bg-[#111C33] border border-[#1E2E4E] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            ></textarea>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              @click="showAddPlace = false" 
              class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="savingPlace"
              class="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              {{ savingPlace ? 'Saving...' : 'Add Place' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import { usePlacesStore } from '../stores/places';
import api from '../api';

const route = useRoute();
const placesStore = usePlacesStore();

const tripId = computed(() => route.params.id || route.params.tripId);
const trip = ref(null);
const activeDay = ref(1);
const customDayCount = ref(0);
const showAddPlace = ref(false);
const savingPlace = ref(false);
const mapLoaded = ref(false);
const mapContainer = ref(null);
const searchInput = ref(null);

const newPlace = ref({
  name: '',
  address: '',
  category: 'attraction',
  note: ''
});

const activeMembersList = computed(() => {
  if (!trip.value) return [];
  const list = [];
  if (trip.value.owner) list.push(trip.value.owner);
  if (Array.isArray(trip.value.members)) {
    for (const m of trip.value.members) {
      if (!list.some(existing => (existing.id || existing._id) === (m.id || m._id))) {
        list.push(m);
      }
    }
  }
  return list;
});

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const computedDaysList = computed(() => {
  if (customDayCount.value > 0) {
    return Array.from({ length: customDayCount.value }, (_, i) => {
      const num = i + 1;
      let dateLabel = `Day ${num}`;
      if (trip.value?.startDate) {
        const d = new Date(trip.value.startDate);
        d.setDate(d.getDate() + i);
        if (!isNaN(d.getTime())) {
          dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      }
      return { num, date: dateLabel };
    });
  }

  if (trip.value?.startDate && trip.value?.endDate) {
    const start = new Date(trip.value.startDate);
    const end = new Date(trip.value.endDate);
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    return Array.from({ length: Math.min(diffDays, 30) }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateLabel = !isNaN(d.getTime()) 
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `Day ${i + 1}`;
      return { num: i + 1, date: dateLabel };
    });
  }

  return [{ num: 1, date: 'Day 1' }];
});

const addDay = () => {
  const currentTotal = computedDaysList.value.length;
  customDayCount.value = currentTotal + 1;
  activeDay.value = customDayCount.value;
};

const currentDayPlaces = computed(() => {
  return placesStore.placesByDay[activeDay.value] || [];
});

const getPlaceIcon = (category) => {
  const c = (category || '').toLowerCase();
  if (c.includes('food') || c.includes('restaurant') || c.includes('cafe')) return 'restaurant';
  if (c.includes('hotel') || c.includes('stay')) return 'hotel';
  if (c.includes('flight') || c.includes('airport')) return 'flight';
  return 'location_on';
};

const handleAddPlaceSubmit = async () => {
  if (!tripId.value || !newPlace.value.name) return;
  savingPlace.value = true;
  try {
    await placesStore.addPlace(tripId.value, {
      name: newPlace.value.name,
      address: newPlace.value.address || trip.value?.destination || '',
      category: newPlace.value.category,
      note: newPlace.value.note,
      dayNumber: activeDay.value,
      lat: 0,
      lng: 0,
      orderIndex: currentDayPlaces.value.length
    });
    newPlace.value = { name: '', address: '', category: 'attraction', note: '' };
    showAddPlace.value = false;
  } catch (err) {
    console.error('Failed to add place:', err);
  } finally {
    savingPlace.value = false;
  }
};

const removePlace = async (placeId) => {
  if (!tripId.value || !placeId) return;
  try {
    await placesStore.deletePlace(tripId.value, placeId);
  } catch (err) {
    console.error('Failed to remove place:', err);
  }
};

onMounted(async () => {
  if (tripId.value) {
    try {
      const res = await api.get(`/trips/${tripId.value}`);
      trip.value = res.data;
    } catch (err) {
      console.error('Error fetching trip:', err);
    }
    await placesStore.fetchPlaces(tripId.value);
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (apiKey && typeof window !== 'undefined' && window.google?.maps && mapContainer.value) {
    try {
      new window.google.maps.Map(mapContainer.value, {
        center: { lat: 48.8566, lng: 2.3522 },
        zoom: 13,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#091124' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#091124' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] }
        ]
      });
      mapLoaded.value = true;
    } catch {}
  }
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
