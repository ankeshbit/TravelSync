<template>
  <AppLayout>
    <!-- Top Bar: Title & Actions -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">My Trips</h1>
        <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-1">Manage and plan your upcoming adventures together.</p>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <!-- Search Trips Input -->
        <div class="relative flex-1 sm:w-64 sm:flex-initial">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-[18px]">search</span>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search trips..."
            class="w-full bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] text-sm text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] pl-10 pr-8 py-2.5 rounded-xl focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 shadow-sm transition-all"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] p-0.5"
            title="Clear search"
          >
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <!-- Create Trip Button -->
        <button 
          @click="showCreateModal = true" 
          class="bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border border-[#A7A99A]/40 active:scale-95 transition-all flex-shrink-0"
        >
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>Create Trip</span>
        </button>
      </div>
    </header>

    <!-- Overview Statistics Summary Row -->
    <div class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-5 mb-8">
      <!-- Total Trips -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-colors shadow-sm min-h-[104px] h-full min-w-0">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
          <span class="material-symbols-outlined text-[24px]">explore</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Total Trips</p>
          <h3 class="text-xl sm:text-2xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate">
            <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-[#E3E0D8] dark:bg-[#292A25] animate-pulse rounded"></span>
            <span v-else>{{ summary.totalTrips }}</span>
          </h3>
        </div>
      </div>

      <!-- Upcoming Trips -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-colors shadow-sm min-h-[104px] h-full min-w-0">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
          <span class="material-symbols-outlined text-[24px]">calendar_month</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Upcoming Trips</p>
          <h3 class="text-xl sm:text-2xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate">
            <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-[#E3E0D8] dark:bg-[#292A25] animate-pulse rounded"></span>
            <span v-else>{{ summary.upcomingTrips }}</span>
          </h3>
        </div>
      </div>

      <!-- Total Members -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-colors shadow-sm min-h-[104px] h-full min-w-0">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
          <span class="material-symbols-outlined text-[24px]">groups</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Total Members</p>
          <h3 class="text-xl sm:text-2xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate">
            <span v-if="summaryLoading" class="inline-block w-8 h-6 bg-[#E3E0D8] dark:bg-[#292A25] animate-pulse rounded"></span>
            <span v-else>{{ summary.totalMembers }}</span>
          </h3>
        </div>
      </div>

      <!-- Total Spent -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-colors shadow-sm min-h-[104px] h-full min-w-0">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
          <span class="material-symbols-outlined text-[24px]">payments</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Total Spent</p>
          <h3 class="text-xl sm:text-2xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate" :title="formattedTotalSpent">
            <span v-if="summaryLoading" class="inline-block w-16 h-6 bg-[#E3E0D8] dark:bg-[#292A25] animate-pulse rounded"></span>
            <span v-else>{{ formattedTotalSpent }}</span>
          </h3>
        </div>
      </div>
    </div>

    <!-- Filter Tabs Row -->
    <div class="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-none">
      <button 
        v-for="tab in ['All Trips', 'Upcoming', 'Past']" 
        :key="tab"
        @click="activeFilter = tab"
        :class="activeFilter === tab 
          ? 'bg-[#1C1D1A] dark:bg-[#A7A99A] text-white dark:text-[#171813] font-semibold border border-transparent shadow-sm' 
          : 'bg-[#FFFFFF] dark:bg-[#1B1C19] text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] font-medium border border-[#E3E0D8] dark:border-[#30312C]'"
        class="px-4.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 flex-shrink-0"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Loading State: Identical geometry to TripCard.vue -->
    <div v-if="loading && trips.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      <div v-for="n in 3" :key="n" class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl overflow-hidden flex flex-col shadow-sm h-full min-h-[380px]">
        <div class="h-48 w-full bg-[#F0EEE9] dark:bg-[#22231F] relative flex-shrink-0">
          <div class="absolute top-4 right-4 w-20 h-6 rounded-full bg-[#E3E0D8] dark:bg-[#292A25]"></div>
        </div>
        <div class="p-5 sm:p-6 flex flex-col flex-1 justify-between gap-4">
          <div class="space-y-3">
            <div class="h-5 w-3/4 bg-[#E3E0D8] dark:bg-[#292A25] rounded"></div>
            <div class="space-y-2 pt-1">
              <div class="h-3.5 w-1/2 bg-[#E3E0D8] dark:bg-[#292A25] rounded"></div>
              <div class="h-3.5 w-2/3 bg-[#E3E0D8] dark:bg-[#292A25] rounded"></div>
            </div>
          </div>
          <div class="flex items-center justify-between pt-4 border-t border-[#E3E0D8] dark:border-[#30312C] mt-auto">
            <div class="flex items-center -space-x-2">
              <div class="w-7 h-7 rounded-full bg-[#E3E0D8] dark:bg-[#292A25]"></div>
              <div class="w-7 h-7 rounded-full bg-[#E3E0D8] dark:bg-[#292A25]"></div>
            </div>
            <div class="w-8 h-8 rounded-lg bg-[#E3E0D8] dark:bg-[#292A25]"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-[#C77F78]/10 border border-[#C77F78]/30 text-[#C77F78] p-5 rounded-2xl mb-6 text-sm">
      {{ error }}
    </div>

    <!-- Empty State -->
    <div 
      v-else-if="displayTrips.length === 0" 
      class="w-full bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-8 sm:p-16 text-center shadow-sm flex flex-col items-center justify-center my-4"
    >
      <div class="w-16 h-16 rounded-2xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] mb-4 flex-shrink-0">
        <span class="material-symbols-outlined text-3xl">{{ searchQuery ? 'search_off' : 'luggage' }}</span>
      </div>
      <h3 class="text-lg sm:text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2 tracking-tight">
        {{ searchQuery ? 'No matching trips found' : (activeFilter !== 'All Trips' ? `No ${activeFilter.toLowerCase()} trips found` : 'No trips yet') }}
      </h3>
      <p class="text-sm text-[#575851] dark:text-[#A5A69B] max-w-lg mx-auto leading-relaxed mb-6">
        {{ searchQuery 
            ? `No trips matching "${searchQuery}". Check your keywords or try searching for another destination or trip name.` 
            : (activeFilter !== 'All Trips' 
                ? `You don't have any ${activeFilter.toLowerCase()} trips scheduled right now.` 
                : "You haven't planned any trips yet. Create your first adventure and start inviting your travel companions!") 
        }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button 
          v-if="searchQuery"
          @click="searchQuery = ''" 
          class="px-4 py-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#30312C] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] text-xs font-semibold text-[#575851] dark:text-[#A5A69B] transition-all"
        >
          Clear Search
        </button>
        <button 
          @click="showCreateModal = true" 
          class="bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border border-[#A7A99A]/40 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[16px]">add</span>
          <span>Create Trip</span>
        </button>
      </div>
    </div>

    <!-- Trip Cards Grid -->
    <section v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <TripCard 
        v-for="trip in displayTrips" 
        :key="trip.id || trip._id" 
        :trip="trip" 
        @click="goToTrip(trip.id || trip._id)" 
      />
    </section>

    <!-- Create Trip Modal -->
    <CreateTripModal 
      v-model:isOpen="showCreateModal" 
      :initialDestination="initialDestination"
      @trip-created="onTripCreated" 
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import AppLayout from '../components/AppLayout.vue';
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
  currency: 'INR',
  spentByCurrency: {},
  hasMultipleCurrencies: false
});
const summaryLoading = ref(true);

const formattedTotalSpent = computed(() => {
  if (summary.value?.spentByCurrency && typeof summary.value.spentByCurrency === 'object') {
    const entries = Object.entries(summary.value.spentByCurrency).filter(([, amt]) => typeof amt === 'number' && amt > 0);
    if (entries.length > 1) {
      return entries.map(([curr, amt]) => formatCurrency(amt, curr)).join(' + ');
    }
    if (entries.length === 1) {
      const [curr, amt] = entries[0];
      return formatCurrency(amt, curr);
    }
  }
  const fallbackCurrency = summary.value?.currency || 'INR';
  return formatCurrency(summary.value?.totalSpent ?? 0, fallbackCurrency);
});

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
    return list.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  } else if (activeFilter.value === 'Past') {
    return list.filter(t => t.status === 'completed' || t.status === 'cancelled');
  }

  return list;
});

const onTripCreated = (trip) => {
  if (!trip) return;
  const newTripId = trip.id || trip._id;
  if (!trips.value.some(existingTrip => (existingTrip.id || existingTrip._id) === newTripId)) {
    trips.value.unshift(trip);
    fetchSummary();
  }
};

const goToTrip = (id) => {
  router.push(`/trips/${id}`);
};

onMounted(() => {
  tripsStore.fetchTrips().catch(err => {
    console.error('Failed to fetch trips:', err);
  });
  fetchSummary();
  if (route.query.create) {
    initialDestination.value = route.query.dest || '';
    showCreateModal.value = true;
    router.replace({ path: route.path, query: {} }).catch(() => {});
  }
});
</script>
