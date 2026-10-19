<template>
  <div class="bg-[#080D1A] min-h-screen text-slate-100 flex flex-col font-sans selection:bg-blue-500/30">
    <Navbar />

    <div class="flex flex-1">
      <Sidebar />

      <!-- Main Canvas -->
      <main class="flex-1 md:ml-64 p-5 md:p-8 pb-20 max-w-7xl">
        <!-- Top Header Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Expenses</h1>
            <p class="text-xs md:text-sm text-slate-400 mt-1">Track and split expenses for this trip.</p>
          </div>

          <div class="flex items-center gap-3">
            <TripPresence :activeMembers="activeMembers" />

            <button
              @click="openSettleUpModal"
              class="px-4 py-2.5 rounded-xl bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[16px] text-blue-400">handshake</span>
              Settle Up
            </button>

            <button
              @click="() => { error = ''; showAddExpenseModal = true }"
              class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              Add Expense
            </button>
          </div>
        </div>

        <!-- Full page load error with Retry -->
        <div v-if="loadError" class="p-8 text-center bg-[#0D1527] border border-red-500/30 rounded-2xl mb-6">
          <span class="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
          <p class="text-sm font-semibold text-white">{{ loadError }}</p>
          <button @click="loadAllData" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl">
            Retry
          </button>
        </div>

        <!-- Currency Selector / Tabs -->
        <div v-if="availableCurrencies.length > 0" class="flex items-center gap-2 mb-6">
          <span class="text-xs font-semibold text-slate-400">Currency:</span>
          <div class="flex items-center bg-[#090F1E] border border-[#16233F] rounded-xl p-1 gap-1">
            <button
              v-for="curr in availableCurrencies"
              :key="curr"
              type="button"
              :data-test="`currency-tab-${curr}`"
              @click="selectedCurrency = curr"
              :class="[
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                selectedCurrency === curr
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14203A]'
              ]"
            >
              {{ curr }}
            </button>
          </div>
        </div>

        <!-- 4 Stat Cards Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Expenses -->
          <div class="bg-[#0D1527] border border-[#16233F] rounded-2xl p-4 flex items-center gap-3.5 hover:border-slate-700/60 transition-all">
            <div class="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-slate-400">Total Expenses</p>
              <p class="text-xl font-bold text-white tracking-tight mt-0.5">
                {{ formatCurrency(computedTotalExpenses, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- Your Share -->
          <div class="bg-[#0D1527] border border-[#16233F] rounded-2xl p-4 flex items-center gap-3.5 hover:border-slate-700/60 transition-all">
            <div class="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">pie_chart</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-slate-400">Your Share</p>
              <p class="text-xl font-bold text-white tracking-tight mt-0.5">
                {{ formatCurrency(computedYourShare, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- You Owe -->
          <div class="bg-[#0D1527] border border-[#16233F] rounded-2xl p-4 flex items-center gap-3.5 hover:border-slate-700/60 transition-all">
            <div class="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">arrow_downward</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-slate-400">You Owe</p>
              <p class="text-xl font-bold text-red-400 tracking-tight mt-0.5">
                {{ formatCurrency(computedYouOwe, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- You Are Owed -->
          <div class="bg-[#0D1527] border border-[#16233F] rounded-2xl p-4 flex items-center gap-3.5 hover:border-slate-700/60 transition-all">
            <div class="w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">arrow_upward</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-slate-400">You Are Owed</p>
              <p class="text-xl font-bold text-green-400 tracking-tight mt-0.5">
                {{ formatCurrency(computedYouAreOwed, currentTripCurrency) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Notification -->
        <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-3 rounded-xl mb-6 flex items-center justify-between">
          <span>{{ error }}</span>
          <button @click="error = ''" class="text-slate-400 hover:text-white">✕</button>
        </div>

        <!-- 2-Column Split: Expenses Log & Who Owes What -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column: Expenses Log (7 cols) -->
          <div class="lg:col-span-8 bg-[#0D1527] border border-[#16233F] rounded-2xl p-5 md:p-6 shadow-xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-bold text-white tracking-tight">Expenses Log</h2>
              <span class="text-xs text-slate-400">{{ displayExpenses.length }} transactions</span>
            </div>

            <!-- Table (Desktop & Tablet) -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-[#1A2644] text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th class="py-3 px-3">Description</th>
                    <th class="py-3 px-3">Date</th>
                    <th class="py-3 px-3">Paid By</th>
                    <th class="py-3 px-3 text-right">Amount</th>
                    <th class="py-3 px-3 text-center">Split Among</th>
                    <th class="py-3 px-3 text-right">Your Share</th>
                    <th class="py-3 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#16233F]/70">
                  <tr v-if="displayExpenses.length === 0">
                    <td colspan="7" class="py-12 text-center text-slate-400">
                      <div class="flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-4xl text-slate-500 mb-2">receipt_long</span>
                        <p class="text-sm font-medium text-slate-300">No expenses recorded yet</p>
                        <p class="text-xs text-slate-500 mt-1">Click "Add Expense" to track shared trip costs.</p>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-for="(item, idx) in displayExpenses"
                    :key="item.id || item._id || idx"
                    class="hover:bg-[#111C33]/50 transition-colors group"
                  >
                    <!-- Description -->
                    <td class="py-3.5 px-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-lg bg-[#14203A] border border-[#1E2E4E] flex items-center justify-center text-blue-400 flex-shrink-0">
                          <span class="material-symbols-outlined text-[15px]">{{ getCategoryIcon(item.title) }}</span>
                        </div>
                        <span class="font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-[140px] md:max-w-[170px]">
                          {{ item.title }}
                        </span>
                      </div>
                    </td>

                    <!-- Date -->
                    <td class="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                      {{ formatDate(item.date || item.createdAt) }}
                    </td>

                    <!-- Paid By -->
                    <td class="py-3.5 px-3 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-blue-600/40 text-blue-300 font-semibold text-[10px] flex items-center justify-center border border-blue-400/30 flex-shrink-0">
                          {{ (item.paidByName || item.paidBy?.name || 'U').charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-slate-300 font-medium">{{ item.paidByName || item.paidBy?.name || 'Unknown' }}</span>
                      </div>
                    </td>

                    <!-- Amount -->
                    <td class="py-3.5 px-3 text-right font-semibold text-slate-100 whitespace-nowrap">
                      {{ formatCurrency(item.amount, item.currency || currentTripCurrency) }}
                    </td>

                    <!-- Split Among -->
                    <td class="py-3.5 px-3 text-center text-slate-400 whitespace-nowrap">
                      {{ item.splitText || `${(item.splitAmong?.length || 1)} ${(item.splitAmong?.length === 1 ? 'person' : 'people')}` }}
                    </td>

                    <!-- Your Share -->
                    <td class="py-3.5 px-3 text-right font-medium text-slate-300 whitespace-nowrap">
                      {{ formatCurrency(item.yourShare !== undefined ? item.yourShare : (item.amount / (item.splitAmong?.length || 1)), item.currency || currentTripCurrency) }}
                    </td>

                    <!-- Actions -->
                    <td class="py-3.5 px-2 text-center whitespace-nowrap">
                      <button
                        v-if="canDeleteExpense(item)"
                        @click="handleDeleteExpense(item.id || item._id)"
                        class="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete expense"
                      >
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                      <button
                        v-else
                        class="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <span class="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right Column: Who Owes What (4 cols) -->
          <div class="lg:col-span-4 bg-[#0D1527] border border-[#16233F] rounded-2xl p-5 md:p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-5">
                <h2 class="text-base font-bold text-white tracking-tight">Who Owes What</h2>
                <button
                  @click="refreshBalances"
                  class="text-slate-400 hover:text-blue-400 transition-colors"
                  title="Refresh balances"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                </button>
              </div>

              <!-- List of Debtors / Creditors -->
              <div v-if="displayOwesList.length === 0" class="text-center py-10">
                <span class="material-symbols-outlined text-3xl text-emerald-400/80 mb-2">check_circle</span>
                <p class="text-xs font-semibold text-slate-300">All settled up!</p>
                <p class="text-[11px] text-slate-500 mt-0.5">No outstanding balances among members.</p>
              </div>
              <div v-else class="space-y-3.5">
                <div
                  v-for="(debt, idx) in displayOwesList"
                  :key="debt.id || idx"
                  class="flex items-center justify-between p-3 rounded-xl bg-[#090F1E] border border-[#14203A] hover:border-[#1E2E4E] transition-all"
                >
                  <div class="flex items-center gap-3">
                    <img
                      v-if="debt.avatar"
                      :src="debt.avatar"
                      :alt="debt.name"
                      class="w-8 h-8 rounded-full object-cover border border-slate-700/60"
                      @error="e => e.target.style.display = 'none'"
                    />
                    <div v-else class="w-8 h-8 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-500/30">
                      {{ debt.name ? debt.name.charAt(0).toUpperCase() : 'U' }}
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-slate-200">
                        <span v-if="debt.type === 'owes_you'">{{ debt.name }} owes you</span>
                        <span v-else>You owe {{ debt.name }}</span>
                      </p>
                      <p v-if="debt.email" class="text-[10px] text-slate-500">{{ debt.email }}</p>
                    </div>
                  </div>

                  <span
                    :class="[
                      'text-xs font-bold px-2 py-0.5 rounded-lg border',
                      debt.type === 'owes_you'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : 'text-red-400 bg-red-500/10 border-red-500/20'
                    ]"
                  >
                    {{ formatCurrency(debt.amount, currentTripCurrency) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Settle / View Settlement Plan Button -->
            <button
              @click="openSettleUpModal"
              class="w-full mt-6 py-2.5 px-4 rounded-xl bg-[#111C33] hover:bg-[#162442] border border-[#1E2E4E] hover:border-blue-500/40 text-slate-200 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm group"
            >
              <span>View Settlement Plan</span>
              <span class="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform text-blue-400">arrow_forward</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- Add Expense Modal -->
    <AddExpenseModal
      :isOpen="showAddExpenseModal"
      :members="trip?.members || []"
      :tripOwner="trip?.owner || trip?.ownerId || {}"
      :trip="trip"
      :tripCurrency="currentTripCurrency"
      :error="error"
      @close="showAddExpenseModal = false"
      @submit="handleAddExpense"
    />

    <!-- Settle Up Modal -->
    <div
      v-if="showSettleModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-[#0D1527] border border-[#1E2E4E] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[#1A2644]">
          <h3 class="text-base font-bold text-white">Settlement Plan</h3>
          <button @click="showSettleModal = false" class="text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="py-4 space-y-3">
          <div
            v-for="(debt, idx) in displayOwesList"
            :key="idx"
            class="p-3 rounded-xl bg-[#090F1E] border border-[#14203A] flex items-center justify-between text-xs"
          >
            <div>
              <p class="font-semibold text-white">
                <span v-if="debt.type === 'owes_you'">{{ debt.name }} → You</span>
                <span v-else>You → {{ debt.name }}</span>
              </p>
              <p class="text-[11px] text-slate-400 mt-0.5">Amount: {{ formatCurrency(debt.amount, currentTripCurrency) }}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded bg-slate-800 text-slate-300">
              {{ formatCurrency(debt.amount, currentTripCurrency) }}
            </span>
          </div>
        </div>

        <button
          @click="showSettleModal = false"
          class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all mt-2"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useExpensesStore } from '../stores/expenses'
import { useAuthStore } from '../stores/auth'
import { useTripsStore } from '../stores/trips'
import Navbar from '../components/Navbar.vue'
import Sidebar from '../components/Sidebar.vue'
import TripPresence from '../components/TripPresence.vue'
import AddExpenseModal from '../components/AddExpenseModal.vue'
import { useSocket } from '../composables/useSocket'
import { formatCurrency } from '../utils/format'

const route = useRoute()
const expensesStore = useExpensesStore()
const authStore = useAuthStore()
const tripsStore = useTripsStore()

const trip = computed(() => tripsStore.currentTrip)
const loading = ref(true)
const balancesLoading = ref(false)
const error = ref('')
const loadError = ref(null)
const showAddExpenseModal = ref(false)
const showSettleModal = ref(false)

const { activeMembers } = useSocket(() => route.params.tripId)

const availableCurrencies = computed(() => {
  const currencies = new Set()
  const tripCurr = trip.value?.currency || expensesStore.currency
  if (tripCurr) {
    currencies.add(tripCurr.toUpperCase())
  }
  if (expensesStore.byCurrency) {
    Object.keys(expensesStore.byCurrency).forEach(c => currencies.add(c.toUpperCase()))
  }
  if (expensesStore.expenses) {
    expensesStore.expenses.forEach(e => {
      if (e.currency) currencies.add(e.currency.toUpperCase())
    })
  }
  if (currencies.size === 0) {
    currencies.add('USD')
  }
  return Array.from(currencies)
})

const selectedCurrency = ref('')

watchEffect(() => {
  const list = availableCurrencies.value
  const defaultCurr = (trip.value?.currency || expensesStore.currency || list[0] || 'USD').toUpperCase()
  if (!selectedCurrency.value || !list.includes(selectedCurrency.value)) {
    selectedCurrency.value = list.includes(defaultCurr) ? defaultCurr : (list[0] || 'USD')
  }
})

const currentTripCurrency = computed(() => {
  return selectedCurrency.value || trip.value?.currency || expensesStore.currency || 'USD'
})

const currentCurrencyData = computed(() => {
  const curr = currentTripCurrency.value
  return expensesStore.byCurrency?.[curr] || null
})

const displayExpenses = computed(() => {
  return expensesStore.expenses || []
})

const displayOwesList = computed(() => {
  const currentUserId = authStore.currentUser?.id || authStore.currentUser?._id
  const currData = currentCurrencyData.value
  const settlements = currData?.settlements || expensesStore.settlements || []
  return settlements.map((s, idx) => {
    const isYouOwe = s.from === currentUserId
    const partnerName = isYouOwe ? s.toName : s.fromName
    return {
      id: `${s.from}-${s.to}-${idx}`,
      name: partnerName || `Member ${idx + 1}`,
      email: '',
      avatar: null,
      type: isYouOwe ? 'you_owe' : 'owes_you',
      amount: s.amount
    }
  })
})

const computedTotalExpenses = computed(() => {
  const currData = currentCurrencyData.value
  if (currData && currData.totalExpenses !== undefined) {
    return currData.totalExpenses
  }
  const curr = currentTripCurrency.value
  return expensesStore.expenses
    .filter(e => (e.currency || trip.value?.currency || 'USD').toUpperCase() === curr.toUpperCase())
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
})

const computedYourShare = computed(() => {
  const currentUserId = authStore.currentUser?.id || authStore.currentUser?._id
  const curr = currentTripCurrency.value
  if (!currentUserId || !expensesStore.expenses?.length) return 0
  return expensesStore.expenses.reduce((sum, item) => {
    const itemCurrency = (item.currency || trip.value?.currency || 'USD').toUpperCase()
    if (itemCurrency !== curr.toUpperCase()) return sum
    const splits = Array.isArray(item.splitAmong)
      ? item.splitAmong
      : (Array.isArray(item.splits) ? item.splits.map(s => s.user?.id || s.userId || s) : [])
    if (splits.length === 0) {
      return sum
    }
    const isIncluded = splits.some(u => {
      const uId = typeof u === 'object' ? (u.id || u._id) : u
      return uId === currentUserId
    })
    if (isIncluded) {
      return sum + (Number(item.amount) || 0) / splits.length
    }
    return sum
  }, 0)
})

const computedYouOwe = computed(() => {
  const currentUserId = authStore.currentUser?.id || authStore.currentUser?._id
  const currData = currentCurrencyData.value
  const settlements = currData?.settlements || expensesStore.settlements || []
  if (!currentUserId || !settlements.length) return 0
  return settlements
    .filter(s => s.from === currentUserId)
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
})

const computedYouAreOwed = computed(() => {
  const currentUserId = authStore.currentUser?.id || authStore.currentUser?._id
  const currData = currentCurrencyData.value
  const settlements = currData?.settlements || expensesStore.settlements || []
  if (!currentUserId || !settlements.length) return 0
  return settlements
    .filter(s => s.to === currentUserId)
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
})

const getCategoryIcon = (title = '') => {
  const t = title.toLowerCase()
  if (t.includes('hotel') || t.includes('stay') || t.includes('lodging')) return 'hotel'
  if (t.includes('dinner') || t.includes('lunch') || t.includes('food') || t.includes('bistro')) return 'restaurant'
  if (t.includes('metro') || t.includes('train') || t.includes('bus') || t.includes('flight')) return 'train'
  if (t.includes('museum') || t.includes('ticket') || t.includes('entry')) return 'confirmation_number'
  return 'receipt'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const openSettleUpModal = () => {
  showSettleModal.value = true
}

const fetchTrip = async () => {
  if (route.params.tripId) {
    await tripsStore.fetchTrip(route.params.tripId)
  }
}

const fetchExpenses = async () => {
  if (route.params.tripId) {
    await expensesStore.fetchExpenses(route.params.tripId)
  }
}

const fetchBalances = async () => {
  if (route.params.tripId) {
    await expensesStore.fetchBalances(route.params.tripId)
  }
}

const refreshBalances = async () => {
  balancesLoading.value = true
  await fetchBalances().catch(() => {})
  balancesLoading.value = false
}

const loadAllData = async () => {
  loading.value = true
  loadError.value = null
  try {
    await fetchTrip()
    await Promise.all([
      fetchExpenses(),
      fetchBalances()
    ])
  } catch (err) {
    loadError.value = err.response?.data?.message || err.message || 'Failed to load expenses'
  } finally {
    loading.value = false
  }
}

const handleAddExpense = async (expenseData, onComplete) => {
  try {
    if (route.params.tripId) {
      await expensesStore.addExpense(route.params.tripId, expenseData)
      showAddExpenseModal.value = false
      error.value = ''
      try {
        await expensesStore.fetchBalances(route.params.tripId)
      } catch (balErr) {
        console.error('Failed to update balances after expense add:', balErr)
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to add expense'
  } finally {
    if (typeof onComplete === 'function') {
      onComplete()
    }
  }
}

const handleDeleteExpense = async (expenseId) => {
  if (!confirm('Are you sure you want to delete this expense?')) return
  try {
    if (route.params.tripId) {
      await expensesStore.deleteExpense(route.params.tripId, expenseId)
      await expensesStore.fetchBalances(route.params.tripId).catch(() => {})
    }
  } catch (err) {
    error.value = err.message || 'Failed to delete expense'
  }
}

const canDeleteExpense = (expense) => {
  if (!expense) return false
  const currentUserId = authStore.currentUser?.id || authStore.currentUser?._id
  if (!currentUserId) return false

  const isTripOwner = trip.value && (
    (trip.value.ownerId && trip.value.ownerId === currentUserId) ||
    (trip.value.owner?.id && trip.value.owner.id === currentUserId)
  )
  const paidById = typeof expense.paidBy === 'object'
    ? (expense.paidBy?.id || expense.paidBy?._id)
    : (expense.paidById || expense.paidBy)
  const isPayer = paidById === currentUserId

  return Boolean(isTripOwner || isPayer)
}

watch(() => route.params.tripId, (newId) => {
  if (newId) {
    expensesStore.resetExpenses()
    loadAllData()
  }
})

onMounted(() => {
  loadAllData()
})
</script>

