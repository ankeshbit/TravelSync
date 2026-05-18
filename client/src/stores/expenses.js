import { defineStore } from 'pinia'
import api from '../api'

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    balances: {},
    membersWithBalance: [],
    settlements: [],
    loading: false,
    error: null
  }),

  getters: {
    totalExpenses: (state) => {
      return state.expenses.reduce((sum, expense) => sum + expense.amount, 0)
    }
  },

  actions: {
    async fetchExpenses(tripId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get(`/trips/${tripId}/expenses`)
        this.expenses = response.data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async addExpense(tripId, expenseData) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/trips/${tripId}/expenses`, expenseData)
        if (!this.expenses.some(e => e._id === response.data._id)) {
          this.expenses.push(response.data)
        }
        return response.data
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to add expense'
        throw err
      } finally {
        this.loading = false
      }
    },

    async deleteExpense(tripId, expenseId) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/trips/${tripId}/expenses/${expenseId}`)
        this.expenses = this.expenses.filter(e => e._id !== expenseId)
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to delete expense'
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchBalances(tripId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get(`/trips/${tripId}/expenses/balances`)
        this.balances = response.data.balanceMap
        this.membersWithBalance = response.data.membersWithBalance
        this.settlements = response.data.settlements
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to fetch balances'
        throw err
      } finally {
        this.loading = false
      }
    },

    clearError() {
      this.error = null
    }
  }
})
