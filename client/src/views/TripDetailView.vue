<template>
  <AppLayout>
      <!-- Top Breadcrumb -->
      <div class="mb-5">
        <router-link 
          to="/dashboard" 
          class="inline-flex items-center gap-2 text-xs font-semibold text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Trips</span>
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6 animate-pulse">
        <div class="h-72 rounded-3xl bg-[#F0EEE9] dark:bg-[#1B1C19]"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="n in 4" :key="n" class="h-28 rounded-2xl bg-[#E3E0D8] dark:bg-[#22231F]"></div>
        </div>
      </div>

      <!-- Content -->
      <div v-else-if="currentTrip" class="space-y-6">
        <!-- Hero Cover Banner -->
        <section class="relative min-h-[280px] sm:min-h-[320px] w-full rounded-3xl overflow-hidden border border-[#E3E0D8] dark:border-[#30312C] shadow-sm group flex flex-col justify-end">
          <img 
            :src="currentTrip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE"
            :alt="currentTrip.name" 
            class="absolute inset-0 w-full h-full object-cover brightness-[0.75] group-hover:scale-105 transition-transform duration-700" 
            @error="onImgError"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#111210] via-[#111210]/60 to-[#111210]/20"></div>

          <!-- 3-Dots Menu Button -->
          <button 
            @click="showEditModal = true"
            class="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            title="Edit trip details"
          >
            <span class="material-symbols-outlined text-[20px]">more_vert</span>
          </button>

          <!-- Banner Bottom Overlay Content -->
          <div class="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div class="min-w-0 flex-1">
              <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3 break-words" :title="currentTrip.name">
                {{ currentTrip.name }}
              </h1>
              
              <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-[#D5D3CA] mb-4">
                <div class="inline-flex items-center gap-1.5 bg-[#141512]/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 font-medium">
                  <span class="material-symbols-outlined text-[16px] text-[#A7A99A]">calendar_today</span>
                  <span>{{ formatDate(currentTrip.startDate) }} – {{ formatDate(currentTrip.endDate) }}</span>
                </div>
                <div class="inline-flex items-center gap-1.5 bg-[#141512]/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 font-medium max-w-full">
                  <span class="material-symbols-outlined text-[16px] text-[#86A98B] flex-shrink-0">location_on</span>
                  <span class="truncate" :title="currentTrip.destination">{{ currentTrip.destination }}</span>
                </div>
              </div>

              <!-- Avatar Stack -->
              <div class="flex items-center -space-x-2">
                <div 
                  v-for="(member, idx) in displayMembers" 
                  :key="member.id || member._id || idx"
                  class="w-8 h-8 rounded-full border-2 border-[#111210] overflow-hidden bg-[#292A25] flex items-center justify-center text-[10px] font-bold text-[#D5D3CA] shadow-sm flex-shrink-0"
                  :title="member.name || member.email || 'Member'"
                >
                  <img v-if="member.picture" :src="member.picture" :alt="member.name" class="w-full h-full object-cover" />
                  <span v-else>{{ getInitials(member.name || member.email) }}</span>
                </div>
                <div v-if="overflowMembersCount > 0" class="w-8 h-8 rounded-full border-2 border-[#111210] bg-[#292A25] text-[#A5A69B] flex items-center justify-center text-[10px] font-semibold flex-shrink-0 shadow-sm">
                  +{{ overflowMembersCount }}
                </div>
              </div>
            </div>

            <!-- Actions: Edit Trip & AI Plan -->
            <div class="flex flex-wrap items-center gap-3 flex-shrink-0 self-start md:self-end">
              <TripPresence :activeMembers="activeMembers" />
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

              <button 
                @click="$router.push(`/trips/${currentTrip.id || currentTrip._id}/edit`)"
                class="bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border border-[#A7A99A]/40 transition-all active:scale-95"
              >
                <span class="material-symbols-outlined text-[18px]">edit</span>
                <span>Edit Trip</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 4 Stat Widgets Row -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Stat 1: Members -->
          <div class="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] flex items-center gap-4 shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">group</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-[#7E8075] dark:text-[#85867C] font-semibold truncate">Members</p>
              <h4 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mt-1 truncate">{{ totalMembersCount }} people</h4>
            </div>
          </div>

          <!-- Stat 2: Budget -->
          <div class="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] flex items-center gap-4 shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-[#7E8075] dark:text-[#85867C] font-semibold truncate">Budget</p>
              <h4 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mt-1 truncate" :title="formatCurrency(tripBudget, currentTrip.currency || 'USD')">
                {{ formatCurrency(tripBudget, currentTrip.currency || 'USD') }}
              </h4>
              <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] truncate mt-0.5">Total expenses</p>
            </div>
          </div>

          <!-- Stat 3: Flight -->
          <div class="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] flex items-center gap-4 shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">flight</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-[#7E8075] dark:text-[#85867C] font-semibold truncate">Flight</p>
              <h4 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mt-1 truncate">TBD</h4>
              <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] truncate mt-0.5">Add flight details</p>
            </div>
          </div>

          <!-- Stat 4: Lodging -->
          <div class="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] flex items-center gap-4 shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">hotel</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-[#7E8075] dark:text-[#85867C] font-semibold truncate">Lodging</p>
              <h4 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mt-1 truncate">TBD</h4>
              <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] truncate mt-0.5">Add hotel details</p>
            </div>
          </div>
        </section>

        <!-- Bottom Split: Trip Highlights (Left) & Quick Actions (Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <!-- Left: Trip Highlights -->
          <section class="lg:col-span-8 min-w-0 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 shadow-sm">
            <div class="mb-5">
              <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Trip Highlights</h3>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">A quick overview of your trip</p>
            </div>

            <!-- Highlights Row -->
            <div v-if="highlightsList.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div 
                v-for="(item, idx) in highlightsList"
                :key="item.id || idx"
                class="rounded-2xl overflow-hidden bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] group cursor-pointer transition-all p-5 flex flex-col justify-between"
                @click="$router.push(`/trips/${currentTrip.id || currentTrip._id}/map`)"
              >
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-8 h-8 rounded-lg bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">location_on</span>
                  </span>
                  <span class="text-[11px] uppercase tracking-wider text-[#7E8075] dark:text-[#85867C] font-semibold">{{ item.category || 'Spot' }}</span>
                </div>
                <div>
                  <h5 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ item.title }}</h5>
                  <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] mt-1 truncate">{{ item.sub }}</p>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-10 px-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F]/50 border border-dashed border-[#E3E0D8] dark:border-[#30312C]">
              <span class="material-symbols-outlined text-[#7E8075] dark:text-[#85867C] text-3xl mb-1">map</span>
              <p class="text-sm font-medium text-[#1C1D1A] dark:text-[#D5D3CA]">No itinerary highlights yet</p>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1 mb-4">Add places and activities to plan your days.</p>
              <router-link
                :to="`/trips/${currentTrip.id || currentTrip._id}/map`"
                class="inline-flex items-center gap-1.5 text-xs text-[#1C1D1A] dark:text-[#D5D3CA] hover:text-[#575851] dark:hover:text-white font-semibold underline underline-offset-4 decoration-[#A7A99A]"
              >
                <span>Open Map & Planner</span>
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </router-link>
            </div>
          </section>

          <!-- Right: Quick Actions -->
          <section class="lg:col-span-4 min-w-0 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col gap-3.5">
            <div class="mb-2">
              <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Quick Actions</h3>
            </div>

            <!-- Action 1: Manage Itinerary -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/map?tab=itinerary`"
              class="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#22231F] hover:bg-[#EFECE6] dark:hover:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3.5">
                <div class="w-8 h-8 rounded-lg bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">calendar_month</span>
                </div>
                <span class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Manage Itinerary</span>
              </div>
              <span class="material-symbols-outlined text-[#7E8075] dark:text-[#85867C] group-hover:text-[#1C1D1A] dark:group-hover:text-[#D5D3CA] text-[18px]">chevron_right</span>
            </router-link>

            <!-- Action 2: View on Map -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/map`"
              class="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#22231F] hover:bg-[#EFECE6] dark:hover:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3.5">
                <div class="w-8 h-8 rounded-lg bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">map</span>
                </div>
                <span class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">View on Map</span>
              </div>
              <span class="material-symbols-outlined text-[#7E8075] dark:text-[#85867C] group-hover:text-[#1C1D1A] dark:group-hover:text-[#D5D3CA] text-[18px]">chevron_right</span>
            </router-link>

            <!-- Action 3: Track Expenses -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/expenses`"
              class="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#22231F] hover:bg-[#EFECE6] dark:hover:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3.5">
                <div class="w-8 h-8 rounded-lg bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <span class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Track Expenses</span>
              </div>
              <span class="material-symbols-outlined text-[#7E8075] dark:text-[#85867C] group-hover:text-[#1C1D1A] dark:group-hover:text-[#D5D3CA] text-[18px]">chevron_right</span>
            </router-link>
          </section>

        </div>
      </div>

      <!-- Not Found State -->
      <div v-else class="text-center py-20 rounded-3xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] p-8 max-w-md mx-auto mt-8 shadow-sm">
        <span class="material-symbols-outlined text-5xl text-[#7E8075] dark:text-[#85867C] mb-3">luggage</span>
        <h2 class="text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">Trip Not Found</h2>
        <p class="text-xs text-[#575851] dark:text-[#A5A69B] mb-6">The trip you are looking for does not exist or you don't have access to it.</p>
        <router-link
          to="/dashboard"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs font-semibold shadow-sm transition-all"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Trips</span>
        </router-link>
      </div>

    <!-- AI Planner Modal Component -->
    <AiPlannerModal
      v-if="currentTrip"
      v-model:isOpen="showAiPlanner"
      :tripId="currentTrip.id || currentTrip._id"
      :destination="currentTrip.destination"
      :duration="3"
      @itinerary-generated="onItineraryGenerated"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import TripPresence from '../components/TripPresence.vue';
import AiPlannerModal from '../components/AiPlannerModal.vue';
import { useSocket } from '../composables/useSocket';
import { useTripsStore } from '../stores/trips';
import api from '../api';
import { DEFAULT_TRIP_COVER_IMAGE } from '../constants';
import { formatCurrency } from '../utils/format';

const route = useRoute();
const router = useRouter();
const tripsStore = useTripsStore();

const loading = ref(true);
const trip = computed(() => tripsStore.currentTrip);
const showAiPlanner = ref(false);
const showEditModal = ref(false);

const onImgError = (e) => {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
};

const currentTripId = computed(() => route.params.id || route.params.tripId);
const currentTrip = computed(() => trip.value);
const { activeMembers } = useSocket(() => route.params.id || route.params.tripId);

const allMembers = computed(() => {
  if (!currentTrip.value) return [];
  const list = [];
  if (currentTrip.value.owner) {
    list.push(currentTrip.value.owner);
  }
  if (Array.isArray(currentTrip.value.members)) {
    for (const m of currentTrip.value.members) {
      if (!list.some(existing => (existing.id || existing._id) === (m.id || m._id))) {
        list.push(m);
      }
    }
  }
  return list;
});

const displayMembers = computed(() => allMembers.value.slice(0, 3));
const overflowMembersCount = computed(() => Math.max(0, allMembers.value.length - 3));
const totalMembersCount = computed(() => allMembers.value.length);

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const tripBudget = computed(() => {
  if (currentTrip.value?.expenses && Array.isArray(currentTrip.value.expenses) && currentTrip.value.expenses.length > 0) {
    return currentTrip.value.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }
  return 0;
});

const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};

const highlightsList = computed(() => {
  if (!currentTrip.value?.places || !Array.isArray(currentTrip.value.places) || currentTrip.value.places.length === 0) {
    return [];
  }
  return currentTrip.value.places.slice(0, 3).map((p, idx) => ({
    id: p.id || idx,
    title: p.name,
    sub: p.address || `Day ${p.dayNumber} · ${p.category || 'Attraction'}`,
    category: p.category
  }));
});

const fetchTrip = async () => {
  loading.value = true;
  try {
    await tripsStore.fetchTrip(currentTripId.value);
  } catch (err) {
    // Handled in store
  } finally {
    loading.value = false;
  }
};

const onItineraryGenerated = async () => {
  showAiPlanner.value = false;
  await fetchTrip();
};

watch(() => currentTripId.value, (newId) => {
  if (newId) {
    fetchTrip();
  }
});

onMounted(() => {
  fetchTrip();
});
</script>
