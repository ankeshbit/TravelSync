<template>
  <div>
    <!-- Mobile drawer backdrop -->
    <div 
      v-if="isSidebarOpen" 
      @click="closeSidebar" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
    ></div>

    <!-- Sleek Sidebar with Dark & Light Mode Support -->
    <aside 
      class="bg-[#EFECE6] dark:bg-[#141512] text-[#575851] dark:text-[#A5A69B] font-['Plus_Jakarta_Sans'] fixed h-full left-0 top-0 border-r border-[#E3E0D8] dark:border-[#30312C] flex flex-col justify-between p-4 pb-5 z-40 transition-all duration-300 w-64 shadow-md dark:shadow-none overflow-y-auto custom-scrollbar"
      :class="[
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Top Section: Brand & Nav Links -->
      <div class="flex flex-col gap-6">
        <!-- Logo Header with Theme Toggle -->
        <div class="flex items-center justify-between px-2 py-1">
          <router-link to="/dashboard" class="flex items-center gap-3 group">
            <img :src="logoUrl" alt="TravelSync" class="w-8 h-8 object-contain rounded-lg shadow-sm group-hover:scale-105 transition-transform" />
            <span class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">TravelSync</span>
          </router-link>
          <ThemeToggle />
        </div>

        <!-- Navigation Links -->
        <nav class="flex flex-col gap-1.5">
          <!-- Trip Context Navigation (When inside a trip) -->
          <template v-if="currentTripId">
            <router-link 
              to="/dashboard"
              @click="closeSidebar"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] text-sm font-medium transition-all border border-transparent"
            >
              <span class="material-symbols-outlined text-[20px]">arrow_back</span>
              <span>My Trips</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}`"
              @click="closeSidebar"
              :class="isTripOverviewActive ? activeNavClass : inactiveNavClass"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">space_dashboard</span>
              <span>Trip Overview</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/map`"
              @click="closeSidebar"
              :class="isItineraryActive ? activeNavClass : inactiveNavClass"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">event_note</span>
              <span>Itinerary</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/map`"
              @click="closeSidebar"
              :class="isMapActive ? activeNavClass : inactiveNavClass"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">map</span>
              <span>Map</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/expenses`"
              @click="closeSidebar"
              :class="isActive(`/trips/${currentTripId}/expenses`) ? activeNavClass : inactiveNavClass"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">payments</span>
              <span>Expenses</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}`"
              @click="closeSidebar"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] text-sm font-medium transition-all border border-transparent"
            >
              <span class="material-symbols-outlined text-[20px]">group</span>
              <span>Members</span>
            </router-link>

            <router-link 
              :to="`/offline-trips/${currentTripId}`"
              @click="closeSidebar"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] text-sm font-medium transition-all border border-transparent"
            >
              <span class="material-symbols-outlined text-[20px] text-[#86A98B]">offline_bolt</span>
              <span>Offline Companion</span>
            </router-link>

            <router-link 
              to="/settings"
              @click="closeSidebar"
              :class="isActive('/settings') ? activeNavClass : inactiveNavClass"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </router-link>
          </template>

          <!-- Global Navigation (Dashboard, Explore, Settings) -->
          <template v-else>
            <router-link 
              to="/dashboard" 
              @click="closeSidebar"
              :class="isActive('/dashboard') ? activeNavClass : inactiveNavClass" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">grid_view</span>
              <span>My Trips</span>
            </router-link>
            
            <router-link 
              to="/explore" 
              @click="closeSidebar"
              :class="isActive('/explore') ? activeNavClass : inactiveNavClass" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">explore</span>
              <span>Explore</span>
            </router-link>

            <router-link 
              to="/offline-trips" 
              @click="closeSidebar"
              :class="isActive('/offline-trips') ? activeNavClass : inactiveNavClass" 
              class="px-3.5 py-2.5 flex items-center justify-between rounded-xl text-sm transition-all"
            >
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-[20px] text-[#86A98B]">offline_pin</span>
                <span>Offline Trips</span>
              </div>
              <span v-if="offlineStore.offlineTrips.length > 0" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#86A98B]/20 text-[#86A98B]">
                {{ offlineStore.offlineTrips.length }}
              </span>
            </router-link>

            <router-link 
              to="/settings" 
              @click="closeSidebar"
              :class="isActive('/settings') ? activeNavClass : inactiveNavClass" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </router-link>
          </template>
        </nav>
      </div>

      <!-- Bottom Section: Promo Card & User Profile -->
      <div class="flex flex-col gap-4 mt-auto pt-4">
        <!-- Promo / Inspiration Card -->
        <div class="relative overflow-hidden rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] p-4.5 group shadow-sm">
          <div class="relative z-10">
            <h4 class="text-[#1C1D1A] dark:text-[#D5D3CA] text-xs font-bold leading-tight mb-1.5">Plan together<br/>Travel better</h4>
            <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] leading-relaxed">Create memories with your favorite people</p>
          </div>
          <!-- Scenic mountain thumbnail overlay -->
          <div class="mt-3.5 h-16 rounded-xl overflow-hidden relative">
            <img 
              src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=400" 
              alt="Mountain scenery"
              class="w-full h-full object-cover brightness-95 group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-[#111210]/70 to-transparent"></div>
          </div>
        </div>

        <!-- User Profile Pill -->
        <div class="flex items-center justify-between p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all shadow-sm">
          <router-link to="/settings" class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-9 h-9 rounded-full bg-[#4A4D40] dark:bg-[#292A25] text-[#F7F6F2] dark:text-[#D5D3CA] border border-transparent dark:border-[#414239] font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-sm overflow-hidden">
              <img 
                v-if="userPicture" 
                :src="userPicture" 
                alt="Profile" 
                class="w-full h-full object-cover rounded-full"
              />
              <span v-else>{{ userInitials }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ userName }}</p>
              <p class="text-[10px] text-[#7E8075] dark:text-[#85867C] truncate">{{ userEmail }}</p>
            </div>
          </router-link>
          
          <button 
            @click="handleLogout" 
            class="text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] p-1.5 rounded-lg hover:bg-[#E3E0D8] dark:hover:bg-[#292A25] transition-colors ml-1.5 flex-shrink-0"
            title="Log out"
          >
            <span class="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSidebar } from '../composables/useSidebar';
import { useAuthStore } from '../stores/auth';
import { useOfflineStore } from '../stores/offline';
import { getBaseUrl } from '../utils/url';
import logoUrl from '../assets/logo.png';
import ThemeToggle from './ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const offlineStore = useOfflineStore();
const { isSidebarOpen, closeSidebar } = useSidebar();

onMounted(() => {
  const uid = authStore.currentUser?.id || authStore.firebaseUser?.uid;
  if (uid) {
    offlineStore.loadOfflineTrips(uid).catch(() => {});
  }
});

const activeNavClass = 'bg-[#FFFFFF] dark:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] border border-[#D1CEC4] dark:border-[#414239] shadow-sm font-semibold';
const inactiveNavClass = 'text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] border border-transparent font-medium';

const currentTripId = computed(() => {
  return route.params.tripId || route.params.id || null;
});

const isTripOverviewActive = computed(() => {
  return route.path === `/trips/${currentTripId.value}`;
});

const isItineraryActive = computed(() => {
  return route.path.includes('/map') && route.query.tab === 'itinerary';
});

const isMapActive = computed(() => {
  return route.path.includes('/map') && !route.query.tab;
});

const isActive = (path) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard';
  }
  return route.path === path;
};

// User Profile Information
const userName = computed(() => {
  if (authStore.currentUser?.name) return authStore.currentUser.name;
  if (authStore.firebaseUser?.displayName) return authStore.firebaseUser.displayName;
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.name) return u.name;
    } catch {}
  }
  return 'Traveler';
});

const userEmail = computed(() => {
  if (authStore.currentUser?.email) return authStore.currentUser.email;
  if (authStore.firebaseUser?.email) return authStore.firebaseUser.email;
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.email) return u.email;
    } catch {}
  }
  return '';
});

const userInitials = computed(() => {
  const name = userName.value.trim();
  if (!name) return 'RA';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
});

const userPicture = computed(() => {
  if (authStore.currentUser?.picture) {
    const pic = authStore.currentUser.picture;
    if (pic.startsWith('http')) return pic;
    const base = getBaseUrl();
    return `${base}${pic}`;
  }
  if (authStore.firebaseUser?.photoURL) {
    return authStore.firebaseUser.photoURL;
  }
  return '';
});

const handleLogout = async () => {
  try {
    await authStore.logout();
  } catch {}
  router.push('/login');
};
</script>
