import { defineStore } from 'pinia';
import api from '../api';

export const useExploreStore = defineStore('explore', {
  state: () => ({
    destinations: [],
    loading: false,
    error: null
  }),
  actions: {
    async fetchDestinations(q = '') {
      this.loading = true;
      this.error = null;
      try {
        const params = {};
        if (q && typeof q === 'string' && q.trim()) {
          params.q = q.trim();
        }
        const response = await api.get('/explore/destinations', { params });
        const data = Array.isArray(response.data) ? response.data : (response.data?.destinations || []);
        this.destinations = data;
        return data;
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch destinations';
        this.error = errorMsg;
        throw err;
      } finally {
        this.loading = false;
      }
    }
  }
});
