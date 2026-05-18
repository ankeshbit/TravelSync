<template>
  <teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        @click="closeModal"
      ></div>

      <!-- Modal Content -->
      <div
        class="relative bg-surface-container-lowest dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="relative h-32 w-full bg-primary-container flex-shrink-0">
          <div class="absolute inset-0 bg-gradient-to-br from-sky-600 to-indigo-700 opacity-90"></div>
          <div class="absolute inset-0 flex flex-col justify-end p-6">
            <div class="flex items-center gap-3 mb-1">
              <span class="material-symbols-outlined text-white text-2xl">auto_awesome</span>
              <h2 class="font-h2 text-h2 text-white">AI Trip Planner</h2>
            </div>
            <p class="font-body-md text-body-md text-white/80">Let AI craft a personalised itinerary for you</p>
          </div>
          <button
            @click="closeModal"
            class="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors bg-black/20 rounded-full p-1"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto">
          <!-- Plan Form -->
          <form v-if="!itinerary" @submit.prevent="generatePlan" class="p-6 space-y-5">

            <!-- Destination -->
            <div class="space-y-1.5">
              <label class="block font-label-sm text-label-sm text-on-surface dark:text-slate-200" for="ai-destination">
                Destination <span class="text-error dark:text-red-400">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">location_on</span>
                <input
                  v-model="form.destination"
                  id="ai-destination"
                  type="text"
                  required
                  placeholder="e.g., Goa, India"
                  class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none dark:text-white"
                />
              </div>
            </div>

            <!-- Days + Budget Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="block font-label-sm text-label-sm text-on-surface dark:text-slate-200" for="ai-days">
                  Number of Days <span class="text-error dark:text-red-400">*</span>
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">calendar_today</span>
                  <input
                    v-model.number="form.days"
                    id="ai-days"
                    type="number"
                    min="1"
                    max="30"
                    required
                    placeholder="e.g., 5"
                    class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none dark:text-white"
                  />
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="block font-label-sm text-label-sm text-on-surface dark:text-slate-200" for="ai-budget">
                  Budget (₹ INR) <span class="text-error dark:text-red-400">*</span>
                </label>
                <div class="relative">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">currency_rupee</span>
                  <input
                    v-model.number="form.budget"
                    id="ai-budget"
                    type="number"
                    min="0"
                    required
                    placeholder="e.g., 50000"
                    class="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Travel Style -->
            <div class="space-y-1.5">
              <label class="block font-label-sm text-label-sm text-on-surface dark:text-slate-200">
                Travel Style <span class="text-error dark:text-red-400">*</span>
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  v-for="s in styles"
                  :key="s.value"
                  type="button"
                  @click="form.style = s.value"
                  :class="[
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-center',
                    form.style === s.value
                      ? 'border-primary bg-primary/10 dark:bg-sky-900/30 text-primary dark:text-sky-400'
                      : 'border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-400 hover:border-primary/50 hover:bg-surface-variant dark:hover:bg-slate-800'
                  ]"
                >
                  <span class="material-symbols-outlined text-xl">{{ s.icon }}</span>
                  <span class="text-xs font-semibold capitalize">{{ s.label }}</span>
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="pt-4 border-t border-outline-variant dark:border-slate-700 flex flex-col sm:flex-row-reverse items-center gap-3 mt-6">
              <button
                type="submit"
                :disabled="loading || !form.style"
                class="w-full sm:w-auto px-6 py-2.5 bg-primary-container dark:bg-blue-600 text-on-secondary dark:text-white rounded-lg font-h3 text-h3 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 min-w-[150px]"
              >
                <span v-if="loading" class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                <span class="material-symbols-outlined text-base" v-else>auto_awesome</span>
                {{ loading ? 'Generating...' : 'Generate Plan' }}
              </button>
              <button
                type="button"
                @click="closeModal"
                class="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-300 rounded-lg font-h3 text-h3 hover:bg-surface-variant dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </form>

          <!-- Skeleton Loader -->
          <div v-else-if="loading" class="p-6 space-y-6">
            <div v-for="d in 3" :key="d" class="space-y-3">
              <div class="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 border border-outline-variant dark:border-slate-700 rounded-xl">
                <div class="w-12 h-12 rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse flex-shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-2/3"></div>
                  <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Itinerary Preview -->
          <div v-else-if="itinerary" class="p-6 space-y-6">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="font-h3 text-h3 text-primary">Your AI Itinerary</h3>
                <p class="text-sm text-outline">{{ itinerary.length }} places across {{ form.days }} days</p>
              </div>
              <button
                @click="resetPlan"
                class="flex items-center gap-1.5 text-sm text-outline hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-800"
              >
                <span class="material-symbols-outlined text-base">refresh</span>
                Re-generate
              </button>
            </div>

            <!-- Day Groups -->
            <div v-for="(dayPlaces, dayNumber) in placesByDay" :key="dayNumber" class="space-y-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-outline-variant uppercase tracking-widest">Day {{ dayNumber }}</span>
                <div class="flex-1 h-[1px] bg-gray-100 dark:bg-slate-700"></div>
                <span class="text-xs text-outline">{{ dayPlaces.length }} places</span>
              </div>

              <div
                v-for="(place, idx) in dayPlaces"
                :key="idx"
                class="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-xl hover:shadow-md hover:border-primary-container dark:hover:border-blue-800 transition-all"
              >
                <div class="relative flex-shrink-0">
                  <div class="w-10 h-10 rounded-lg bg-surface-container-low dark:bg-slate-700 flex items-center justify-center text-primary dark:text-blue-400">
                    <span class="material-symbols-outlined text-lg">location_on</span>
                  </div>
                  <div class="absolute -top-1.5 -left-1.5 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[9px] font-bold border border-white">{{ place.orderIndex + 1 }}</div>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-body-md font-bold text-on-surface dark:text-white truncate">{{ place.name }}</h4>
                  <p class="text-[12px] text-outline truncate">{{ place.address }}</p>
                  <p v-if="place.note" class="text-[11px] text-outline-variant italic mt-0.5 line-clamp-2">{{ place.note }}</p>
                </div>
                <button
                  @click="addSinglePlace(place)"
                  :disabled="addedPlaceIndices.has(`${place.dayNumber}-${place.orderIndex}`)"
                  class="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                  :class="addedPlaceIndices.has(`${place.dayNumber}-${place.orderIndex}`)
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-primary-container dark:bg-sky-900/40 text-primary dark:text-sky-400 hover:bg-primary hover:text-white dark:hover:bg-sky-600'"
                >
                  <span class="material-symbols-outlined text-sm">{{ addedPlaceIndices.has(`${place.dayNumber}-${place.orderIndex}`) ? 'check' : 'add' }}</span>
                  {{ addedPlaceIndices.has(`${place.dayNumber}-${place.orderIndex}`) ? 'Added' : 'Add' }}
                </button>
              </div>
            </div>

            <!-- Add All Button -->
            <div class="pt-4 border-t border-outline-variant dark:border-slate-700 flex flex-col sm:flex-row-reverse items-center gap-3">
              <button
                @click="addAllPlaces"
                :disabled="addingAll || allAdded"
                class="w-full sm:w-auto px-6 py-2.5 bg-primary-container dark:bg-blue-600 text-on-secondary dark:text-white rounded-lg font-h3 text-h3 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 min-w-[160px]"
              >
                <span v-if="addingAll" class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                <span class="material-symbols-outlined text-base" v-else>{{ allAdded ? 'check_circle' : 'playlist_add' }}</span>
                {{ addingAll ? 'Adding...' : allAdded ? 'All Added!' : 'Add All to Trip' }}
              </button>
              <button
                @click="closeModal"
                class="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-outline-variant dark:border-slate-700 text-on-surface-variant dark:text-slate-300 rounded-lg font-h3 text-h3 hover:bg-surface-variant dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import api from '../api';
