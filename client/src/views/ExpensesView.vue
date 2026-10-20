<template>
  <AppLayout>
        <!-- Top Header Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Expenses</h1>
            <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-1">Track and split expenses for this trip.</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <TripPresence :activeMembers="activeMembers" />

            <button
              @click="openSettleUpModal"
              class="px-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1B1C19] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#D5D3CA] text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 h-[48px]"
            >
              <span class="material-symbols-outlined text-[16px] text-[#A7A99A]">handshake</span>
              <span>Settle Up</span>
            </button>

            <NewTransactionCard
              @click="() => { error = ''; showAddExpenseModal = true }"
            />
          </div>
        </div>

        <!-- Full page load error with Retry -->
        <div v-if="loadError" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#C77F78]/40 rounded-2xl mb-6 shadow-sm">
          <span class="material-symbols-outlined text-4xl text-[#C77F78] mb-2">error</span>
          <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ loadError }}</p>
          <button @click="loadAllData" class="mt-4 px-4 py-2 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs font-semibold rounded-xl">
            Retry
          </button>
        </div>

        <!-- Currency Selector / Tabs -->
        <div v-if="availableCurrencies.length > 0" class="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1">
          <span class="text-xs font-semibold text-[#575851] dark:text-[#A5A69B] flex-shrink-0">Currency:</span>
          <div class="flex items-center bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl p-1.5 gap-1.5 shadow-sm flex-shrink-0">
            <button
              v-for="curr in availableCurrencies"
              :key="curr"
              type="button"
              :data-test="`currency-tab-${curr}`"
              @click="selectedCurrency = curr"
              :class="[
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                selectedCurrency === curr
                  ? 'bg-[#1C1D1A] dark:bg-[#A7A99A] text-white dark:text-[#171813] shadow-sm'
                  : 'text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F]'
              ]"
            >
              {{ curr }}
            </button>
          </div>
        </div>

        <!-- 4 Stat Cards Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Expenses -->
          <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Total Expenses</p>
              <p class="text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate" :title="formatCurrency(computedTotalExpenses, currentTripCurrency)">
                {{ formatCurrency(computedTotalExpenses, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- Your Share -->
          <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">pie_chart</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-[#7E8075] dark:text-[#85867C] truncate">Your Share</p>
              <p class="text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight mt-1 truncate" :title="formatCurrency(computedYourShare, currentTripCurrency)">
                {{ formatCurrency(computedYourShare, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- You Owe -->
          <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#C77F78]/10 border border-[#C77F78]/30 flex items-center justify-center text-[#C77F78] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">arrow_downward</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-[#7E8075] dark:text-[#85867C] truncate">You Owe</p>
              <p class="text-xl font-bold text-[#C77F78] tracking-tight mt-1 truncate" :title="formatCurrency(computedYouOwe, currentTripCurrency)">
                {{ formatCurrency(computedYouOwe, currentTripCurrency) }}
              </p>
            </div>
          </div>

          <!-- You Are Owed -->
          <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all shadow-sm min-h-[104px] h-full">
            <div class="w-12 h-12 rounded-xl bg-[#86A98B]/10 border border-[#86A98B]/30 flex items-center justify-center text-[#86A98B] flex-shrink-0">
              <span class="material-symbols-outlined text-2xl">arrow_upward</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-[#7E8075] dark:text-[#85867C] truncate">You Are Owed</p>
              <p class="text-xl font-bold text-[#86A98B] tracking-tight mt-1 truncate" :title="formatCurrency(computedYouAreOwed, currentTripCurrency)">
                {{ formatCurrency(computedYouAreOwed, currentTripCurrency) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Notification -->
        <div v-if="error" class="bg-[#C77F78]/10 border border-[#C77F78]/30 text-[#C77F78] text-xs px-4 py-3 rounded-xl mb-6 flex items-center justify-between">
          <span>{{ error }}</span>
          <button @click="error = ''" class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]">✕</button>
        </div>

        <!-- 2-Column Split: Expenses Log & Who Owes What -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column: Expenses Log (8 cols) -->
          <div class="lg:col-span-8 min-w-0 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 shadow-sm">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Expenses Log</h2>
              <span class="text-xs text-[#7E8075] dark:text-[#85867C] font-medium">{{ displayExpenses.length }} transactions</span>
            </div>

            <!-- Table (Desktop & Tablet) -->
            <div class="overflow-x-auto custom-scrollbar">
              <table class="w-full text-left text-xs min-w-[620px]">
                <thead>
                  <tr class="border-b border-[#E3E0D8] dark:border-[#30312C] text-[10px] uppercase font-bold text-[#7E8075] dark:text-[#85867C] tracking-wider">
                    <th class="py-3.5 px-4">Description</th>
                    <th class="py-3.5 px-4">Date</th>
                    <th class="py-3.5 px-4">Paid By</th>
                    <th class="py-3.5 px-4 text-right">Amount</th>
                    <th class="py-3.5 px-4 text-center">Split Among</th>
                    <th class="py-3.5 px-4 text-right">Your Share</th>
                    <th class="py-3.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#E3E0D8] dark:divide-[#30312C]">
                  <tr v-if="displayExpenses.length === 0">
                    <td colspan="7" class="py-14 text-center text-[#7E8075]">
                      <div class="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div class="w-12 h-12 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] mb-3 flex-shrink-0">
                          <span class="material-symbols-outlined text-2xl">receipt_long</span>
                        </div>
                        <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">No expenses recorded yet</p>
                        <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1 leading-relaxed">Click "Add Expense" to track shared trip costs and calculate balances.</p>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-for="(item, idx) in displayExpenses"
                    :key="item.id || item._id || idx"
                    class="hover:bg-[#F7F6F2] dark:hover:bg-[#22231F]/50 transition-colors group"
                  >
                    <!-- Description -->
                    <td class="py-4 px-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-[#F0EEE9] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
                          <span class="material-symbols-outlined text-[16px]">{{ getCategoryIcon(item.title) }}</span>
                        </div>
                        <span class="font-medium text-[#1C1D1A] dark:text-[#D5D3CA] truncate max-w-[140px] md:max-w-[170px]">
                          {{ item.title }}
                        </span>
                      </div>
                    </td>

                    <!-- Date -->
                    <td class="py-4 px-4 text-[#575851] dark:text-[#A5A69B] whitespace-nowrap">
                      {{ formatDate(item.date || item.createdAt) }}
                    </td>

                    <!-- Paid By -->
                    <td class="py-4 px-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-[#EFECE6] dark:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] font-semibold text-[10px] flex items-center justify-center border border-[#E3E0D8] dark:border-[#414239] flex-shrink-0">
                          {{ (item.paidByName || item.paidBy?.name || 'U').charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-[#1C1D1A] dark:text-[#D5D3CA] font-medium">{{ item.paidByName || item.paidBy?.name || 'Unknown' }}</span>
                      </div>
                    </td>

                    <!-- Amount -->
                    <td class="py-4 px-4 text-right font-bold text-[#1C1D1A] dark:text-[#D5D3CA] whitespace-nowrap">
                      {{ formatCurrency(item.amount, item.currency || currentTripCurrency) }}
                    </td>

                    <!-- Split Among -->
                    <td class="py-4 px-4 text-center text-[#575851] dark:text-[#A5A69B] whitespace-nowrap">
                      {{ item.splitText || `${(item.splitAmong?.length || 1)} ${(item.splitAmong?.length === 1 ? 'person' : 'people')}` }}
                    </td>

                    <!-- Your Share -->
                    <td class="py-4 px-4 text-right font-semibold text-[#575851] dark:text-[#A5A69B] whitespace-nowrap">
                      {{ formatCurrency(item.yourShare !== undefined ? item.yourShare : (item.amount / (item.splitAmong?.length || 1)), item.currency || currentTripCurrency) }}
                    </td>

                    <!-- Actions -->
                    <td class="py-4 px-3 text-center whitespace-nowrap">
                      <button
                        v-if="canDeleteExpense(item)"
                        @click="handleDeleteExpense(item.id || item._id)"
                        class="p-1.5 rounded-lg hover:bg-[#C77F78]/10 text-[#7E8075] hover:text-[#C77F78] transition-colors"
                        title="Delete expense"
                      >
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                      <button
                        v-else
                        class="p-1.5 rounded-lg hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors"
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
          <div class="lg:col-span-4 min-w-0 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-5">
                <h2 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Who Owes What</h2>
                <button
                  @click="refreshBalances"
                  class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors p-1 rounded-lg"
                  title="Refresh balances"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                </button>
              </div>

              <!-- List of Debtors / Creditors -->
              <div v-if="displayOwesList.length === 0" class="text-center py-10">
                <span class="material-symbols-outlined text-3xl text-[#86A98B] mb-2">check_circle</span>
                <p class="text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">All settled up!</p>
                <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] mt-0.5">No outstanding balances among members.</p>
              </div>
              <div v-else class="space-y-3.5">
                <div
                  v-for="(debt, idx) in displayOwesList"
                  :key="debt.id || idx"
                  class="flex items-center justify-between p-4 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] transition-all gap-3.5"
                >
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      v-if="debt.avatar"
                      :src="debt.avatar"
                      :alt="debt.name"
                      class="w-8 h-8 rounded-full object-cover border border-[#E3E0D8] dark:border-[#414239] flex-shrink-0"
                      @error="e => e.target.style.display = 'none'"
                    />
                    <div v-else class="w-8 h-8 rounded-full bg-[#EFECE6] dark:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] flex items-center justify-center font-bold text-xs border border-[#E3E0D8] dark:border-[#414239] flex-shrink-0">
                      {{ debt.name ? debt.name.charAt(0).toUpperCase() : 'U' }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">
                        <span v-if="debt.type === 'owes_you'">{{ debt.name }} owes you</span>
                        <span v-else>You owe {{ debt.name }}</span>
                      </p>
                      <p v-if="debt.email" class="text-[10px] text-[#7E8075] dark:text-[#85867C] truncate">{{ debt.email }}</p>
                    </div>
                  </div>

                  <span
                    :class="[
                      'text-xs font-bold px-3 py-1 rounded-xl border flex-shrink-0',
                      debt.type === 'owes_you'
                        ? 'text-[#86A98B] bg-[#86A98B]/15 border-[#86A98B]/30'
                        : 'text-[#C77F78] bg-[#C77F78]/15 border-[#C77F78]/30'
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
              class="w-full mt-6 py-2.5 px-4 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] hover:bg-[#E3E0D8] dark:hover:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm group"
            >
              <span>View Settlement Plan</span>
              <span class="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform text-[#A7A99A]">arrow_forward</span>
            </button>
          </div>
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
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[#E3E0D8] dark:border-[#30312C]">
          <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Settlement Plan</h3>
          <button @click="showSettleModal = false" class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]">✕</button>
        </div>

        <div class="py-4 space-y-3">
          <div
            v-for="(debt, idx) in displayOwesList"
            :key="idx"
            class="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between text-xs"
          >
            <div>
              <p class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">
                <span v-if="debt.type === 'owes_you'">{{ debt.name }} → You</span>
                <span v-else>You → {{ debt.name }}</span>
              </p>
              <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] mt-0.5">Amount: {{ formatCurrency(debt.amount, currentTripCurrency) }}</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#EFECE6] dark:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] border border-[#E3E0D8] dark:border-[#414239]">
              {{ formatCurrency(debt.amount, currentTripCurrency) }}
            </span>
          </div>
        </div>

        <button
          @click="showSettleModal = false"
          class="w-full py-2.5 rounded-xl bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] text-xs font-semibold transition-all mt-2 border border-[#A7A99A]/40"
        >
          Close
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useExpensesStore } from '../stores/expenses'
import { useAuthStore } from '../stores/auth'
import { useTripsStore } from '../stores/trips'
import AppLayout from '../components/AppLayout.vue'
import TripPresence from '../components/TripPresence.vue'
import AddExpenseModal from '../components/AddExpenseModal.vue'
import NewTransactionCard from '../components/NewTransactionCard.vue'
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

