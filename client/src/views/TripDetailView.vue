<template>
  <div class="min-h-screen bg-[#080D1A] text-slate-100 font-['Plus_Jakarta_Sans'] flex">
    <Navbar />
    <Sidebar />

    <!-- Main Content Canvas -->
    <main class="flex-1 md:pl-64 pt-16 md:pt-8 pb-16 px-6 md:px-10 transition-all duration-300 max-w-7xl mx-auto w-full">
      <!-- Top Breadcrumb -->
      <div class="mb-5">
        <router-link 
          to="/dashboard" 
          class="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Trips</span>
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6 animate-pulse">
        <div class="h-64 rounded-3xl bg-[#111C33]"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="n in 4" :key="n" class="h-28 rounded-2xl bg-[#111C33]"></div>
        </div>
      </div>

      <!-- Content -->
      <div v-else-if="currentTrip" class="space-y-6">
        <!-- Hero Cover Banner -->
        <section class="relative h-64 md:h-72 w-full rounded-3xl overflow-hidden border border-[#1E2E4E] shadow-2xl group">
          <img 
            :src="currentTrip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE"
            :alt="currentTrip.name" 
            class="w-full h-full object-cover brightness-90 group-hover:scale-102 transition-transform duration-700" 
            @error="onImgError"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#080D1A]/95 via-[#080D1A]/40 to-transparent"></div>

          <!-- 3-Dots Menu Button -->
          <button 
            @click="showEditModal = true"
            class="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <span class="material-symbols-outlined text-[20px]">more_vert</span>
          </button>

          <!-- Banner Bottom Overlay Content -->
          <div class="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
                {{ currentTrip.name }}
              </h1>
              
              <div class="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                  <span>{{ formatDate(currentTrip.startDate) }} - {{ formatDate(currentTrip.endDate) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                  <span>{{ currentTrip.destination }}</span>
                </div>
              </div>

              <!-- Avatar Stack -->
              <div class="flex items-center -space-x-2 mt-4">
                <div 
                  v-for="(member, idx) in displayMembers" 
                  :key="member.id || member._id || idx"
                  class="w-7 h-7 rounded-full border-2 border-[#0F172A] overflow-hidden bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shadow"
                  :title="member.name || member.email || 'Member'"
                >
                  <img v-if="member.picture" :src="member.picture" :alt="member.name" class="w-full h-full object-cover" />
                  <span v-else>{{ getInitials(member.name || member.email) }}</span>
                </div>
                <div v-if="overflowMembersCount > 0" class="w-7 h-7 rounded-full border-2 border-[#0F172A] bg-blue-600/30 text-blue-300 flex items-center justify-center text-[10px] font-semibold">
                  +{{ overflowMembersCount }}
                </div>
              </div>
            </div>

            <!-- Actions: Edit Trip & AI Plan -->
            <div class="flex items-center gap-3">
              <button 
                @click="showAiPlanner = true"
                class="bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <span class="material-symbols-outlined text-amber-400 text-[18px]">auto_awesome</span>
                <span>AI Plan</span>
              </button>

              <button 
                @click="$router.push(`/trips/${currentTrip.id || currentTrip._id}/edit`)"
                class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
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
          <div class="p-5 rounded-2xl bg-[#0F172A] border border-[#1E2E4E] flex items-center gap-4 shadow-lg">
            <div class="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">group</span>
            </div>
            <div>
              <p class="text-xs text-slate-400 font-medium">Members</p>
              <h4 class="text-lg font-bold text-white mt-0.5">{{ totalMembersCount }} people</h4>
            </div>
          </div>

          <!-- Stat 2: Budget -->
          <div class="p-5 rounded-2xl bg-[#0F172A] border border-[#1E2E4E] flex items-center gap-4 shadow-lg">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <p class="text-xs text-slate-400 font-medium">Budget</p>
              <h4 class="text-lg font-bold text-white mt-0.5">{{ formatCurrency(tripBudget, currentTrip.currency || 'USD') }}</h4>
              <p class="text-[11px] text-slate-500">Total expenses</p>
            </div>
          </div>

          <!-- Stat 3: Flight -->
          <div class="p-5 rounded-2xl bg-[#0F172A] border border-[#1E2E4E] flex items-center gap-4 shadow-lg">
            <div class="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">flight</span>
            </div>
            <div>
              <p class="text-xs text-slate-400 font-medium">Flight</p>
              <h4 class="text-lg font-bold text-white mt-0.5">TBD</h4>
              <p class="text-[11px] text-slate-500">Add flight details</p>
            </div>
          </div>

          <!-- Stat 4: Lodging -->
          <div class="p-5 rounded-2xl bg-[#0F172A] border border-[#1E2E4E] flex items-center gap-4 shadow-lg">
            <div class="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">hotel</span>
            </div>
            <div>
              <p class="text-xs text-slate-400 font-medium">Lodging</p>
              <h4 class="text-lg font-bold text-white mt-0.5">TBD</h4>
              <p class="text-[11px] text-slate-500">Add hotel details</p>
            </div>
          </div>
        </section>

        <!-- Bottom Split: Trip Highlights (Left) & Quick Actions (Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <!-- Left: Trip Highlights -->
          <section class="lg:col-span-8 bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-6 shadow-xl">
            <div class="mb-4">
              <h3 class="text-lg font-bold text-white tracking-tight">Trip Highlights</h3>
              <p class="text-xs text-slate-400 mt-0.5">A quick overview of your trip</p>
            </div>

            <!-- Highlights Row -->
            <div v-if="highlightsList.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div 
                v-for="(item, idx) in highlightsList"
                :key="item.id || idx"
                class="rounded-xl overflow-hidden bg-[#111C33] border border-[#1E2E4E] group cursor-pointer hover:border-blue-500/50 transition-all p-4 flex flex-col justify-between"
                @click="$router.push(`/trips/${currentTrip.id || currentTrip._id}/map`)"
              >
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">location_on</span>
                  </span>
                  <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{{ item.category || 'Spot' }}</span>
                </div>
                <div>
                  <h5 class="text-sm font-bold text-white truncate">{{ item.title }}</h5>
                  <p class="text-[11px] text-slate-400 mt-1 truncate">{{ item.sub }}</p>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 px-4 rounded-xl bg-[#111C33]/50 border border-dashed border-[#1E2E4E]">
              <span class="material-symbols-outlined text-slate-500 text-3xl mb-1">map</span>
              <p class="text-sm font-medium text-slate-300">No itinerary highlights yet</p>
              <p class="text-xs text-slate-500 mt-1 mb-3">Add places and activities to plan your days.</p>
              <router-link
                :to="`/trips/${currentTrip.id || currentTrip._id}/map`"
                class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>Open Map & Planner</span>
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </router-link>
            </div>
          </section>

          <!-- Right: Quick Actions -->
          <section class="lg:col-span-4 bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-6 shadow-xl flex flex-col gap-3">
            <div class="mb-2">
              <h3 class="text-lg font-bold text-white tracking-tight">Quick Actions</h3>
            </div>

            <!-- Action 1: Manage Itinerary -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/map?tab=itinerary`"
              class="p-3.5 rounded-xl bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] hover:border-blue-500/40 flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">calendar_month</span>
                </div>
                <span class="text-sm font-semibold text-slate-200 group-hover:text-white">Manage Itinerary</span>
              </div>
              <span class="material-symbols-outlined text-slate-400 group-hover:text-white text-[18px]">chevron_right</span>
            </router-link>

            <!-- Action 2: View on Map -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/map`"
              class="p-3.5 rounded-xl bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] hover:border-red-500/40 flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">map</span>
                </div>
                <span class="text-sm font-semibold text-slate-200 group-hover:text-white">View on Map</span>
              </div>
              <span class="material-symbols-outlined text-slate-400 group-hover:text-white text-[18px]">chevron_right</span>
            </router-link>

            <!-- Action 3: Track Expenses -->
            <router-link 
              :to="`/trips/${currentTrip.id || currentTrip._id}/expenses`"
              class="p-3.5 rounded-xl bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] hover:border-emerald-500/40 flex items-center justify-between transition-all group"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <span class="text-sm font-semibold text-slate-200 group-hover:text-white">Track Expenses</span>
              </div>
              <span class="material-symbols-outlined text-slate-400 group-hover:text-white text-[18px]">chevron_right</span>
            </router-link>
          </section>

        </div>
      </div>

      <!-- Not Found State -->
      <div v-else class="text-center py-20 rounded-3xl bg-[#0F172A] border border-[#1E2E4E] p-8 max-w-md mx-auto mt-8 shadow-2xl">
        <span class="material-symbols-outlined text-5xl text-slate-500 mb-3">luggage</span>
        <h2 class="text-xl font-bold text-white mb-2">Trip Not Found</h2>
        <p class="text-xs text-slate-400 mb-6">The trip you are looking for does not exist or you don't have access to it.</p>
        <router-link
          to="/dashboard"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Trips</span>
        </router-link>
      </div>
    </main>

    <!-- AI Planner Modal Component -->
    <AiPlannerModal
      v-if="currentTrip"
      :isOpen="showAiPlanner"
      :tripId="currentTrip.id || currentTrip._id"
      :destination="currentTrip.destination"
      :duration="3"
      @close="showAiPlanner = false"
      @itinerary-generated="onItineraryGenerated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import AiPlannerModal from '../components/AiPlannerModal.vue';
import { useTripsStore } from '../stores/trips';
import api from '../api';
import { DEFAULT_TRIP_COVER_IMAGE } from '../constants';
import { formatCurrency } from '../utils/format';

const route = useRoute();
const router = useRouter();
const tripsStore = useTripsStore();

const loading = ref(true);
const trip = ref(null);
const showAiPlanner = ref(false);
const showEditModal = ref(false);

const onImgError = (e) => {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
};

const currentTripId = computed(() => route.params.id || route.params.tripId);
const currentTrip = computed(() => trip.value);

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    const res = await api.get(`/trips/${currentTripId.value}`);
    if (res.data) {
      trip.value = res.data;
    }
  } catch (err) {
    trip.value = null;
  } finally {
    loading.value = false;
  }
};

const onItineraryGenerated = () => {
  showAiPlanner.value = false;
  router.push(`/trips/${currentTripId.value}/map?tab=itinerary`);
};

onMounted(() => {
  fetchTrip();
});
</script>
