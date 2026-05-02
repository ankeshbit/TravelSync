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
        class="relative bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-fade-in-up"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="relative h-32 w-full bg-primary-container">
          <img alt="Trip Planning" class="w-full h-full object-cover mix-blend-overlay" src="https://images.unsplash.com/photo-1504280741564-9694ce213903?auto=format&fit=crop&q=80&w=1000" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
            <h2 class="font-h2 text-h2 text-white">Create New Trip</h2>
            <p class="font-body-md text-body-md text-white/80">Start your next collaborative adventure</p>
          </div>
          <button 
            @click="closeModal" 
            class="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors bg-black/20 rounded-full p-1"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="submitForm" class="p-6 space-y-5">
          <div v-if="error" class="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-2">
            {{ error }}
          </div>

          <!-- Trip Name -->
          <div class="space-y-1.5">
            <label class="block font-label-sm text-label-sm text-on-surface" for="trip-name">
                Trip Name <span class="text-error">*</span>
            </label>
            <input 
              v-model="form.name" 
              class="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none" 
              id="trip-name" 
              placeholder="e.g., European Summer" 
              required 
              type="text"
            />
          </div>

          <!-- Destination -->
          <div class="space-y-1.5">
            <label class="block font-label-sm text-label-sm text-on-surface" for="destination">
                Destination <span class="text-error">*</span>
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="location_on">location_on</span>
              <input 
                v-model="form.destination" 
                class="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none" 
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
              <label class="block font-label-sm text-label-sm text-on-surface" for="start-date">
                  Start Date <span class="text-error">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="calendar_today">calendar_today</span>
                <input 
                  v-model="form.startDate" 
                  class="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none" 
                  id="start-date" 
                  required 
                  type="date"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="block font-label-sm text-label-sm text-on-surface" for="end-date">
                  End Date <span class="text-error">*</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="event">event</span>
                <input 
                  v-model="form.endDate" 
                  class="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md outline-none" 
                  id="end-date" 
                  required 
                  type="date"
                />
              </div>
            </div>
          </div>
          
          <div v-if="validationError" class="text-error text-sm font-medium mt-1">
            {{ validationError }}
          </div>

          <!-- Actions -->
          <div class="pt-4 border-t border-outline-variant flex flex-col sm:flex-row-reverse items-center gap-3 mt-6">
            <button 
              :disabled="loading" 
              class="w-full sm:w-auto px-6 py-2.5 bg-primary-container text-on-secondary rounded-lg font-h3 text-h3 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[120px]" 
              type="submit"
            >
              <span v-if="loading" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
              {{ loading ? 'Creating...' : 'Create Trip' }}
            </button>
            <button 
              @click="closeModal" 
              class="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant rounded-lg font-h3 text-h3 hover:bg-surface-variant transition-all active:scale-95" 
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
    form.name = '';
    form.destination = '';
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