import { usePlacesStore } from '../stores/places';
import { useToastStore } from '../stores/toast';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  tripId: {
    type: String,
    required: true
  },
  initialDestination: {
    type: String,
    default: ''
  },
  tripDaysCount: {
    type: Number,
    default: 3
  }
});

const emit = defineEmits(['update:isOpen']);

const placesStore = usePlacesStore();
const toastStore = useToastStore();

const loading = ref(false);
const itinerary = ref(null);
const addingAll = ref(false);
const addedPlaceIndices = ref(new Set());

const form = reactive({
  destination: '',
  days: 3,
  budget: '',
  style: ''
});

const styles = [
  { value: 'adventure', label: 'Adventure', icon: 'hiking' },
  { value: 'culture', label: 'Culture', icon: 'museum' },
  { value: 'food', label: 'Food', icon: 'restaurant' },
  { value: 'relaxation', label: 'Relaxation', icon: 'spa' }
];

// Reset state when modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.destination = props.initialDestination || '';
    form.days = props.tripDaysCount || 3;
    form.budget = '';
    form.style = '';
    itinerary.value = null;
    addedPlaceIndices.value = new Set();
    addingAll.value = false;
  }
});

const placesByDay = computed(() => {
  if (!itinerary.value) return {};
  const grouped = {};
  const sorted = [...itinerary.value].sort((a, b) =>
    a.dayNumber === b.dayNumber ? a.orderIndex - b.orderIndex : a.dayNumber - b.dayNumber
  );
  sorted.forEach(place => {
    if (!grouped[place.dayNumber]) grouped[place.dayNumber] = [];
    grouped[place.dayNumber].push(place);
  });
  return grouped;
});

