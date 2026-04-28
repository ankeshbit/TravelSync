<template>
  <div class="bg-background text-on-surface min-h-screen flex flex-col">
    <Navbar />

    <div class="flex flex-1 mt-[64px]">
      <Sidebar />

      <!-- Main Content Canvas -->
      <main class="flex-1 md:ml-64 p-gutter pb-32">
        <!-- Hero Header Section -->
        <section v-if="!loading && trip" class="relative rounded-xl overflow-hidden mb-lg border border-gray-100 bg-white">
          <div class="h-48 md:h-64 w-full relative">
            <img alt="Trip Cover" class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=1000"/>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div class="absolute bottom-0 left-0 p-lg w-full flex justify-between items-end">
              <div>
                <h1 class="font-h1 text-h1 text-white mb-xs">{{ trip.name }}</h1>
                <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-white/90">
                  <span class="flex items-center gap-1 font-body-md text-body-md">
                    <span class="material-symbols-outlined text-[18px]" data-icon="location_on">location_on</span>
                    {{ trip.destination }}
                  </span>
                  <span class="flex items-center gap-1 font-body-md text-body-md">
                    <span class="material-symbols-outlined text-[18px]" data-icon="calendar_today">calendar_today</span>
                    {{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}
                  </span>
                </div>
              </div>
              <button v-if="isCreator" @click="$router.push(`/trips/${trip._id}/edit`)" class="bg-white text-primary px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg active:scale-95 duration-150">
                <span class="material-symbols-outlined text-[20px]" data-icon="edit">edit</span>
                Edit
              </button>
            </div>
          </div>
        </section>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center items-center h-64">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
        <div v-if="error" class="bg-error-container text-on-error-container p-4 rounded-lg text-center font-semibold my-8">
          {{ error }}
        </div>

        <!-- Members & Details Bento Grid -->
        <div v-if="!loading && trip" class="grid grid-cols-1 md:grid-cols-12 gap-gutter">
          <!-- Members Section -->
          <section class="md:col-span-4 bg-white p-lg rounded-xl border border-gray-200">
            <div class="flex items-center justify-between mb-md">
              <h2 class="font-h2 text-h2 text-primary">Members</h2>
              <span class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container rounded-full px-3 py-1">{{ tripsStore.members.length + 1 }} active</span>
            </div>

            <!-- Members List -->
            <div class="space-y-2 mb-md max-h-[200px] overflow-y-auto">
              <!-- Owner -->
              <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-primary/20">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-900 text-xs flex-shrink-0">
                    {{ trip.ownerId && trip.ownerId.name ? trip.ownerId.name.substring(0,2).toUpperCase() : 'U' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-on-surface truncate">{{ trip.ownerId?.name }}</p>
                    <p class="text-[11px] text-outline-variant truncate">{{ trip.ownerId?.email }}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-primary bg-primary-container px-2 py-0.5 rounded ml-1 flex-shrink-0">Owner</span>
              </div>

              <!-- Members from store -->
              <div v-for="member in tripsStore.members" :key="member._id" class="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-700 text-xs flex-shrink-0">
                    {{ member.name ? member.name.substring(0,2).toUpperCase() : '?' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-on-surface truncate">{{ member.name }}</p>
                    <p class="text-[11px] text-outline-variant truncate">{{ member.email }}</p>
                  </div>
                </div>
                <button 
                  v-if="isCreator"
                  @click="removeMemberConfirm(member._id)"
                  class="text-outline-variant hover:text-error ml-1 flex-shrink-0 transition-colors"
                  title="Remove member">
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <!-- Add Member (only if creator) -->
            <div v-if="isCreator" class="space-y-2 border-t border-gray-100 pt-md">
              <div v-if="tripsStore.memberError" class="bg-error-container text-on-error-container text-xs p-2 rounded-lg">
                {{ tripsStore.memberError }}
              </div>
              <div v-if="memberSuccessMessage" class="bg-success-container text-on-surface text-xs p-2 rounded-lg">
                {{ memberSuccessMessage }}
              </div>
              <div class="flex items-center gap-2">
                <input 
                  v-model="inviteEmail"
                  class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                  placeholder="name@email.com" 
                  type="email"
                  @keyup.enter="handleInvite"
                />
                <button 
                  @click="handleInvite"
                  :disabled="tripsStore.memberLoading"
                  class="bg-surface-container-low text-primary p-2 rounded-lg hover:bg-primary hover:text-white transition-all duration-200 disabled:opacity-50">
                  <span class="material-symbols-outlined text-[20px]">{{ tripsStore.memberLoading ? 'hourglass_bottom' : 'person_add' }}</span>
                </button>
              </div>
            </div>

            <!-- Delete Trip -->
            <div v-if="isCreator" class="mt-8 border-t border-gray-100 pt-4">
               <button @click="confirmDelete" class="w-full bg-error-container text-on-error-container px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                  <span class="material-symbols-outlined">delete</span> Delete Trip
               </button>
            </div>
          </section>

          <!-- Information Section -->
          <section class="md:col-span-8 bg-white p-lg rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex items-start gap-3 p-md bg-surface-container-low rounded-lg">
              <span class="material-symbols-outlined text-primary" data-icon="flight_takeoff">flight_takeoff</span>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Flight</p>
                <p class="text-sm font-semibold">TBD</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-md bg-surface-container-low rounded-lg">
              <span class="material-symbols-outlined text-primary" data-icon="hotel">hotel</span>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Lodging</p>
                <p class="text-sm font-semibold">TBD</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-md bg-surface-container-low rounded-lg">
              <span class="material-symbols-outlined text-primary" data-icon="euro">euro</span>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Budget</p>
                <p class="text-sm font-semibold">TBD</p>
              </div>
            </div>
            <div class="flex items-start gap-3 p-md bg-surface-container-low rounded-lg">
              <span class="material-symbols-outlined text-primary" data-icon="groups">groups</span>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Split Strategy</p>
                <p class="text-sm font-semibold">Equal Distribution</p>
              </div>
            </div>
          </section>

          <!-- Itinerary Link -->
          <router-link :to="`/trips/${trip._id}/map`" class="md:col-span-6 min-h-[300px] border border-gray-200 rounded-xl bg-surface-container-low flex flex-col items-center justify-center p-xl relative overflow-hidden group hover:border-primary hover:shadow-md transition-all cursor-pointer">
            <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
              <span class="bg-primary text-white px-6 py-2 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">map</span> Open Map & Itinerary
              </span>
            </div>
            <div class="text-center group-hover:scale-95 transition-transform duration-300">
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-md shadow-sm border border-gray-100 text-primary">
                <span class="material-symbols-outlined text-4xl" data-icon="event_note">event_note</span>
              </div>
              <h3 class="font-h3 text-h3 text-primary mb-xs">Map & Itinerary</h3>
              <p class="font-body-md text-body-md text-outline max-w-[240px]">Drag and drop activities to build your perfect schedule on the interactive map.</p>
            </div>
          </router-link>

          <!-- Expenses Link -->
          <router-link :to="`/trips/${trip._id}/expenses`" class="md:col-span-6 min-h-[300px] border border-gray-200 rounded-xl bg-surface-container-low flex flex-col items-center justify-center p-xl relative overflow-hidden group hover:border-primary hover:shadow-md transition-all cursor-pointer">
            <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
              <span class="bg-primary text-white px-6 py-2 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span> Manage Expenses
              </span>
            </div>
            <div class="text-center group-hover:scale-95 transition-transform duration-300">
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-md shadow-sm border border-gray-100 text-primary">
                <span class="material-symbols-outlined text-4xl" data-icon="account_balance_wallet">account_balance_wallet</span>
              </div>
              <h3 class="font-h3 text-h3 text-primary mb-xs">Expenses</h3>
              <p class="font-body-md text-body-md text-outline max-w-[240px]">Track and split expenses for collaborative budgeting and bill settling.</p>
            </div>
          </router-link>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import { useTripsStore } from '../stores/trips';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';

const route = useRoute();
const router = useRouter();
const tripsStore = useTripsStore();

const trip = ref(null);
const loading = ref(true);
const error = ref('');
const inviteEmail = ref('');
const memberSuccessMessage = ref('');

const fetchTrip = async () => {
  try {
    loading.value = true;
    error.value = '';
    const res = await api.get(`/trips/${route.params.id}`);
    trip.value = res.data;
    
    // Fetch members
    await tripsStore.fetchMembers(route.params.id);
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch trip details.';
  } finally {
    loading.value = false;
  }
};

const isCreator = computed(() => {
  if (!trip.value) return false;
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return trip.value.ownerId._id === user.id || trip.value.ownerId === user.id;
    } catch(e) {}
  }
  return false;
});

const handleInvite = async () => {
  if (!inviteEmail.value.trim()) {
    tripsStore.memberError = 'Please enter an email address';
    return;
  }

  try {
    tripsStore.clearMemberError();
    memberSuccessMessage.value = '';
    await tripsStore.addMember(route.params.id, inviteEmail.value);
    memberSuccessMessage.value = 'Member added successfully!';
    inviteEmail.value = '';
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      memberSuccessMessage.value = '';
    }, 3000);
  } catch (err) {
    // Error is already set in store
  }
};

const removeMemberConfirm = async (memberId) => {
  if (confirm('Are you sure you want to remove this member from the trip?')) {
    try {
      tripsStore.clearMemberError();
      memberSuccessMessage.value = '';
      await tripsStore.removeMember(route.params.id, memberId);
      memberSuccessMessage.value = 'Member removed successfully!';
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        memberSuccessMessage.value = '';
      }, 3000);
    } catch (err) {
      // Error is already set in store
    }
  }
};

const confirmDelete = async () => {
  if (confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
    try {
      await api.delete(`/trips/${trip.value._id}`);
      router.push('/dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete trip.');
    }
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

onMounted(() => {
  fetchTrip();
});
</script>
