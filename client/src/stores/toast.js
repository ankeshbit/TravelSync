import { defineStore } from 'pinia'
import { ref } from 'vue'

let toastId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = toastId++
    const toast = { id, message, type }
    
    toasts.value.push(toast)
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    
    return id
  }

  const removeToast = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const clearAll = () => {
    toasts.value = []
  }

  return {
    toasts,
    showToast,
    removeToast,
    clearAll
  }
})
