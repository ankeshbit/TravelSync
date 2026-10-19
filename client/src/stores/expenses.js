import { defineStore } from 'pinia';
import api from '../api';

let fetchExpensesRequestId = 0;

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    balances: {},
    membersWithBalance: [],
    settlements: [],
    byCurrency: {},
    currency: null,
    loading: false,
    error: null
  }),

  getters: {
    totalExpenses: (state) => {
      return state.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    }
  },

  actions: {
    resetExpenses() {
      this.expenses = [];
      this.balances = {};
      this.membersWithBalance = [];
      this.settlements = [];
      this.byCurrency = {};
      this.currency = null;
      this.error = null;
    },

    async fetchExpenses(tripId) {
      const currentRequestId = ++fetchExpensesRequestId;
      this.resetExpenses();
      this.loading = true;
      this.error = null;
      try {
        let allExpenses = [];
        let page = 1;
        let hasNextPage = true;
        let responseCurrency = null;

        while (hasNextPage) {
          const response = await api.get(`/trips/${tripId}/expenses?page=${page}&limit=50`);
          if (currentRequestId !== fetchExpensesRequestId) {
            return;
          }
          const data = response.data;
          const pageExpenses = data.expenses ?? (Array.isArray(data) ? data : []);
          allExpenses = allExpenses.concat(pageExpenses);
          if (data.currency) {
            responseCurrency = data.currency;
          }
          if (data.pagination && data.pagination.hasNextPage) {
            page += 1;
          } else {
            hasNextPage = false;
          }
        }
        if (currentRequestId !== fetchExpensesRequestId) return;
        this.expenses = allExpenses;
        if (responseCurrency) {
          this.currency = responseCurrency;
        }
      } catch (err) {
        if (currentRequestId !== fetchExpensesRequestId) return;
        this.error = err.response?.data?.message || err.message;
        throw err;
      } finally {
        if (currentRequestId === fetchExpensesRequestId) {
          this.loading = false;
        }
      }
    },

    async addExpense(tripId, expenseData) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.post(`/trips/${tripId}/expenses`, expenseData);
        const newId = response.data.id || response.data._id;
        if (!this.expenses.some(e => (e.id || e._id) === newId)) {
          this.expenses.push(response.data);
        }
        return response.data;
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to add expense';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deleteExpense(tripId, expenseId) {
      this.loading = true;
      this.error = null;
      try {
        await api.delete(`/trips/${tripId}/expenses/${expenseId}`);
        this.expenses = this.expenses.filter(e => (e.id || e._id) !== expenseId);
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to delete expense';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchBalances(tripId) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/trips/${tripId}/expenses/balances`);
        this.balances = response.data.balanceMap || {};
        this.membersWithBalance = response.data.membersWithBalance || [];
        this.settlements = response.data.settlements || [];
        this.byCurrency = response.data.byCurrency || {};
        if (response.data.currency) {
          this.currency = response.data.currency;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to fetch balances';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    clearError() {
      this.error = null;
    }
  }
});
