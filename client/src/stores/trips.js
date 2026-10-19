import { defineStore } from 'pinia'
import api from '../api'

let fetchTripsRequestId = 0;

export const useTripsStore = defineStore('trips', {
  state: () => ({
    trips: [],
    currentTrip: null,
    members: [],
    loading: false,
    error: null,
    memberError: null,
    memberLoading: false
  }),
  actions: {
    async fetchTrips() {
      const currentRequestId = ++fetchTripsRequestId;
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get('/trips');
        if (currentRequestId !== fetchTripsRequestId) return;
        this.trips = response.data.trips ?? response.data;
      } catch (err) {
        if (currentRequestId !== fetchTripsRequestId) return;
        this.error = err.response?.data?.message || err.message;
        throw err;
      } finally {
        if (currentRequestId === fetchTripsRequestId) {
          this.loading = false;
        }
      }
    },
    async createTrip(data) {
      try {
        const response = await api.post('/trips', data)
        this.trips.push(response.data)
        return response.data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      }
    },
    async deleteTrip(id) {
      try {
        await api.delete(`/trips/${id}`)
        this.trips = this.trips.filter(trip => (trip.id || trip._id) !== id)
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      }
    },
    async fetchTrip(id) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.get(`/trips/${id}`);
        this.currentTrip = response.data;
        this.members = response.data.members || [];
        return response.data;
      } catch (err) {
        this.error = err.response?.data?.message || err.message;
        throw err;
      } finally {
        this.loading = false;
      }
    },
    resetCurrentTrip() {
      this.currentTrip = null;
      this.members = [];
      this.error = null;
    },
    async fetchMembers(tripId) {
      this.memberLoading = true
      this.memberError = null
      try {
        const response = await api.get(`/trips/${tripId}/members`)
        this.members = response.data
      } catch (err) {
        this.memberError = err.response?.data?.message || err.message
        throw err
      } finally {
        this.memberLoading = false
      }
    },
    async addMember(tripId, email) {
      this.memberLoading = true
      this.memberError = null
      try {
        const response = await api.post(`/trips/${tripId}/members`, { email })
        this.currentTrip = response.data
        this.members = response.data.members || []
        return response.data
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Failed to add member'
        this.memberError = errorMessage
        throw new Error(errorMessage)
      } finally {
        this.memberLoading = false
      }
    },
    async removeMember(tripId, userId) {
      this.memberLoading = true
      this.memberError = null
      try {
        const response = await api.delete(`/trips/${tripId}/members/${userId}`)
        this.currentTrip = response.data
        this.members = response.data.members || []
        return response.data
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Failed to remove member'
        this.memberError = errorMessage
        throw new Error(errorMessage)
      } finally {
        this.memberLoading = false
      }
    },
    clearMemberError() {
      this.memberError = null
    },
    async fetchDestinations(q = '') {
      try {
        const params = {};
        if (q && typeof q === 'string' && q.trim()) {
          params.q = q.trim();
        }
        const response = await api.get('/explore/destinations', { params });
        return Array.isArray(response.data) ? response.data : (response.data?.destinations || []);
      } catch (err) {
        throw err;
      }
    }
  }
})
