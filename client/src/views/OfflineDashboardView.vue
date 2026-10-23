<template>
  <AppLayout>
    <!-- Top Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-2xl text-[#86A98B]">offline_pin</span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">
            Offline Travel Companion
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-1.5 max-w-2xl">
          All your travel itineraries, booking references, emergency contacts, documents, and packing lists saved directly on this device. Fully functional without an internet connection.
        </p>
      </div>

      <!-- Connection Status & Actions -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Connectivity Badge -->
        <div 
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm"
          :class="isOnline && isServerReachable ? 'bg-[#86A98B]/15 text-[#5F8764] dark:text-[#86A98B] border-[#86A98B]/30' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'"
        >
          <span class="w-2 h-2 rounded-full" :class="isOnline && isServerReachable ? 'bg-[#86A98B] animate-pulse' : 'bg-amber-500'"></span>
          <span>{{ isOnline && isServerReachable ? 'Online & Ready to Sync' : 'Offline / Airplane Mode' }}</span>
        </div>

        <!-- PWA Install Button (if browser supports install prompt) -->
        <button
          v-if="isInstallable"
          @click="handleInstallPwa"
          class="bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          title="Install TravelSync to your home screen or desktop"
        >
          <span class="material-symbols-outlined text-[18px]">install_mobile</span>
          <span>Install App</span>
        </button>

        <router-link
          to="/dashboard"
          class="bg-[#F0EEE9] dark:bg-[#22231F] hover:bg-[#E3E0D8] dark:hover:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-[#E3E0D8] dark:border-[#30312C] transition-all"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Online Dashboard</span>
        </router-link>
      </div>
    </header>

    <!-- Storage and Stats Overview Row -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <!-- Stat 1: Downloaded Trips -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#86A98B] flex-shrink-0">
          <span class="material-symbols-outlined text-2xl">folder_special</span>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] uppercase tracking-wider">Saved Trips</p>
          <h4 class="text-xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] mt-0.5">{{ offlineStore.offlineTrips.length }}</h4>
        </div>
      </div>

      <!-- Stat 2: Storage Used -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#A5A69B] flex-shrink-0">
          <span class="material-symbols-outlined text-2xl">database</span>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] uppercase tracking-wider">Local Storage</p>
          <h4 class="text-xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] mt-0.5">
            {{ offlineStore.storageEstimate?.humanUsage || totalStoredSize }}
          </h4>
        </div>
      </div>

      <!-- Stat 3: Pending Sync Items -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
          <span class="material-symbols-outlined text-2xl">sync_alt</span>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] uppercase tracking-wider">Pending Sync</p>
          <h4 class="text-xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] mt-0.5">
            {{ offlineStore.pendingSyncCount }} <span class="text-xs font-normal text-[#7E8075]">changes</span>
          </h4>
        </div>
      </div>

      <!-- Stat 4: Security & Privacy -->
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#A5A69B] flex-shrink-0">
          <span class="material-symbols-outlined text-2xl">security</span>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[#7E8075] dark:text-[#85867C] uppercase tracking-wider">Device Scope</p>
          <h4 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mt-0.5 truncate" :title="userEmail">
            {{ userEmail || 'Current User' }}
          </h4>
        </div>
      </div>
    </div>

    <!-- Main List of Saved Trips -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      <div v-for="n in 3" :key="n" class="h-64 rounded-3xl bg-[#F0EEE9] dark:bg-[#1B1C19]"></div>
    </div>

    <!-- Empty State -->
    <div 
      v-else-if="offlineStore.offlineTrips.length === 0" 
      class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-dashed border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-10 text-center max-w-xl mx-auto my-12"
    >
      <div class="w-16 h-16 rounded-2xl bg-[#F0EEE9] dark:bg-[#22231F] text-[#86A98B] flex items-center justify-center mx-auto mb-4">
        <span class="material-symbols-outlined text-3xl">cloud_off</span>
      </div>
      <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">No trips downloaded for offline use yet</h3>
      <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-2 leading-relaxed">
        Before you board your flight or head into areas with low connectivity, open your trip while connected to the internet and click <span class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">"Make Available Offline"</span>.
      </p>
      <div class="mt-6 flex justify-center">
        <router-link
          to="/dashboard"
          class="bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-sm font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
        >
          <span class="material-symbols-outlined text-[18px]">travel_explore</span>
          <span>View My Trips</span>
        </router-link>
      </div>
    </div>

    <!-- Saved Trips Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="trip in offlineStore.offlineTrips" 
        :key="trip.tripId"
        class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between transition-all group"
      >
        <!-- Card Cover / Header -->
        <div class="relative h-44 w-full bg-[#292A25] overflow-hidden">
          <img 
            :src="trip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE" 
            :alt="trip.name"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90"
            @error="onImgError"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

          <!-- Offline Ready Badge -->
          <div class="absolute top-3.5 left-3.5 z-10 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-[11px] font-semibold text-[#86A98B]">
            <span class="material-symbols-outlined text-[14px]">offline_pin</span>
            <span>Offline Ready</span>
          </div>

          <!-- Trip Title and Destination in Image Overlay -->
          <div class="absolute bottom-3.5 left-3.5 right-3.5 z-10">
            <h3 class="text-lg font-bold text-white tracking-tight truncate drop-shadow-sm">{{ trip.name }}</h3>
            <p class="text-xs text-[#D5D3CA] flex items-center gap-1 mt-0.5">
              <span class="material-symbols-outlined text-[14px] text-[#86A98B]">location_on</span>
              <span class="truncate">{{ trip.destination }}</span>
            </p>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-5 flex-1 flex flex-col justify-between gap-4">
          <div class="space-y-2 text-xs text-[#575851] dark:text-[#A5A69B]">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>Travel Dates:</span>
              </span>
              <span class="font-medium text-[#1C1D1A] dark:text-[#D5D3CA]">
                {{ formatDate(trip.startDate) }} – {{ formatDate(trip.endDate) }}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span>Saved Offline:</span>
              </span>
              <span class="font-medium text-[#1C1D1A] dark:text-[#D5D3CA]">
                {{ formatRelative(trip.downloadedAt) }}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>Stored Size:</span>
              </span>
              <span class="font-medium text-[#1C1D1A] dark:text-[#D5D3CA]">
                {{ trip.dataSize ? (trip.dataSize / 1024).toFixed(1) + ' KB' : 'Standard Bundle' }}
              </span>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="pt-3 border-t border-[#E3E0D8] dark:border-[#30312C] flex items-center gap-2">
            <!-- Open Offline Companion -->
            <router-link
              :to="`/offline-trips/${trip.tripId}`"
              class="flex-1 bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <span class="material-symbols-outlined text-[16px]">flight_takeoff</span>
              <span>Open Companion</span>
            </router-link>

            <!-- Refresh Copy (when online) -->
            <button
              v-if="isOnline && isServerReachable"
              @click="refreshTrip(trip.tripId)"
              :disabled="refreshingTripId === trip.tripId"
              class="w-9 h-9 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] hover:bg-[#E3E0D8] dark:hover:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center border border-[#E3E0D8] dark:border-[#30312C] transition-all"
              title="Refresh offline copy from server"
            >
              <span class="material-symbols-outlined text-[18px]" :class="{ 'animate-spin': refreshingTripId === trip.tripId }">refresh</span>
            </button>

            <!-- Delete Offline Copy -->
            <button
              @click="confirmDelete(trip)"
              class="w-9 h-9 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] hover:bg-red-500/10 text-[#7E8075] hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center border border-[#E3E0D8] dark:border-[#30312C] transition-all"
              title="Remove local offline copy"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="tripToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
        <div class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-2xl">delete_forever</span>
        </div>
        <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Remove Offline Trip?</h3>
        <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-2 leading-relaxed">
          This will delete the locally stored copy of <span class="font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">"{{ tripToDelete.name }}"</span>, its itinerary, accommodations, and offline documents from this device. The original trip remains safe on the cloud server.
        </p>

        <div class="mt-6 flex items-center justify-end gap-3">
          <button
            @click="tripToDelete = null"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-[#575851] dark:text-[#A5A69B] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] transition-colors"
          >
            Cancel
          </button>
          <button
            @click="executeDelete"
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
          >
            Delete Local Copy
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppLayout from '../components/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { useOfflineStore } from '../stores/offline';
import { useToastStore } from '../stores/toast';
import { useConnectivity } from '../composables/useConnectivity';
import { isInstallable, installPwa } from '../services/pwa';

const DEFAULT_TRIP_COVER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80';

const authStore = useAuthStore();
const offlineStore = useOfflineStore();
const toastStore = useToastStore();
const { isOnline, isServerReachable } = useConnectivity();

const loading = ref(true);
const refreshingTripId = ref(null);
const tripToDelete = ref(null);

const userEmail = computed(() => authStore.currentUser?.email || authStore.firebaseUser?.email || '');
const currentUserId = computed(() => {
  if (authStore.currentUser?.id) return authStore.currentUser.id;
  if (authStore.firebaseUser?.uid) return authStore.firebaseUser.uid;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed.id;
        if (parsed?.firebaseUid) return parsed.firebaseUid;
      }
    } catch {}
  }
  return null;
});

