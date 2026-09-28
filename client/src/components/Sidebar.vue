<template>
  <div>
    <!-- Mobile drawer backdrop -->
    <div 
      v-if="isSidebarOpen" 
      @click="closeSidebar" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
    ></div>

    <!-- Sleek Dark Sidebar -->
    <aside 
      class="bg-[#080D1A] text-slate-300 font-['Plus_Jakarta_Sans'] fixed h-full left-0 top-0 border-r border-[#172338] flex flex-col justify-between p-4 z-40 transition-all duration-300 w-64 shadow-2xl"
      :class="[
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Top Section: Brand & Nav Links -->
      <div class="flex flex-col gap-6">
        <!-- Logo Header -->
        <router-link to="/dashboard" class="flex items-center gap-3 px-2 py-1 group">
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-[20px]">explore</span>
          </div>
          <span class="text-lg font-bold text-white tracking-tight">TravelSync</span>
        </router-link>

        <!-- Navigation Links -->
        <nav class="flex flex-col gap-1.5">
          <!-- Trip Context Navigation (When inside a trip) -->
          <template v-if="currentTripId">
            <router-link 
              to="/dashboard"
              @click="closeSidebar"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-slate-400 hover:text-white hover:bg-[#121D33] text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">arrow_back</span>
              <span>My Trips</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}`"
              @click="closeSidebar"
              :class="isTripOverviewActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">space_dashboard</span>
              <span>Trip Overview</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/map`"
              @click="closeSidebar"
              :class="isItineraryActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">event_note</span>
              <span>Itinerary</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/map`"
              @click="closeSidebar"
              :class="isMapActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">map</span>
              <span>Map</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}/expenses`"
              @click="closeSidebar"
              :class="isActive(`/trips/${currentTripId}/expenses`) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">payments</span>
              <span>Expenses</span>
            </router-link>

            <router-link 
              :to="`/trips/${currentTripId}`"
              @click="closeSidebar"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-slate-400 hover:text-white hover:bg-[#121D33] text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">group</span>
              <span>Members</span>
            </router-link>

            <router-link 
              to="/settings"
              @click="closeSidebar"
              :class="isActive('/settings') ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'"
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
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
              :class="isActive('/dashboard') ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">grid_view</span>
              <span>My Trips</span>
            </router-link>
            
            <router-link 
              to="/explore" 
              @click="closeSidebar"
              :class="isActive('/explore') ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">explore</span>
              <span>Explore</span>
            </router-link>

            <router-link 
              to="/settings" 
              @click="closeSidebar"
              :class="isActive('/settings') ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-[#121D33]'" 
              class="px-3.5 py-2.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all"
            >
              <span class="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </router-link>
          </template>
        </nav>
      </div>

      <!-- Bottom Section: Promo Card & User Profile -->
      <div class="flex flex-col gap-4">
        <!-- Promo / Inspiration Card -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121E36] to-[#0A1324] border border-[#1E2E4E] p-4 group">
          <div class="relative z-10">
            <h4 class="text-white text-xs font-bold leading-tight mb-1">Plan together<br/>Travel better</h4>
            <p class="text-[11px] text-slate-400 leading-snug">Create memories with your favorite people</p>
          </div>
          <!-- Scenic mountain thumbnail overlay -->
          <div class="mt-3 h-16 rounded-xl overflow-hidden relative">
            <img 
              src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=400" 
              alt="Mountain scenery"
              class="w-full h-full object-cover brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-[#0A1324]/80 to-transparent"></div>
          </div>
        </div>

        <!-- User Profile Pill -->
        <div class="flex items-center justify-between p-2 rounded-xl hover:bg-[#121D33] transition-colors border border-transparent hover:border-[#1E2E4E]">
          <router-link to="/settings" class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-md">
              <img 
                v-if="userPicture" 
                :src="userPicture" 
                alt="Profile" 
                class="w-full h-full object-cover rounded-full"
              />
              <span v-else>{{ userInitials }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-white truncate">{{ userName }}</p>
              <p class="text-[10px] text-slate-400 truncate">{{ userEmail }}</p>
            </div>
          </router-link>
          
          <button 
            @click="handleLogout" 
            class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors ml-1"
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSidebar } from '../composables/useSidebar';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { isSidebarOpen, closeSidebar } = useSidebar();

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
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
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