const allAdded = computed(() => {
  if (!itinerary.value || itinerary.value.length === 0) return false;
  return itinerary.value.every(p => addedPlaceIndices.value.has(`${p.dayNumber}-${p.orderIndex}`));
});

const closeModal = () => {
  emit('update:isOpen', false);
};

const resetPlan = () => {
  itinerary.value = null;
  addedPlaceIndices.value = new Set();
  addingAll.value = false;
};

const generatePlan = async () => {
  if (!form.style) {
    toastStore.showToast('Please select a travel style.', 'error');
    return;
  }

  loading.value = true;
  itinerary.value = null;

  try {
    const res = await api.post(`/trips/${props.tripId}/ai-plan`, {
      destination: form.destination,
      days: form.days,
      budget: form.budget,
      style: form.style
    });
    itinerary.value = res.data;
    toastStore.showToast('Itinerary generated! Review and add places to your trip.', 'success');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to generate plan. Please try again.', 'error');
  } finally {
    loading.value = false;
  }
};

const addSinglePlace = async (place) => {
  const key = `${place.dayNumber}-${place.orderIndex}`;
  if (addedPlaceIndices.value.has(key)) return;

  try {
    await placesStore.addPlace(props.tripId, {
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      dayNumber: place.dayNumber,
      orderIndex: place.orderIndex,
      note: place.note || ''
    });
    addedPlaceIndices.value = new Set([...addedPlaceIndices.value, key]);
    toastStore.showToast(`"${place.name}" added to Day ${place.dayNumber}.`, 'success');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || `Failed to add "${place.name}".`, 'error');
  }
};

const addAllPlaces = async () => {
  if (!itinerary.value || addingAll.value) return;
  addingAll.value = true;

  const pending = itinerary.value.filter(
    p => !addedPlaceIndices.value.has(`${p.dayNumber}-${p.orderIndex}`)
  );

  for (const place of pending) {
    try {
      await placesStore.addPlace(props.tripId, {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        dayNumber: place.dayNumber,
        orderIndex: place.orderIndex,
        note: place.note || ''
      });
      addedPlaceIndices.value = new Set([...addedPlaceIndices.value, `${place.dayNumber}-${place.orderIndex}`]);
    } catch (err) {
      toastStore.showToast(`Failed to add "${place.name}". Continuing with the rest.`, 'error');
    }
  }

  toastStore.showToast('All places added to your trip!', 'success');
  addingAll.value = false;
};
</script>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-fade-in-up {
  animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
