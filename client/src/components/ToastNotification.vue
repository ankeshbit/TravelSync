<template>
  <div v-if="visibleToasts.length > 0" class="fixed top-6 right-6 z-[9999] space-y-2">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in visibleToasts"
        :key="toast.id"
        :class="[
          'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium min-w-[300px] animate-in fade-in slide-in-from-top-4',
          toast.type === 'success' && 'bg-green-100 text-green-900 border border-green-300',
          toast.type === 'error' && 'bg-red-100 text-red-900 border border-red-300',
          toast.type === 'info' && 'bg-blue-100 text-blue-900 border border-blue-300'
        ]"
      >
        <span class="material-symbols-outlined text-lg">
          {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info' }}
        </span>
        <span>{{ toast.message }}</span>
        <button @click="removeToast(toast.id)" class="ml-auto text-opacity-60 hover:text-opacity-100">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useToastStore } from '../stores/toast';

const toastStore = useToastStore();

const visibleToasts = computed(() => toastStore.toasts);

const removeToast = (id) => {
  toastStore.removeToast(id);
};
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
