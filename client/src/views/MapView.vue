<template>
  <AppLayout>
      <!-- Top Header -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <router-link 
              :to="`/trips/${tripId}`"
              class="inline-flex items-center gap-1 text-xs text-[#575851] hover:text-[#1C1D1A] dark:text-[#A5A69B] dark:hover:text-[#D5D3CA] transition-colors"
            >
              <span class="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Back to Trip</span>
            </router-link>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Itinerary & Map</h1>
          <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-1">Plan your day-by-day itinerary and explore places to visit.</p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Live Indicator & Member Avatars -->
          <div class="flex items-center gap-3 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] px-4 py-2 rounded-full shadow-sm">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#86A98B] animate-pulse"></span>
              <span class="text-xs font-bold text-[#86A98B]">Live</span>
            </div>

            <TripPresence :activeMembers="activeMembers" />
          </div>

          <!-- From Uiverse.io by ilkhoeri --> 
          <button
            @click="showAiPlanner = true"
            title="AI Plan"
            type="button"
            class="group relative outline-0 bg-sky-200 [--sz-btn:68px] [--space:calc(var(--sz-btn)/5.5)] [--gen-sz:calc(var(--space)*2)] [--sz-text:calc(var(--sz-btn)-var(--gen-sz))] h-[var(--sz-btn)] w-[var(--sz-btn)] border border-solid border-transparent rounded-xl flex items-center justify-center aspect-square cursor-pointer transition-transform duration-200 active:scale-[0.95] bg-[linear-gradient(45deg,#efad21,#ffd60f)] [box-shadow:#3c40434d_0_1px_2px_0,#3c404326_0_2px_6px_2px,#0000004d_0_30px_60px_-30px,#34343459_0_-2px_6px_0_inset]"
          >
            <svg
              class="animate-pulse absolute z-10 overflow-visible transition-all duration-300 text-[#ffea50] group-hover:text-white top-[calc(var(--sz-text)/7)] left-[calc(var(--sz-text)/7)] h-[var(--gen-sz)] w-[var(--gen-sz)] group-hover:h-[var(--sz-text)] group-hover:w-[var(--sz-text)] group-hover:left-[calc(var(--sz-text)/4)] group-hover:top-[calc(calc(var(--gen-sz))/2)]"
              stroke="none"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
              ></path>
            </svg>
            <span
              class="[font-size:var(--sz-text)] font-extrabold leading-none text-white transition-all duration-200 group-hover:opacity-0"
              >AI</span
            >
          </button>

          <!-- Add Stop Quick Button -->
          <button 
            @click="showAddPlace = true"
            class="bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border border-[#A7A99A]/40 transition-all active:scale-95 flex-shrink-0"
          >
            <span class="material-symbols-outlined text-[16px]">add_location</span>
            <span>Add Place</span>
          </button>
        </div>
      </header>

      <!-- Day Tabs Row -->
      <div class="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin">
        <button
          v-for="day in computedDaysList"
          :key="day.num"
          @click="activeDay = day.num"
          :class="activeDay === day.num 
            ? 'bg-[#1C1D1A] dark:bg-[#A7A99A] text-white dark:text-[#171813] shadow-sm border border-transparent' 
            : 'bg-[#FFFFFF] dark:bg-[#1B1C19] text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] border-[#E3E0D8] dark:border-[#30312C] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F]' "
          class="px-5 py-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center min-w-[96px] h-14 transition-all flex-shrink-0"
        >
          <span class="font-bold">Day {{ day.num }}</span>
          <span class="text-[10px] opacity-80 font-normal mt-0.5">{{ day.date }}</span>
        </button>

        <button 
          @click="addDay"
          class="px-4 py-2.5 rounded-xl text-xs font-semibold h-14 bg-[#F0EEE9] hover:bg-[#E3E0D8] dark:bg-[#1B1C19]/60 dark:hover:bg-[#22231F] text-[#575851] hover:text-[#1C1D1A] dark:text-[#A5A69B] dark:hover:text-[#D5D3CA] border border-dashed border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center gap-1.5 transition-all whitespace-nowrap flex-shrink-0"
        >
          <span class="material-symbols-outlined text-[16px]">add</span>
          <span>Add Day</span>
        </button>
      </div>

      <!-- 2-Column Split: Scheduled Places Timeline (Left) & Map (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Column: Places Timeline List -->
        <section class="lg:col-span-5 flex flex-col gap-3 min-w-0 order-2 lg:order-1">
          <div v-if="placesStore.loading" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl animate-pulse">
            <span class="text-xs text-[#575851] dark:text-[#A5A69B]">Loading places...</span>
          </div>

          <div v-else-if="currentDayPlaces.length === 0" class="text-center py-14 px-8 rounded-3xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-dashed border-[#E3E0D8] dark:border-[#30312C] shadow-sm flex flex-col items-center justify-center">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] mb-3 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">place</span>
            </div>
            <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">No places added for Day {{ activeDay }}</p>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] max-w-xs mt-1 mb-4 leading-relaxed">Add stops, attractions, or dining spots to organize your day.</p>
            <button 
              @click="showAddPlace = true"
              class="inline-flex items-center gap-1.5 text-xs text-[#171813] bg-[#A7A99A] hover:bg-[#B9BBAA] px-4 py-2 rounded-xl font-semibold shadow-sm transition-all active:scale-95"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>Add First Place</span>
            </button>
          </div>

          <div 
            v-for="(place, index) in currentDayPlaces"
            :key="place.id || place._id || index"
            class="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] flex items-center gap-4 transition-all group shadow-sm"
          >
            <!-- Thumbnail Icon/Category -->
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">{{ getPlaceIcon(place.category) }}</span>
            </div>

            <!-- Place Details -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-[11px] text-[#7E8075] dark:text-[#85867C] font-semibold mb-0.5">
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                <span class="capitalize">{{ place.category || 'Spot' }} · Day {{ place.dayNumber || activeDay }}</span>
              </div>
              <h4 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ place.name }}</h4>
              <p class="text-[11px] text-[#575851] dark:text-[#A5A69B] truncate mt-0.5">{{ place.address || place.note || 'No notes added' }}</p>
            </div>

            <!-- Actions -->
            <button 
              @click="removePlace(place.id || place._id)"
              class="w-8 h-8 rounded-lg text-[#7E8075] dark:text-[#85867C] hover:text-[#C77F78] hover:bg-[#C77F78]/10 flex items-center justify-center transition-colors"
              title="Remove place"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>

          <!-- Add Place Button -->
          <button 
            v-if="currentDayPlaces.length > 0"
            @click="showAddPlace = true"
            class="mt-2 py-3 px-4 rounded-xl border border-dashed border-[#E3E0D8] dark:border-[#30312C] bg-[#FFFFFF] hover:bg-[#F0EEE9] dark:bg-[#1B1C19]/50 dark:hover:bg-[#22231F] text-sm font-semibold text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Add Place</span>
          </button>
        </section>

        <!-- Right Column: Interactive Map -->
        <section class="lg:col-span-7 h-[420px] sm:h-[480px] lg:h-[580px] rounded-3xl overflow-hidden border border-[#E3E0D8] dark:border-[#30312C] relative bg-[#141512] shadow-sm flex flex-col min-w-0 order-1 lg:order-2">
          <!-- Search Bar Floating Above Map -->
          <div class="absolute top-5 left-5 right-5 z-10">
            <div class="relative w-full max-w-md mx-auto">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-[18px]">search</span>
              <input 
                ref="searchInput"
                type="text"
                placeholder="Search places or attractions..."
                class="w-full bg-[#FFFFFF]/95 dark:bg-[#1B1C19]/95 backdrop-blur-md border border-[#E3E0D8] dark:border-[#30312C] text-xs text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] pl-11 pr-11 py-3 rounded-xl shadow-lg focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30"
              />
              <button 
                @click="showAddPlace = true"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]"
                title="Add place manually"
              >
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
              </button>
            </div>
          </div>

          <!-- Google Maps Container -->
          <div ref="mapContainer" class="w-full h-full"></div>

          <!-- Fallback Visual Map if Google Maps API key isn't active in dev -->
          <div v-if="!mapLoaded" class="absolute inset-0 bg-[#141512] flex items-center justify-center p-6">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(#30312C_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
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
                  class="flex items-center gap-2 bg-[#1B1C19] border border-[#30312C] px-3 py-1.5 rounded-full text-xs font-semibold text-[#D5D3CA] shadow-xl"
                >
                  <span class="w-2 h-2 rounded-full bg-[#A7A99A]"></span>
                  <span class="truncate max-w-[120px]">{{ p.name }}</span>
                </div>
              </template>
              <div v-else class="text-center p-8 bg-[#1B1C19]/90 border border-[#30312C] rounded-3xl backdrop-blur-md">
                <span class="material-symbols-outlined text-3xl text-[#7E8075] dark:text-[#85867C] mb-1">map</span>
                <p class="text-xs font-medium text-[#D5D3CA]">Map view for {{ trip?.destination || 'Destination' }}</p>
                <p class="text-[11px] text-[#85867C] mt-0.5">Places added to Day {{ activeDay }} will appear here.</p>
              </div>
            </div>
          </div>

          <!-- Map Floating Controls -->
          <div class="absolute right-5 bottom-6 flex flex-col gap-2 z-10">
            <button class="w-9 h-9 rounded-xl bg-[#FFFFFF]/90 dark:bg-[#1B1C19]/90 backdrop-blur-md border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
            <button class="w-9 h-9 rounded-xl bg-[#FFFFFF]/90 dark:bg-[#1B1C19]/90 backdrop-blur-md border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <button class="w-9 h-9 rounded-xl bg-[#FFFFFF]/90 dark:bg-[#1B1C19]/90 backdrop-blur-md border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] flex items-center justify-center shadow mt-2">
              <span class="material-symbols-outlined text-[18px]">my_location</span>
            </button>
          </div>
        </section>
      </div>

    <!-- Add Place Modal -->
    <div v-if="showAddPlace" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Add Place to Day {{ activeDay }}</h3>
          <button @click="showAddPlace = false" class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <form @submit.prevent="handleAddPlaceSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-1.5">Place Name</label>
            <input 
              v-model="newPlace.name" 
              type="text" 
              required
              placeholder="e.g. Central Park" 
              class="w-full bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl px-3.5 py-2.5 text-xs text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30" 
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-1.5">Address / Location</label>
            <input 
              v-model="newPlace.address" 
              type="text" 
              placeholder="e.g. New York, NY" 
              class="w-full bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl px-3.5 py-2.5 text-xs text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30" 
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-1.5">Category</label>
            <select 
              v-model="newPlace.category" 
              class="w-full bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl px-3.5 py-2.5 text-xs text-[#1C1D1A] dark:text-[#D5D3CA] focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30"
            >
              <option value="attraction">Attraction</option>
              <option value="food">Restaurant / Cafe</option>
              <option value="hotel">Hotel / Stay</option>
              <option value="activity">Activity</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-1.5">Notes (optional)</label>
            <textarea 
              v-model="newPlace.note" 
              rows="2"
              placeholder="Any details or reminders..." 
              class="w-full bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl px-3.5 py-2.5 text-xs text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 resize-none"
            ></textarea>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              @click="showAddPlace = false" 
              class="px-4 py-2 text-xs font-semibold text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="savingPlace"
              class="px-5 py-2 bg-[#A7A99A] hover:bg-[#B9BBAA] disabled:opacity-50 text-[#171813] text-xs font-semibold rounded-xl shadow-sm border border-[#A7A99A]/40 transition-all"
            >
              <span>{{ savingPlace ? 'Adding...' : 'Add Place' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- AI Planner Modal Component -->
    <AiPlannerModal
      v-model:isOpen="showAiPlanner"
      :tripId="tripId"
      :initialDestination="trip?.destination || ''"
      :tripDaysCount="computedDaysList.length || 3"
      @planGenerated="refreshItinerary"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import TripPresence from '../components/TripPresence.vue';
import AiPlannerModal from '../components/AiPlannerModal.vue';
import { useSocket } from '../composables/useSocket';
import { usePlacesStore } from '../stores/places';
import { useTripsStore } from '../stores/trips';
import api from '../api';

const route = useRoute();
const placesStore = usePlacesStore();
const tripsStore = useTripsStore();

const tripId = computed(() => route.params.id || route.params.tripId);
const trip = computed(() => tripsStore.currentTrip);
const activeDay = ref(1);
const customDayCount = ref(0);
const showAddPlace = ref(false);
const showAiPlanner = ref(false);
const savingPlace = ref(false);
const mapLoaded = ref(false);
const mapContainer = ref(null);
const searchInput = ref(null);

const refreshItinerary = async () => {
  if (tripId.value) {
    await placesStore.fetchPlaces(tripId.value);
  }
};

const { activeMembers } = useSocket(() => route.params.id || route.params.tripId);

const newPlace = ref({
  name: '',
  address: '',
  category: 'attraction',
  note: ''
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
        d.setUTCDate(d.getUTCDate() + i);
        if (!isNaN(d.getTime())) {
          dateLabel = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
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
      d.setUTCDate(d.getUTCDate() + i);
      const dateLabel = !isNaN(d.getTime()) 
        ? d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
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
      await tripsStore.fetchTrip(tripId.value);
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
