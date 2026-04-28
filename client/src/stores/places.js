import { defineStore } from 'pinia'
import api from '../api'

export const usePlacesStore = defineStore('places', {
  state: () => ({
    places: [],
    selectedPlace: null,
    isDetailPanelOpen: false,
    loading: false,
    error: null
  }),
  getters: {
    placesByDay: (state) => {
      const grouped = {}
      // Sort by orderIndex first
      const sortedPlaces = [...state.places].sort((a, b) => a.orderIndex - b.orderIndex)
      
      sortedPlaces.forEach(place => {
        if (!grouped[place.dayNumber]) {
          grouped[place.dayNumber] = []
        }
        grouped[place.dayNumber].push(place)
      })
      return grouped
    }
  },
  actions: {
    async fetchPlaces(tripId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get(`/trips/${tripId}/places`)
        this.places = response.data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
      } finally {
        this.loading = false
      }
    },
    async addPlace(tripId, placeData) {
      try {
        const response = await api.post(`/trips/${tripId}/places`, placeData)
        this.places.push(response.data)
        return response.data
      } catch (err) {
        console.error('Error adding place:', err)
        throw err
      }
    },
    async deletePlace(tripId, placeId) {
      try {
        await api.delete(`/trips/${tripId}/places/${placeId}`)
        this.places = this.places.filter(p => p._id !== placeId)
        if (this.selectedPlace && this.selectedPlace._id === placeId) {
          this.closeDetailPanel()
        }
      } catch (err) {
        console.error('Error deleting place:', err)
        throw err
      }
    },
    async updateNote(tripId, placeId, note) {
      try {
        const response = await api.patch(`/trips/${tripId}/places/${placeId}/note`, { note })
        const index = this.places.findIndex(p => p._id === placeId)
        if (index !== -1) {
          this.places[index].note = response.data.note
        }
        if (this.selectedPlace && this.selectedPlace._id === placeId) {
          this.selectedPlace.note = response.data.note
        }
      } catch (err) {
        console.error('Error updating note:', err)
        throw err
      }
    },
    async reorderPlaces(tripId, reorderPayload) {
      try {
        const response = await api.patch(`/trips/${tripId}/places/reorder`, reorderPayload)
        this.places = response.data
      } catch (err) {
        console.error('Error reordering places:', err)
        throw err
      }
    },
    selectPlace(place) {
      this.selectedPlace = place
      this.isDetailPanelOpen = true
    },
    closeDetailPanel() {
      this.isDetailPanelOpen = false
    }
  }
})
