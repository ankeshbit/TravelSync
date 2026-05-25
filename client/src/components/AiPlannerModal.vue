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
        class="relative bg-surface-container-lowest dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="relative h-24 w-full bg-primary-container flex-shrink-0">
          <div class="absolute inset-0 bg-gradient-to-br from-sky-600 to-indigo-700 opacity-90"></div>
          <div class="absolute inset-0 flex flex-col justify-end p-6">
            <div class="flex items-center gap-3 mb-1">
              <span class="material-symbols-outlined text-white text-2xl">auto_awesome</span>
              <h2 class="font-h2 text-h2 text-white">AI Trip Planner</h2>
            </div>
          </div>
          <button
            @click="closeModal"
            class="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors bg-black/20 rounded-full p-1"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
          <!-- Form -->
          <div v-if="!itinerary && !loading" class="p-6 space-y-5 bg-white dark:bg-slate-800 m-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Tell us your preferences</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget</label>
                <select v-model="form.budget" class="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none">
                  <option value="economy">Economy</option>
                  <option value="moderate">Moderate</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interests</label>
                <input 
                  type="text" 
                  v-model="form.interests" 
                  placeholder="e.g. food, culture, nightlife, shopping" 
                  class="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div class="pt-4 flex justify-end gap-3">
                <button @click="closeModal" class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                <button @click="generatePlan" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm">auto_awesome</span>
                  Generate Itinerary
                </button>
              </div>
            </div>
          </div>

          <!-- Loading Spinner -->
          <div v-if="loading" class="p-12 flex flex-col items-center justify-center space-y-4">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            <p class="text-gray-500 dark:text-gray-400 font-medium">Crafting your perfect trip...</p>
          </div>

          <!-- AI Response -->
          <div v-if="itinerary && !loading" class="p-6 space-y-6">
            <!-- Summary Banner -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <h3 class="text-blue-800 dark:text-blue-300 font-semibold mb-1">Overview</h3>
              <p class="text-blue-900 dark:text-blue-200 text-sm">{{ itinerary.summary }}</p>
            </div>

            <!-- Day-by-Day Accordion -->
            <div class="space-y-4">
              <div v-for="dayData in itinerary.days" :key="dayData.day" class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                
                <div class="bg-gray-50 dark:bg-slate-750 px-4 py-3 flex justify-between items-center cursor-pointer border-b border-gray-200 dark:border-slate-700">
                  <div>
                    <h4 class="font-bold text-gray-900 dark:text-white">Day {{ dayData.day }}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ dayData.theme }}</p>
                  </div>
                </div>

                <div class="p-4 space-y-4">
                  <div v-for="(place, index) in dayData.places" :key="index" class="flex gap-4 items-start p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <h5 class="font-bold text-gray-900 dark:text-white">{{ place.name }}</h5>
                        <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300">{{ place.type }}</span>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">{{ place.description }}</p>
                      <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">schedule</span> {{ place.bestTime }}</span>
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">timer</span> {{ place.estimatedDuration }}</span>
                      </div>
                    </div>

                    <button 
                      @click="addPlaceToItinerary(place, dayData.day, index)"
                      :disabled="addedPlaces.has(`${dayData.day}-${index}`)"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border"
                      :class="addedPlaces.has(`${dayData.day}-${index}`) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-primary border-primary/30 hover:bg-primary hover:text-white'"
                    >
                      <span class="material-symbols-outlined text-[16px]">{{ addedPlaces.has(`${dayData.day}-${index}`) ? 'check' : 'add' }}</span>
                      {{ addedPlaces.has(`${dayData.day}-${index}`) ? 'Added' : 'Add to itinerary' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tips Section -->
            <div v-if="itinerary.tips && itinerary.tips.length" class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-5">
              <h4 class="font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">lightbulb</span>
                Practical Tips
              </h4>
              <ul class="list-disc list-inside space-y-1 text-sm text-amber-900 dark:text-amber-200/80">
                <li v-for="(tip, index) in itinerary.tips" :key="index">{{ tip }}</li>
              </ul>
            </div>

            <!-- Actions -->
            <div class="flex justify-between items-center pt-4">
              <button @click="resetForm" class="text-gray-500 hover:text-primary text-sm font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">refresh</span> Try Again
              </button>
              <button @click="closeModal" class="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:opacity-90">
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
import { ref, reactive, watch } from 'vue';
import api from '../api';
import { usePlacesStore } from '../stores/places';
import { useToastStore } from '../stores/toast';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  tripId: { type: String, required: true }
});

const emit = defineEmits(['update:isOpen']);

const placesStore = usePlacesStore();
const toastStore = useToastStore();

const loading = ref(false);
const itinerary = ref(null);
const addedPlaces = ref(new Set());

const form = reactive({
  budget: 'moderate',
  interests: ''
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    resetForm();
  }
});

const resetForm = () => {
  form.budget = 'moderate';
  form.interests = '';
  itinerary.value = null;
  addedPlaces.value = new Set();
  loading.value = false;
};

const closeModal = () => {
  emit('update:isOpen', false);
};

const generatePlan = async () => {
  loading.value = true;
  itinerary.value = null;
  addedPlaces.value = new Set();

  try {
    const res = await api.post(`/trips/${props.tripId}/ai-suggestions`, {
      budget: form.budget,
      interests: form.interests
    });
    
    if (res.data.suggestions && res.data.suggestions.error) {
      toastStore.showToast(res.data.suggestions.error, 'error');
    } else {
      itinerary.value = res.data.suggestions;
      toastStore.showToast('Itinerary generated successfully!', 'success');
    }
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to generate plan.', 'error');
  } finally {
    loading.value = false;
  }
};

const addPlaceToItinerary = async (place, dayNumber, index) => {
  const key = `${dayNumber}-${index}`;
  if (addedPlaces.value.has(key)) return;

  try {
    await placesStore.addPlace(props.tripId, {
      name: place.name,
      address: place.name, // The AI might not return a full address, using name as fallback
      lat: 0, // Fallbacks, a proper geocoding should happen or map will handle it
      lng: 0,
      dayNumber: dayNumber,
      orderIndex: index,
      note: place.description || ''
    });
    addedPlaces.value = new Set([...addedPlaces.value, key]);
    toastStore.showToast(`"${place.name}" added to itinerary.`, 'success');
  } catch (err) {
    toastStore.showToast(`Failed to add "${place.name}".`, 'error');
  }
};
</script>

<style scoped>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}
</style>
