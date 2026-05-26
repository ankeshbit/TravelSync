<template>
  <div class="bg-background dark:bg-slate-950 text-on-surface dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-200">
    <Navbar />

    <div class="flex flex-1 mt-[64px]">
      <Sidebar />

      <!-- Main Content Canvas -->
      <main class="flex-1 md:ml-16 lg:ml-64 p-4 md:p-6 pb-20 transition-all duration-300">
        <!-- Page Header -->
        <section v-if="!loading && trip" class="mb-lg">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-on-surface dark:text-slate-100">{{ trip.name }} - Expenses</h1>
              <p class="text-outline-variant dark:text-slate-400 mt-1">Track and split expenses for this trip</p>
            </div>
            <div class="flex items-center gap-4">
              <TripPresence :activeMembers="activeMembers" />
              <button
                @click="() => { error = ''; showAddExpenseModal = true }"
                class="bg-primary text-on-primary px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity self-start md:self-auto"
              >
                <span class="material-symbols-outlined">add</span>
                Add Expense
              </button>
            </div>
          </div>
        </section>

        <!-- Loading State -->
        <div v-if="loading" class="space-y-4 animate-pulse">
          <!-- Balance Skeletons -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div v-for="n in 4" :key="'bal-'+n" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 h-[110px] space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-800"></div>
                <div class="h-4 w-24 bg-gray-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div class="h-3 w-16 bg-gray-250 dark:bg-slate-850 rounded"></div>
            </div>
          </div>

          <!-- Table Rows Skeletons -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 space-y-6">
            <div v-for="n in 4" :key="'row-'+n" class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800/50 pb-4">
              <div class="flex-1 space-y-3">
                <div class="h-5 w-1/3 bg-gray-200 dark:bg-slate-800 rounded"></div>
                <div class="h-4 w-1/4 bg-gray-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div class="h-10 w-24 bg-gray-200 dark:bg-slate-800 rounded"></div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="bg-error-container text-on-error-container p-4 rounded-lg text-center font-semibold my-8">
          {{ error }}
        </div>

        <!-- Main Grid Layout -->
        <div v-if="!loading && trip" class="space-y-6">
          
          <!-- Balance Cards Responsive Grid (1 col mobile, 2 tablet, 4 desktop) -->
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-2xl">account_balance</span>
                Who Owes What
              </h2>
              <button
                @click="refreshBalances"
                :disabled="balancesLoading"
                class="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1 active:scale-95 duration-100"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
            </div>

            <div v-if="expensesStore.membersWithBalance.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                v-for="member in expensesStore.membersWithBalance"
                :key="member._id"
                class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-850 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-900 dark:text-blue-300 flex-shrink-0">
                    {{ member.name.substring(0, 1).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-on-surface dark:text-slate-100 truncate">{{ member.name }}</p>
                    <p class="text-[11px] text-outline-variant dark:text-slate-500 truncate">{{ member.email }}</p>
                  </div>
                </div>
                <div class="mt-4 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/80 pt-2">
                  <span class="text-[11px] font-bold text-outline-variant uppercase tracking-wider">
                    <span v-if="member.balance > 0.01">is owed</span>
                    <span v-else-if="member.balance < -0.01">owes</span>
                    <span v-else>all set</span>
                  </span>
                  <p
                    :class="[
                      'text-sm font-extrabold',
                      member.balance > 0.01
                        ? 'text-green-600 dark:text-green-400'
                        : member.balance < -0.01
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    ]"
                  >
                    <span v-if="member.balance > 0.01">+₹{{ Math.abs(member.balance).toFixed(2) }}</span>
                    <span v-else-if="member.balance < -0.01">-₹{{ Math.abs(member.balance).toFixed(2) }}</span>
                    <span v-else>Settled</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Empty State for Balances -->
            <div v-else class="p-6 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-outline-variant text-sm">
              No expenses to calculate balances
            </div>
          </section>

          <!-- Expenses and Settlements Columns -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Expense List Section (left - 2 cols on lg) -->
            <section class="lg:col-span-2">
              <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <!-- Section Header -->
                <div class="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                  <h2 class="text-xl font-bold text-on-surface dark:text-slate-100">Expenses Log</h2>
                  <span class="text-2xl font-black text-primary dark:text-blue-400">
                    {{ getCurrencySymbol(expensesStore.expenses[0]?.currency || 'INR') }}{{ expensesStore.totalExpenses.toFixed(2) }}
                  </span>
                </div>

                <!-- Expenses Content (Table vs Stacked Cards) -->
                <div v-if="expensesStore.expenses.length > 0">
                  <!-- Mobile view: Stacked cards layout -->
                  <div class="md:hidden divide-y divide-gray-150 dark:divide-slate-800">
                    <div
                      v-for="expense in expensesStore.expenses"
                      :key="expense._id"
                      class="p-5 hover:bg-surface-container-low dark:hover:bg-slate-800/40 transition-colors flex flex-col gap-3"
                    >
                      <div class="flex items-center justify-between">
                        <h3 class="font-bold text-sm text-on-surface dark:text-slate-100 truncate pr-2">{{ expense.title }}</h3>
                        <p class="text-base font-extrabold text-primary dark:text-blue-400 flex-shrink-0">
                          {{ getCurrencySymbol(expense.currency) }}{{ expense.amount.toFixed(2) }}
                        </p>
                      </div>
                      
                      <div class="flex items-center justify-between text-xs text-outline-variant">
                        <span class="flex items-center gap-1">
                          <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                          {{ formatDate(expense.createdAt) }}
                        </span>
                        <span class="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-outline-variant">
                          {{ expense.currency }}
                        </span>
                      </div>

                      <div class="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3 mt-1 text-xs">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="text-[10px] text-outline-variant font-medium">Paid by:</span>
                          <div class="flex items-center gap-1 truncate">
                            <div class="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-900 dark:text-blue-300 flex-shrink-0">
                              {{ expense.paidBy.name.substring(0, 1).toUpperCase() }}
                            </div>
                            <span class="text-xs font-semibold text-on-surface dark:text-slate-200 truncate max-w-[70px]">{{ expense.paidBy.name }}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5 flex-shrink-0">
                          <span class="text-[10px] text-outline-variant font-medium">Split:</span>
                          <div class="flex items-center gap-1">
                            <div
                              v-for="member in expense.splitAmong"
                              :key="member._id"
                              class="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300 tooltip"
                              :title="member.name"
                            >
                              {{ member.name.substring(0, 1).toUpperCase() }}
                            </div>
                          </div>
                        </div>

                        <button
                          v-if="canDeleteExpense(expense)"
                          @click="handleDeleteExpense(expense._id)"
                          :disabled="deleting"
                          class="text-outline-variant hover:text-error transition-colors disabled:opacity-50 ml-2 flex-shrink-0"
                          title="Delete expense"
                        >
                          <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Tablet+ view: Full structured tabular table layout -->
                  <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                      <thead>
                        <tr class="border-b border-gray-150 dark:border-slate-800 text-outline-variant text-[11px] font-bold uppercase tracking-wider bg-gray-50/30 dark:bg-slate-900/30">
                          <th class="px-6 py-4">Title</th>
                          <th class="px-6 py-4">Date</th>
                          <th class="px-6 py-4">Paid By</th>
                          <th class="px-6 py-4">Split Among</th>
                          <th class="px-6 py-4 text-right">Amount</th>
                          <th class="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-slate-800/60">
                        <tr
                          v-for="expense in expensesStore.expenses"
                          :key="expense._id"
                          class="hover:bg-surface-container-low dark:hover:bg-slate-850/45 transition-colors"
                        >
                          <!-- Title -->
                          <td class="px-6 py-4">
                            <h3 class="font-bold text-sm text-on-surface dark:text-slate-100">{{ expense.title }}</h3>
                          </td>
                          
                          <!-- Date -->
                          <td class="px-6 py-4 text-xs text-outline-variant">
                            {{ formatDate(expense.createdAt) }}
                          </td>

                          <!-- Paid By -->
                          <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                              <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-900 dark:text-blue-300">
                                {{ expense.paidBy.name.substring(0, 1).toUpperCase() }}
                              </div>
                              <span class="text-xs font-semibold text-on-surface dark:text-slate-200">{{ expense.paidBy.name }}</span>
                            </div>
                          </td>

                          <!-- Split Among -->
                          <td class="px-6 py-4">
                            <div class="flex items-center gap-1 flex-wrap">
                              <div
                                v-for="member in expense.splitAmong"
                                :key="member._id"
                                class="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-gray-700 dark:text-gray-300 tooltip"
                                :title="member.name"
                              >
                                {{ member.name.substring(0, 1).toUpperCase() }}
                              </div>
                            </div>
                          </td>

                          <!-- Amount -->
                          <td class="px-6 py-4 text-right">
                            <span class="text-sm font-extrabold text-primary dark:text-blue-400">
                              {{ getCurrencySymbol(expense.currency) }}{{ expense.amount.toFixed(2) }}
                            </span>
                            <span class="text-[10px] text-outline-variant block mt-0.5 uppercase">{{ expense.currency }}</span>
                          </td>

                          <!-- Delete -->
                          <td class="px-6 py-4 text-center">
                            <button
                              v-if="canDeleteExpense(expense)"
                              @click="handleDeleteExpense(expense._id)"
                              :disabled="deleting"
                              class="text-outline-variant hover:text-error transition-colors disabled:opacity-50 active:scale-95 duration-100"
                              title="Delete expense"
                            >
                              <span class="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Empty State -->
                <div v-else class="p-12 text-center">
                  <div class="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-outline-variant text-4xl">account_balance_wallet</span>
                  </div>
                  <h3 class="text-lg font-semibold text-outline-variant mb-2">No expenses yet</h3>
                  <p class="text-sm text-outline-variant">Add the first expense to get started</p>
                </div>
              </div>
            </section>

            <!-- Settlements Summary Section (right - 1 col on lg) -->
            <section class="lg:col-span-1">
            <!-- Balances Card -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden mb-6">
              <!-- Header -->
              <div class="p-6 border-b border-gray-100 dark:border-slate-800">
                <h2 class="text-xl font-bold text-on-surface dark:text-slate-100 mb-2">Who Owes What</h2>
                <button
                  @click="refreshBalances"
                  :disabled="balancesLoading"
                  class="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                  Refresh
                </button>
              </div>

              <!-- Balances List -->
              <div v-if="expensesStore.membersWithBalance.length > 0" class="divide-y divide-gray-100 dark:divide-slate-800">
                <div
                  v-for="member in expensesStore.membersWithBalance"
                  :key="member._id"
                  class="p-4 hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-900 dark:text-blue-300 flex-shrink-0">
                        {{ member.name.substring(0, 1).toUpperCase() }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-on-surface dark:text-slate-100 truncate">{{ member.name }}</p>
                        <p class="text-xs text-outline-variant dark:text-slate-400 truncate">{{ member.email }}</p>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <p
                        :class="[
                          'text-sm font-bold',
                          member.balance > 0.01
                            ? 'text-green-600 dark:text-green-400'
                            : member.balance < -0.01
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        ]"
                      >
                        <span v-if="member.balance > 0.01">+₹{{ Math.abs(member.balance).toFixed(2) }}</span>
                        <span v-else-if="member.balance < -0.01">-₹{{ Math.abs(member.balance).toFixed(2) }}</span>
                        <span v-else>Settled</span>
                      </p>
                      <p class="text-xs text-outline-variant mt-1">
                        <span v-if="member.balance > 0.01">is owed</span>
                        <span v-else-if="member.balance < -0.01">owes</span>
                        <span v-else class="dark:text-slate-500">all set</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="p-6 text-center text-outline-variant text-sm">
                No expenses to calculate balances
              </div>
            </div>

            <!-- Settlements Card -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <!-- Header -->
              <div class="p-6 border-b border-gray-100 dark:border-slate-800">
                <h2 class="text-lg font-bold text-on-surface dark:text-slate-100">Settlements</h2>
              </div>

              <!-- Settlements List -->
              <div v-if="expensesStore.settlements.length > 0" class="divide-y divide-gray-100 dark:divide-slate-800">
                <div
                  v-for="(settlement, idx) in expensesStore.settlements"
                  :key="idx"
                  class="p-4 hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <span class="text-xs font-semibold text-on-surface dark:text-slate-200 truncate">{{ settlement.fromName }}</span>
                    </div>
                    <span class="text-xs text-outline-variant dark:text-slate-500 flex-shrink-0">→</span>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <span class="text-xs font-semibold text-on-surface dark:text-slate-200 truncate">{{ settlement.toName }}</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between mt-2">
                    <p class="text-sm font-bold text-primary dark:text-blue-400">₹{{ settlement.amount.toFixed(2) }}</p>
                    <button
                      @click="handleSettleUp(settlement)"
                      class="text-xs bg-green-50 dark:bg-green-950/40 hover:bg-green-600 dark:hover:bg-green-600 text-green-700 dark:text-green-400 hover:text-white px-3 py-1 rounded-full font-semibold transition-all active:scale-95 duration-150 flex items-center gap-1 border border-green-200/50 dark:border-green-800/40 cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[14px]">done</span>
                      Settle
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="p-6 text-center">
                <p class="text-sm text-outline-variant">All settled up! 🎉</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
    </div>

    <!-- Add Expense Modal -->
    <AddExpenseModal
      :isOpen="showAddExpenseModal"
      :members="trip?.members || []"
      :tripOwner="trip?.ownerId || {}"
      :error="error"
      @close="showAddExpenseModal = false"
      @submit="handleAddExpense"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useExpensesStore } from '../stores/expenses'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import Sidebar from '../components/Sidebar.vue'
