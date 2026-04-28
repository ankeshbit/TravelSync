<template>
  <div class="bg-background text-on-surface min-h-screen flex flex-col">
    <Navbar />

    <div class="flex flex-1 mt-[64px]">
      <Sidebar />

      <!-- Main Content Canvas -->
      <main class="flex-1 md:ml-64 p-gutter pb-20">
        <!-- Page Header -->
        <section v-if="!loading && trip" class="mb-lg">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-on-surface">{{ trip.name }} - Expenses</h1>
              <p class="text-outline-variant mt-1">Track and split expenses for this trip</p>
            </div>
            <button
              @click="() => { error = ''; showAddExpenseModal = true }"
              class="bg-primary text-on-primary px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity self-start md:self-auto"
            >
              <span class="material-symbols-outlined">add</span>
              Add Expense
            </button>
          </div>
        </section>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center items-center h-64">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="bg-error-container text-on-error-container p-4 rounded-lg text-center font-semibold my-8">
          {{ error }}
        </div>

        <!-- Main Grid Layout -->
        <div v-if="!loading && trip" class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <!-- Expense List Section (left) -->
          <section class="lg:col-span-2">
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <!-- Section Header -->
              <div class="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <h2 class="text-xl font-bold text-on-surface">Expenses</h2>
                <span class="text-2xl font-bold text-primary">
                  {{ getCurrencySymbol(expensesStore.expenses[0]?.currency || 'INR') }}{{ expensesStore.totalExpenses.toFixed(2) }}
                </span>
              </div>

              <!-- Expenses List -->
              <div v-if="expensesStore.expenses.length > 0" class="divide-y divide-gray-100 dark:divide-slate-800">
                <div
                  v-for="expense in expensesStore.expenses"
                  :key="expense._id"
                  class="p-6 hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <!-- Expense Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between mb-2">
                      <div>
                        <h3 class="font-semibold text-on-surface truncate">{{ expense.title }}</h3>
                        <p class="text-xs text-outline-variant mt-1">
                          {{ formatDate(expense.createdAt) }}
                        </p>
                      </div>
                    </div>

                    <!-- Paid By -->
                    <div class="flex items-center gap-2 mb-3">
                      <span class="text-xs font-medium text-outline-variant">Paid by:</span>
                      <div class="flex items-center gap-1">
                        <div class="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-bold text-blue-900 dark:text-blue-100">
                          {{ expense.paidBy.name.substring(0, 1).toUpperCase() }}
                        </div>
                        <span class="text-xs font-medium text-on-surface">{{ expense.paidBy.name }}</span>
                      </div>
                    </div>

                    <!-- Split Among -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium text-outline-variant">Split among:</span>
                      <div class="flex items-center gap-1 flex-wrap">
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
                  </div>

                  <!-- Amount & Delete -->
                  <div class="flex flex-col items-end justify-between md:items-center md:gap-4">
                    <div class="text-right">
                      <p class="text-2xl font-bold text-primary">
                        {{ getCurrencySymbol(expense.currency) }}{{ expense.amount.toFixed(2) }}
                      </p>
                      <p class="text-xs text-outline-variant mt-1">{{ expense.currency }}</p>
                    </div>

                    <!-- Delete Button -->
                    <button
                      v-if="canDeleteExpense(expense)"
                      @click="handleDeleteExpense(expense._id)"
                      :disabled="deleting"
                      class="text-outline-variant hover:text-error transition-colors disabled:opacity-50"
                      title="Delete expense"
                    >
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
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

          <!-- Balance Summary Section (right) -->
          <section class="lg:col-span-1">
            <!-- Balances Card -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden mb-6">
              <!-- Header -->
              <div class="p-6 border-b border-gray-100 dark:border-slate-800">
                <h2 class="text-xl font-bold text-on-surface mb-2">Who Owes What</h2>
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
                      <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-900 dark:text-blue-100 flex-shrink-0">
                        {{ member.name.substring(0, 1).toUpperCase() }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-on-surface truncate">{{ member.name }}</p>
                        <p class="text-xs text-outline-variant truncate">{{ member.email }}</p>
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
                        <span v-else>all set</span>
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
                <h2 class="text-lg font-bold text-on-surface">Settlements</h2>
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
                      <span class="text-xs font-semibold text-on-surface truncate">{{ settlement.fromName }}</span>
                    </div>
                    <span class="text-xs text-outline-variant flex-shrink-0">→</span>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <span class="text-xs font-semibold text-on-surface truncate">{{ settlement.toName }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-bold text-primary">₹{{ settlement.amount.toFixed(2) }}</p>
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
import Navbar from '../components/Navbar.vue'
import Sidebar from '../components/Sidebar.vue'
import AddExpenseModal from '../components/AddExpenseModal.vue'

const route = useRoute()
const expensesStore = useExpensesStore()

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
    error.value = err.message || 'Failed to add expense'
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

const canDeleteExpense = (expense) => {
  const userStr = localStorage.getItem('user')
  if (!userStr) return false

  try {
    const user = JSON.parse(userStr)
    const isTripOwner = trip.value && trip.value.ownerId._id === user.id
    const isExpensePayer = expense.paidBy._id === user.id
    return isTripOwner || isExpensePayer
  } catch (e) {
    return false
  }
}

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