const totalStoredSize = computed(() => {
  let bytes = 0;
  for (const t of offlineStore.offlineTrips) {
    bytes += (t.dataSizeBytes || t.dataSize || 35000);
  }
  return (bytes / 1024).toFixed(1) + ' KB';
});

onMounted(async () => {
  loading.value = true;
  try {
    if (currentUserId.value) {
      await offlineStore.loadOfflineTrips(currentUserId.value);
    } else {
      offlineStore.offlineTrips = [];
    }
  } finally {
    loading.value = false;
  }
});

function formatDate(val) {
  if (!val) return 'TBD';
  const d = new Date(val);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(val) {
  if (!val) return 'Recently';
  const diff = Date.now() - new Date(val).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function onImgError(e) {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
}

async function handleInstallPwa() {
  const installed = await installPwa();
  if (installed) {
    toastStore.showToast('TravelSync installed successfully!', 'success');
  }
}

async function refreshTrip(tripId) {
  refreshingTripId.value = tripId;
  try {
    await offlineStore.downloadTripForOffline(currentUserId.value, tripId);
    toastStore.showToast('Offline copy refreshed with the latest cloud data.', 'success');
  } catch (err) {
    toastStore.showToast(err.message || 'Failed to refresh offline trip', 'error');
  } finally {
    refreshingTripId.value = null;
  }
}

function confirmDelete(trip) {
  tripToDelete.value = trip;
}

async function executeDelete() {
  if (!tripToDelete.value) return;
  try {
    await offlineStore.removeOfflineTrip(currentUserId.value, tripToDelete.value.tripId);
    toastStore.showToast('Local offline trip copy removed.', 'info');
  } catch (err) {
    toastStore.showToast('Failed to remove offline copy', 'error');
  } finally {
    tripToDelete.value = null;
  }
}
</script>
