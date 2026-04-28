<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">
        <h2 class="text-xl font-bold text-on-surface">Add Expense</h2>
        <button
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- Title Input -->
        <div>
          <label class="block text-sm font-semibold text-on-surface mb-2">
            Title <span class="text-error">*</span>
          </label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g., Dinner at restaurant"
            class="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          />
          <p v-if="errors.title" class="text-xs text-error mt-1">{{ errors.title }}</p>
        </div>

        <!-- Amount Input -->
        <div>
          <label class="block text-sm font-semibold text-on-surface mb-2">
            Amount <span class="text-error">*</span>
          </label>
          <input
            v-model.number="form.amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          />
          <p v-if="errors.amount" class="text-xs text-error mt-1">{{ errors.amount }}</p>
        </div>

        <!-- Currency Selector -->
        <div>
          <label class="block text-sm font-semibold text-on-surface mb-2">Currency</label>
          <select
            v-model="form.currency"
            class="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>

        <!-- Paid By Dropdown -->
        <div>
          <label class="block text-sm font-semibold text-on-surface mb-2">
            Paid By <span class="text-error">*</span>
          </label>
          <select
            v-model="form.paidBy"
            class="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all dark:bg-slate-800 dark:border-slate-600 dark:text-white"
          >
            <option value="">Select a member...</option>
            <option v-for="member in allMembers" :key="member._id" :value="member._id">
              {{ member.name }}
            </option>
          </select>
          <p v-if="errors.paidBy" class="text-xs text-error mt-1">{{ errors.paidBy }}</p>
        </div>

        <!-- Split Among Checkboxes -->
        <div>
          <label class="block text-sm font-semibold text-on-surface mb-3">
            Split Among <span class="text-error">*</span>
          </label>
          <div class="space-y-2 max-h-[200px] overflow-y-auto">
            <label v-for="member in allMembers" :key="member._id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer">
              <input
                type="checkbox"
                :value="member._id"
                v-model="form.splitAmong"
                class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-on-surface truncate">{{ member.name }}</p>
                <p class="text-xs text-outline-variant truncate">{{ member.email }}</p>
              </div>
            </label>
          </div>
          <p v-if="errors.splitAmong" class="text-xs text-error mt-2">{{ errors.splitAmong }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="errors.general || props.error" class="bg-error-container text-on-error-container text-xs p-3 rounded-lg">
          {{ errors.general || props.error }}
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 mt-6 flex items-center justify-center gap-2"
        >
          <span v-if="!loading">Add Expense</span>
          <span v-if="loading" class="material-symbols-outlined animate-spin">hourglass_bottom</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  members: {
    type: Array,
    required: true
  },
  tripOwner: {
    type: Object,
    required: true
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'submit'])

const form = ref({
  title: '',
  amount: null,
  currency: 'INR',
  paidBy: '',
  splitAmong: []
})

const errors = ref({
  title: '',
  amount: '',
  paidBy: '',
  splitAmong: '',
  general: ''
})

const loading = ref(false)

const allMembers = computed(() => {
  // Include owner and all members
  const members = [props.tripOwner, ...props.members]
  return members
})

const closeModal = () => {
  resetForm()
  emit('close')
}

const resetForm = () => {
  form.value = {
    title: '',
    amount: null,
    currency: 'INR',
    paidBy: '',
    splitAmong: allMembers.value.map(m => m._id) // Default all members
  }
  errors.value = {
    title: '',
    amount: '',
    paidBy: '',
    splitAmong: '',
    general: ''
  }
}

const validateForm = () => {
  errors.value = {
    title: '',
    amount: '',
    paidBy: '',
    splitAmong: '',
    general: ''
  }

  if (!form.value.title || form.value.title.trim() === '') {
    errors.value.title = 'Title is required'
  }

  if (form.value.amount === null || form.value.amount === '' || form.value.amount <= 0) {
    errors.value.amount = 'Amount must be greater than 0'
  }

  if (!form.value.paidBy) {
    errors.value.paidBy = 'Please select who paid'
  }

  if (!form.value.splitAmong || form.value.splitAmong.length === 0) {
    errors.value.splitAmong = 'Select at least one member to split with'
  }

  return Object.values(errors.value).every(e => e === '')
}

const handleSubmit = () => {
  if (!validateForm()) {
    return
  }

  loading.value = true
  emit('submit', {
    title: form.value.title.trim(),
    amount: form.value.amount,
    currency: form.value.currency,
    paidBy: form.value.paidBy,
    splitAmong: form.value.splitAmong
  })
}

// Initialize with all members selected by default when modal opens
const initializeForm = () => {
  form.value.splitAmong = allMembers.value.map(m => m._id)
}

// Watcher to initialize form when modal opens
import { watch } from 'vue'
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    initializeForm()
  } else {
    // Reset loading and form when modal closes
    loading.value = false
    resetForm()
  }
})
</script>
