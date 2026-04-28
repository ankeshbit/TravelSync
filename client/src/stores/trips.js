import { defineStore } from 'pinia'
import api from '../api'

export const useTripsStore = defineStore('trips', {
  state: () => ({
    currentTrip: null,
    members: [],
    loading: false,
    error: null,
    memberError: null,
    memberLoading: false
  }),
  actions: {
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
    }
  }
})
