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
        class="relative bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] w-[92%] sm:w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="relative h-32 w-full bg-[#141512]">
          <img alt="Trip Planning" class="w-full h-full object-cover dark:brightness-75" src="https://images.unsplash.com/photo-1504280741564-9694ce213903?auto=format&fit=crop&q=80&w=1000" />
          <div class="absolute inset-0 bg-gradient-to-t from-[#111210]/90 via-[#111210]/40 to-transparent flex flex-col justify-end p-6">
            <h2 class="text-xl sm:text-2xl font-extrabold text-white">Create New Trip</h2>
            <p class="text-xs text-[#D5D3CA] mt-0.5">Start your next collaborative adventure</p>
          </div>
          <button 
            @click="closeModal" 
            class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors bg-black/40 rounded-full p-1 border border-white/10"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="submitForm" class="p-6 sm:p-8 space-y-5">
          <div v-if="error" class="bg-[#C77F78]/10 text-[#C77F78] border border-[#C77F78]/30 p-3.5 rounded-xl text-sm mb-2">
            {{ error }}
          </div>

          <!-- Trip Name -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]" for="trip-name">
                Trip Name <span class="text-[#C77F78]">*</span>
            </label>
            <input 
              v-model="form.name" 
              class="w-full px-4 py-3 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] transition-all text-sm outline-none" 
              id="trip-name" 
              placeholder="e.g., European Summer" 
              required 
              type="text"
            />
          </div>

          <!-- Destination -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]" for="destination">
                Destination <span class="text-[#C77F78]">*</span>
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-[18px]" data-icon="location_on">location_on</span>
              <input 
                v-model="form.destination" 
                class="w-full pl-11 pr-4 py-3 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] transition-all text-sm outline-none" 
                id="destination" 
                placeholder="e.g., Paris, France" 
                required 
                type="text"
              />
            </div>
          </div>

          <!-- Dates Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]" for="start-date">
                  Start Date <span class="text-[#C77F78]">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-[18px]" data-icon="calendar_today">calendar_today</span>
                <input 
                  v-model="form.startDate" 
                  class="w-full pl-11 pr-4 py-3 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] transition-all text-sm outline-none" 
                  id="start-date" 
                  required 
                  type="date"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]" for="end-date">
                  End Date <span class="text-[#C77F78]">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8075] dark:text-[#85867C] text-[18px]" data-icon="event">event</span>
                <input 
                  v-model="form.endDate" 
                  class="w-full pl-11 pr-4 py-3 bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] transition-all text-sm outline-none" 
                  id="end-date" 
                  required 
                  type="date"
                />
              </div>
            </div>
          </div>
          
          <div v-if="validationError" class="text-[#C77F78] text-xs font-medium mt-1">
            {{ validationError }}
          </div>

          <!-- Actions -->
          <div class="pt-5 border-t border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row-reverse items-center gap-3 mt-6">
            <button 
              :disabled="loading" 
              class="w-full sm:w-auto px-6 py-2.5 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-sm border border-[#A7A99A]/40 disabled:opacity-70 flex items-center justify-center min-w-[120px]" 
              type="submit"
            >
              <span v-if="loading" class="animate-spin h-3.5 w-3.5 border-2 border-[#171813] border-t-transparent rounded-full mr-2"></span>
              {{ loading ? 'Creating...' : 'Create Trip' }}
            </button>
            <button 
              @click="closeModal" 
              class="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#A5A69B] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] rounded-xl text-xs font-semibold transition-all active:scale-95" 
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import api from '../api';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  initialDestination: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:isOpen', 'trip-created']);

const loading = ref(false);
const error = ref('');
const validationError = ref('');

const form = reactive({
  name: '',
  destination: '',
  startDate: '',
  endDate: ''
});

// Reset form when opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.name = props.initialDestination ? `Trip to ${props.initialDestination}` : '';
    form.destination = props.initialDestination || '';
    form.startDate = '';
    form.endDate = '';
    error.value = '';
    validationError.value = '';
  }
});

const closeModal = () => {
  emit('update:isOpen', false);
};

const submitForm = async () => {
  error.value = '';
  validationError.value = '';

  if (!form.name || !form.destination || !form.startDate || !form.endDate) {
    validationError.value = 'Please fill out all required fields.';
    return;
  }
  
  if (new Date(form.endDate) < new Date(form.startDate)) {
    validationError.value = 'End date cannot be before start date.';
    return;
  }

  try {
    loading.value = true;
    const res = await api.post('/trips', form);
    emit('trip-created', res.data);
    closeModal();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to create trip. Please try again.';
  } finally {
    loading.value = false;
  }
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
</style>