import AddExpenseModal from '../components/AddExpenseModal.vue'
import { useSocket } from '../composables/useSocket'
import TripPresence from '../components/TripPresence.vue'

const route = useRoute()
const expensesStore = useExpensesStore()
const authStore = useAuthStore()
const { activeMembers } = useSocket(route.params.tripId)

const trip = ref(null)
const loading = ref(true)
const balancesLoading = ref(false)
const deleting = ref(false)
const error = ref('')
const showAddExpenseModal = ref(false)

const getCurrencySymbol = (currency) => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  }
  return symbols[currency] || '₹'
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const fetchTrip = async () => {
  try {
    loading.value = true
    error.value = ''
    const res = await api.get(`/trips/${route.params.tripId}`)
    trip.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch trip'
  }
}

const fetchExpenses = async () => {
  try {
    await expensesStore.fetchExpenses(route.params.tripId)
  } catch (err) {
    error.value = err.message || 'Failed to fetch expenses'
  }
}

const fetchBalances = async () => {
  try {
    await expensesStore.fetchBalances(route.params.tripId)
  } catch (err) {
    error.value = err.message || 'Failed to fetch balances'
  }
}

const refreshBalances = async () => {
  balancesLoading.value = true
  try {
    await expensesStore.fetchBalances(route.params.tripId)
  } catch (err) {
    error.value = err.message || 'Failed to refresh balances'
  } finally {
    balancesLoading.value = false
  }
}

