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
        class="relative bg-[#FAF9F5] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="relative h-20 w-full bg-[#F0EEE9] dark:bg-[#141512] border-b border-[#E3E0D8] dark:border-[#30312C] flex-shrink-0 flex items-center justify-between px-6">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[#A7A99A] text-2xl">auto_awesome</span>
            <div>
              <h2 class="font-h2 text-lg sm:text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">AI Trip Planner</h2>
              <p class="text-xs text-[#575851] dark:text-[#85867C]">Generate a customized, curated day-by-day travel itinerary</p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="text-[#575851] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors bg-[#E8E6DF] dark:bg-[#22231F] border border-[#D1CEC7] dark:border-[#30312C] rounded-lg p-1.5 flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto bg-[#F7F6F2] dark:bg-[#111210]">
          <!-- Form -->
          <div v-if="!itinerary && !loading" class="p-6 sm:p-8 space-y-6 bg-[#FFFFFF] dark:bg-[#1B1C19] m-6 rounded-2xl shadow-sm border border-[#E3E0D8] dark:border-[#30312C]">
            <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mb-4">Trip Preferences</h3>
            <div class="space-y-5">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-[#575851] dark:text-[#85867C] mb-2">Budget</label>
                <select v-model="form.budget" class="w-full px-4 py-2.5 border border-[#D1CEC7] dark:border-[#30312C] rounded-xl bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] focus:border-[#A7A99A] outline-none text-sm transition-colors">
                  <option value="economy">Economy</option>
                  <option value="moderate">Moderate</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-[#575851] dark:text-[#85867C] mb-2">Interests</label>
                <input 
                  type="text" 
                  v-model="form.interests" 
                  placeholder="e.g. food, culture, architecture, quiet cafes" 
                  class="w-full px-4 py-2.5 border border-[#D1CEC7] dark:border-[#30312C] rounded-xl bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] focus:border-[#A7A99A] outline-none text-sm transition-colors"
                />
              </div>

              <div v-if="errorMessage" class="p-3.5 bg-[#C77F78]/10 border border-[#C77F78]/30 rounded-xl text-[#C77F78] text-sm flex items-start gap-2">
                <span class="material-symbols-outlined text-[18px] text-[#C77F78] mt-0.5">error</span>
                <span>{{ errorMessage }}</span>
              </div>

              <div class="pt-4 flex justify-end gap-3 border-t border-[#E3E0D8] dark:border-[#30312C]">
                <button @click="closeModal" class="px-5 py-2.5 text-[#575851] dark:text-[#A5A69B] hover:bg-[#EFECE6] dark:hover:bg-[#292A25] rounded-xl text-sm font-semibold transition-colors">Cancel</button>
                <button @click="generatePlan" class="px-6 py-2.5 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>Generate Itinerary</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Loading Spinner -->
          <div v-if="loading" class="p-12 flex flex-col items-center justify-center space-y-4">
            <div class="animate-spin rounded-full h-12 w-12 border-3 border-[#A7A99A] border-t-transparent"></div>
            <p class="text-[#575851] dark:text-[#85867C] font-medium text-sm">Curating your customized itinerary...</p>
          </div>

          <!-- AI Response -->
          <div v-if="itinerary && !loading" class="p-6 space-y-6">
            <!-- Summary Banner -->
            <div class="bg-[#F0EEE9] dark:bg-[#22231F] border-l-4 border-[#A7A99A] p-4 rounded-r-xl border border-l-0 border-[#E3E0D8] dark:border-[#30312C]">
              <h3 class="text-[#1C1D1A] dark:text-[#D5D3CA] font-semibold text-sm mb-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-[#A7A99A] text-base">explore</span>
                Trip Overview
              </h3>
              <p class="text-[#575851] dark:text-[#A5A69B] text-sm leading-relaxed">{{ itinerary.summary }}</p>
            </div>

            <!-- Day-by-Day Accordion -->
            <div class="space-y-4">
              <div v-for="dayData in itinerary.days" :key="dayData.day" class="border border-[#E3E0D8] dark:border-[#30312C] rounded-xl overflow-hidden bg-[#FFFFFF] dark:bg-[#1B1C19] shadow-sm">
                
                <div class="bg-[#F7F6F2] dark:bg-[#22231F] px-4 py-3 flex justify-between items-center cursor-pointer border-b border-[#E3E0D8] dark:border-[#30312C]">
                  <div>
                    <h4 class="font-bold text-[#1C1D1A] dark:text-[#D5D3CA] text-sm">Day {{ dayData.day }}</h4>
                    <p class="text-xs text-[#575851] dark:text-[#85867C]">{{ dayData.theme }}</p>
                  </div>
                </div>

                <div class="p-4 space-y-4">
                  <div v-for="(place, index) in dayData.places" :key="index" class="flex gap-4 items-start p-3 rounded-xl border border-[#E3E0D8] dark:border-[#30312C] hover:bg-[#F7F6F2] dark:hover:bg-[#22231F] transition-colors">
                    
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <h5 class="font-bold text-[#1C1D1A] dark:text-[#D5D3CA] text-sm">{{ place.name }}</h5>
                        <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#A5A69B] border border-[#D1CEC7] dark:border-[#30312C]">{{ place.type }}</span>
                      </div>
                      <p class="text-xs text-[#575851] dark:text-[#A5A69B] mb-2 leading-relaxed">{{ place.description }}</p>
                      <div class="flex gap-4 text-xs text-[#85867C]">
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">schedule</span> {{ place.bestTime }}</span>
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">timer</span> {{ place.estimatedDuration }}</span>
                      </div>
                    </div>

                    <button 
                      @click="addPlaceToItinerary(place, dayData.day, index)"
                      :disabled="addedPlaces.has(`${dayData.day}-${index}`)"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                      :class="addedPlaces.has(`${dayData.day}-${index}`) ? 'bg-[#86A98B]/15 text-[#86A98B] border-[#86A98B]/30' : 'bg-transparent text-[#1C1D1A] dark:text-[#D5D3CA] border-[#D1CEC7] dark:border-[#30312C] hover:border-[#A7A99A] hover:text-[#A7A99A]'"
                    >
                      <span class="material-symbols-outlined text-[16px]">{{ addedPlaces.has(`${dayData.day}-${index}`) ? 'check' : 'add' }}</span>
                      {{ addedPlaces.has(`${dayData.day}-${index}`) ? 'Added' : 'Add to itinerary' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tips Section -->
            <div v-if="itinerary.tips && itinerary.tips.length" class="bg-[#C4A36B]/10 border border-[#C4A36B]/30 rounded-xl p-4">
              <h4 class="font-bold text-[#C4A36B] mb-2 text-xs flex items-center gap-2 uppercase tracking-wider">
                <span class="material-symbols-outlined text-sm">lightbulb</span>
                Practical Tips
              </h4>
              <ul class="list-disc list-inside space-y-1 text-xs text-[#85867C] dark:text-[#A5A69B]">
                <li v-for="(tip, index) in itinerary.tips" :key="index">{{ tip }}</li>
              </ul>
            </div>

            <!-- Actions -->
            <div class="flex justify-between items-center pt-4 border-t border-[#E3E0D8] dark:border-[#30312C]">
              <button @click="resetForm" class="text-[#575851] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] text-xs font-semibold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">refresh</span> Try Again
              </button>
              <button @click="onDone" class="px-6 py-2 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] font-semibold rounded-lg text-xs transition-colors">
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
  tripId: { type: String, required: true },
  destination: { type: String, default: '' },
  duration: { type: [Number, String], default: 3 }
});

const emit = defineEmits(['update:isOpen', 'itinerary-generated']);

const placesStore = usePlacesStore();
const toastStore = useToastStore();

const loading = ref(false);
const itinerary = ref(null);
const errorMessage = ref('');
const addedPlaces = ref(new Set());
const addedPlacesList = ref([]);

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
  errorMessage.value = '';
  addedPlaces.value = new Set();
  addedPlacesList.value = [];
  loading.value = false;
};

const closeModal = () => {
  emit('update:isOpen', false);
};

const onDone = () => {
  emit('itinerary-generated', addedPlacesList.value);
  closeModal();
};

const generatePlan = async () => {
  loading.value = true;
  itinerary.value = null;
  errorMessage.value = '';
  addedPlaces.value = new Set();
  addedPlacesList.value = [];

  try {
    const res = await api.post(`/trips/${props.tripId}/ai-suggestions`, {
      budget: form.budget,
      interests: form.interests
    });
    
    if (res.data.suggestions && res.data.suggestions.error) {
      errorMessage.value = res.data.suggestions.error;
      toastStore.showToast(res.data.suggestions.error, 'error');
    } else {
      itinerary.value = res.data.suggestions;
      toastStore.showToast('Itinerary generated successfully!', 'success');
    }
  } catch (err) {
    const is502 = err.response?.status === 502;
    const msg = is502
      ? (err.response?.data?.message || 'AI service is temporarily unavailable (502). Please try again later.')
      : (err.response?.data?.message || 'Failed to generate plan.');
    errorMessage.value = msg;
    if (!is502) {
      toastStore.showToast(msg, 'error');
    }
  } finally {
    loading.value = false;
  }
};

const addPlaceToItinerary = async (place, dayNumber, index) => {
  const key = `${dayNumber}-${index}`;
  if (addedPlaces.value.has(key)) return;

  if (place.lat == null || place.lng == null || isNaN(Number(place.lat)) || isNaN(Number(place.lng))) {
    toastStore.showToast(`Skipping "${place.name || 'place'}" without valid coordinates`, 'warning');
    return;
  }

  try {
    await placesStore.fetchPlaces(props.tripId);
    const placesOnDay = (placesStore.places || []).filter(p => Number(p.dayNumber) === Number(dayNumber));
    const nextOrderIndex = placesOnDay.length > 0
      ? Math.max(...placesOnDay.map(p => Number(p.orderIndex ?? 0))) + 1
      : 0;

    const added = await placesStore.addPlace(props.tripId, {
      name: place.name,
      address: place.address || place.name,
      lat: Number(place.lat),
      lng: Number(place.lng),
      dayNumber: Number(dayNumber),
      orderIndex: nextOrderIndex,
      category: place.type || 'attraction',
      note: place.description || ''
    });
    addedPlaces.value = new Set([...addedPlaces.value, key]);
    addedPlacesList.value.push(added || {
      name: place.name,
      address: place.address || place.name,
      lat: Number(place.lat),
      lng: Number(place.lng),
      dayNumber: Number(dayNumber),
      orderIndex: nextOrderIndex,
      category: place.type || 'attraction',
      note: place.description || ''
    });
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
