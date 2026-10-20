<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="sticky top-0 flex items-center justify-between p-6 border-b border-[#E3E0D8] dark:border-[#30312C] bg-[#FFFFFF] dark:bg-[#1B1C19] z-10">
        <h2 class="text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Add Expense</h2>
        <button
          @click="closeModal"
          class="text-gray-400 text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 sm:p-8 space-y-5">
        <!-- Title Input -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">
            Title <span class="text-[#C77F78]">*</span>
          </label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g., Dinner at restaurant"
            class="w-full px-4 py-2.5 sm:py-3 border border-[#E3E0D8] dark:border-[#30312C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] outline-none transition-all bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] text-sm"
          />
          <p v-if="errors.title" class="text-xs text-[#C77F78] mt-1.5">{{ errors.title }}</p>
        </div>

        <!-- Amount Input -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">
            Amount <span class="text-[#C77F78]">*</span>
          </label>
          <input
            v-model.number="form.amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-full px-4 py-2.5 sm:py-3 border border-[#E3E0D8] dark:border-[#30312C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] outline-none transition-all bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] text-sm"
          />
          <p v-if="errors.amount" class="text-xs text-[#C77F78] mt-1.5">{{ errors.amount }}</p>
        </div>

        <!-- Currency Selector -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">Currency</label>
          <select
            v-model="form.currency"
            class="w-full px-4 py-2.5 sm:py-3 border border-[#E3E0D8] dark:border-[#30312C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] outline-none transition-all bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] text-sm"
          >
            <option v-for="c in currencyOptions" :key="c.code" :value="c.code">
              {{ c.label }}
            </option>
          </select>
        </div>

        <!-- Paid By Dropdown -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">
            Paid By <span class="text-[#C77F78]">*</span>
          </label>
          <select
            v-model="form.paidBy"
            class="w-full px-4 py-2.5 sm:py-3 border border-[#E3E0D8] dark:border-[#30312C] rounded-xl focus:ring-1 focus:ring-[#A7A99A]/30 focus:border-[#A7A99A] outline-none transition-all bg-[#F7F6F2] dark:bg-[#141512] text-[#1C1D1A] dark:text-[#D5D3CA] text-sm"
          >
            <option value="">Select a member...</option>
            <option v-for="member in allMembers" :key="member.id" :value="member.id">
              {{ member.name }}
            </option>
          </select>
          <p v-if="errors.paidBy" class="text-xs text-[#C77F78] mt-1.5">{{ errors.paidBy }}</p>
        </div>

        <!-- Split Among Checkboxes -->
        <div>
          <label class="block text-xs sm:text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2.5">
            Split Among <span class="text-[#C77F78]">*</span>
          </label>
          <div class="space-y-2 max-h-[200px] overflow-y-auto">
            <label v-for="member in allMembers" :key="member.id" class="flex items-center gap-3.5 p-3 rounded-xl hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] transition-colors cursor-pointer border border-transparent hover:border-[#E3E0D8] dark:hover:border-[#30312C]">
              <input
                type="checkbox"
                :value="member.id"
                v-model="form.splitAmong"
                class="w-4 h-4 rounded border-[#E3E0D8] dark:border-[#30312C] text-[#A7A99A] focus:ring-[#A7A99A] cursor-pointer bg-[#FFFFFF] dark:bg-[#141512]"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ member.name }}</p>
                <p class="text-xs text-[#575851] dark:text-[#A5A69B] truncate">{{ member.email }}</p>
              </div>
            </label>
          </div>
          <p v-if="errors.splitAmong" class="text-xs text-[#C77F78] mt-2">{{ errors.splitAmong }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="errors.general || props.error" class="bg-[#C77F78]/10 border border-[#C77F78]/30 text-[#C77F78] text-xs p-3.5 rounded-xl">
          {{ errors.general || props.error }}
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-sm border border-[#A7A99A]/40 active:scale-95 disabled:opacity-50 mt-6 flex items-center justify-center gap-2"
        >
          <span v-if="!loading">Add Expense</span>
          <span v-if="loading" class="material-symbols-outlined animate-spin text-[18px]">hourglass_bottom</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { CURRENCY_OPTIONS } from '../constants'

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
  trip: {
    type: Object,
    default: () => ({})
  },
  tripCurrency: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'submit'])

const resolvedTripCurrency = computed(() => {
  return props.currency || props.tripCurrency || props.trip?.currency || 'USD'
})

const currencyOptions = computed(() => {
  const options = [...CURRENCY_OPTIONS]
  const current = resolvedTripCurrency.value
  if (current && !options.some(o => o.code === current)) {
    options.unshift({ code: current, label: current })
  }
  return options
})

const form = ref({
  title: '',
  amount: null,
  currency: resolvedTripCurrency.value,
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
  // Include owner and all members, ensuring no duplicates by id
  const membersMap = new Map()
  const owner = props.tripOwner
  const ownerId = owner?.id || owner?._id
  if (owner && ownerId) {
    membersMap.set(String(ownerId), { ...owner, id: String(ownerId), _id: String(ownerId) })
  }
  props.members.forEach(m => {
    const userObj = m?.user || m
    const mId = userObj?.id || userObj?._id
    if (userObj && mId) {
      membersMap.set(String(mId), { ...userObj, id: String(mId), _id: String(mId) })
    }
  })
  return Array.from(membersMap.values())
})


const closeModal = () => {
  resetForm()
  emit('close')
}

const resetForm = () => {
  loading.value = false
  form.value = {
    title: '',
    amount: null,
    currency: resolvedTripCurrency.value,
    paidBy: '',
    splitAmong: allMembers.value.map(m => m.id) // Default all members
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
  form.value.splitAmong = allMembers.value.map(m => m.id)
}

// Watcher to initialize form when modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value.currency = resolvedTripCurrency.value
    initializeForm()
  } else {
    // Reset loading and form when modal closes
    loading.value = false
    resetForm()
  }
}, { immediate: true })

// Watch for errors to stop loading spinner
watch(() => props.error, (newVal) => {
  if (newVal) {
    loading.value = false
  }
})
</script>