const handleAddExpense = async (expenseData) => {
  try {
    await expensesStore.addExpense(route.params.tripId, expenseData)
    showAddExpenseModal.value = false
    // Refresh balances after adding expense
    await expensesStore.fetchBalances(route.params.tripId)
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to add expense'
    // Keep modal open on error so user can see the error and try again
  }
}

const handleDeleteExpense = async (expenseId) => {
  if (!confirm('Are you sure you want to delete this expense?')) {
    return
  }

  deleting.value = true
  try {
    await expensesStore.deleteExpense(route.params.tripId, expenseId)
    // Refresh balances after deleting expense
    await expensesStore.fetchBalances(route.params.tripId)
  } catch (err) {
    error.value = err.message || 'Failed to delete expense'
  } finally {
    deleting.value = false
  }
}

const handleSettleUp = async (settlement) => {
  if (!confirm(`Mark ₹${settlement.amount.toFixed(2)} settled from ${settlement.fromName} to ${settlement.toName}? This will automatically record a transaction.`)) {
    return
  }

  try {
    error.value = ''
    const defaultCurrency = expensesStore.expenses[0]?.currency || 'INR'
    await handleAddExpense({
      title: `Settlement: ${settlement.fromName} paid ${settlement.toName}`,
      amount: settlement.amount,
      currency: defaultCurrency,
      paidBy: settlement.from,
      splitAmong: [settlement.to]
    })
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to settle'
  }
}

const canDeleteExpense = (expense) => {
  const currentUser = authStore.currentUser;
  if (!currentUser) return false;

  const isTripOwner = trip.value &&
    (trip.value.ownerId?._id?.toString() === currentUser.id ||
     trip.value.ownerId?.toString() === currentUser.id);

  const payerId = expense.paidBy?._id
    ? expense.paidBy._id.toString()
    : expense.paidBy?.toString();

  const isExpensePayer = payerId === currentUser.id;

  return isTripOwner || isExpensePayer;
};

const initializeData = async () => {
  try {
    loading.value = true
    await fetchTrip()
    await fetchExpenses()
    await fetchBalances()
  } catch (err) {
    error.value = 'Failed to load data'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  initializeData()
})
</script>

<style scoped>
.tooltip {
  position: relative;
}

.tooltip:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
}
</style>
