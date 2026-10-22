import { defineStore } from 'pinia';
import api from '../api';
import {
  getOfflineTrips,
  getOfflineTripBundle,
  saveOfflineTripPack,
  updateChecklistItemLocal,
  updateNoteLocal,
  getPendingSyncQueue,
  clearPendingSyncItem,
  deleteOfflineTrip,
  clearAllUserOfflineData,
  estimateStorage
} from '../services/offlineStorage';

export const useOfflineStore = defineStore('offline', {
  state: () => ({
    offlineTrips: [],
    activeTripBundle: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadStatus: 'idle', // 'idle' | 'fetching' | 'saving' | 'verifying' | 'success' | 'error'
    downloadError: null,
    storageEstimate: null,
    pendingSyncQueue: [],
    isSyncing: false,
    syncMessage: null
  }),

  getters: {
    hasOfflineTrips: (state) => state.offlineTrips.length > 0,
    isTripSavedOffline: (state) => (tripId) => {
      return state.offlineTrips.some(t => t.tripId === tripId);
    },
    pendingSyncCount: (state) => state.pendingSyncQueue.length
  },

  actions: {
    /**
     * Load all trips saved locally for the current user
     */
    async loadOfflineTrips(userId) {
      if (!userId) {
        this.offlineTrips = [];
        return;
      }
      try {
        this.offlineTrips = await getOfflineTrips(userId);
        await this.refreshStorageEstimate();
      } catch (err) {
        console.error('Failed to load offline trips from IndexedDB:', err);
        this.offlineTrips = [];
      }
    },

    /**
     * Load a complete bundle for an offline trip
     */
    async loadTripBundle(userId, tripId) {
      if (!userId || !tripId) return null;
      try {
        const bundle = await getOfflineTripBundle(userId, tripId);
        this.activeTripBundle = bundle;
        await this.loadPendingSyncQueue(userId, tripId);
        return bundle;
      } catch (err) {
        console.error('Failed to load trip bundle from IndexedDB:', err);
        this.activeTripBundle = null;
        return null;
      }
    },

    /**
     * Download and verify full trip data for offline use
     */
    async downloadTripForOffline(userId, tripId) {
      if (!userId || !tripId) {
        throw new Error('User ID and Trip ID are required');
      }

      this.isDownloading = true;
      this.downloadProgress = 15;
      this.downloadStatus = 'fetching';
      this.downloadError = null;

      try {
        // Step 1: Fetch authenticated bundle from backend
        const res = await api.get(`/trips/${tripId}/offline-pack`);
        const pack = res.data;

        this.downloadProgress = 50;
        this.downloadStatus = 'saving';

        // Step 2: Atomic transaction write to IndexedDB
        await saveOfflineTripPack(userId, pack);

        this.downloadProgress = 85;
        this.downloadStatus = 'verifying';

        // Step 3: Verification check
        const verified = await getOfflineTripBundle(userId, tripId);
        if (!verified || !verified.trip) {
          throw new Error('Verification failed: Stored trip bundle could not be verified in IndexedDB');
        }

        this.downloadProgress = 100;
        this.downloadStatus = 'success';

        // Reload trips list and storage
        await this.loadOfflineTrips(userId);
        return verified;
      } catch (err) {
        console.error('Failed to download trip for offline use:', err);
        this.downloadStatus = 'error';
        this.downloadError = err.response?.data?.message || err.message || 'Download failed';
        throw err;
      } finally {
        setTimeout(() => {
          this.isDownloading = false;
        }, 800);
      }
    },

    /**
     * Mark a checklist item as completed or incomplete locally
     */
    async toggleChecklistItem(userId, tripId, itemId, completed) {
      try {
        await updateChecklistItemLocal(userId, tripId, itemId, completed);
        if (this.activeTripBundle && this.activeTripBundle.checklists) {
          const item = this.activeTripBundle.checklists.find(c => c.id === itemId);
          if (item) item.completed = completed;
        }
        await this.loadPendingSyncQueue(userId, tripId);
      } catch (err) {
        console.error('Failed to update checklist item locally:', err);
        throw err;
      }
    },

    /**
     * Update travel note locally
     */
    async updateNote(userId, tripId, itemId, content) {
      try {
        await updateNoteLocal(userId, tripId, itemId, content);
        if (this.activeTripBundle && this.activeTripBundle.notes) {
          const item = this.activeTripBundle.notes.find(n => n.id === itemId);
          if (item) {
            item.content = content;
            item.updatedAt = new Date().toISOString();
          }
        }
        await this.loadPendingSyncQueue(userId, tripId);
      } catch (err) {
        console.error('Failed to update note locally:', err);
        throw err;
      }
    },

    /**
     * Load pending synchronization changes for a trip or user
     */
    async loadPendingSyncQueue(userId, tripId = null) {
      if (!userId) return;
      try {
        this.pendingSyncQueue = await getPendingSyncQueue(userId, tripId);
      } catch (err) {
        console.error('Failed to load pending sync queue:', err);
      }
    },

    /**
     * Synchronize pending local edits with the backend when online
     */
    async syncPendingChanges(userId, tripId) {
      if (!userId || !tripId || this.isSyncing) return;
      await this.loadPendingSyncQueue(userId, tripId);
      if (this.pendingSyncQueue.length === 0) return;

      this.isSyncing = true;
      try {
        const changes = this.pendingSyncQueue.map(item => ({
          type: item.recordType,
          itemId: item.recordId,
          ...item.payload,
          modifiedAt: item.modifiedAt
        }));

        const res = await api.post(`/trips/${tripId}/offline-sync`, { changes });

        // On successful response, clear local queue items
        for (const item of this.pendingSyncQueue) {
          await clearPendingSyncItem(item.id);
        }

        this.syncMessage = `Successfully synced ${res.data.syncedCount || changes.length} local update(s).`;
        await this.loadPendingSyncQueue(userId, tripId);
      } catch (err) {
        console.error('Failed to sync offline changes:', err);
        this.syncMessage = 'Sync failed. Local changes remain safely preserved on this device.';
      } finally {
        this.isSyncing = false;
        setTimeout(() => {
          this.syncMessage = null;
        }, 4000);
      }
    },

    /**
     * Remove an offline trip and all associated local records
     */
    async removeOfflineTrip(userId, tripId) {
      if (!userId || !tripId) return;
      try {
        await deleteOfflineTrip(userId, tripId);
        if (this.activeTripBundle && this.activeTripBundle.trip?.id === tripId) {
          this.activeTripBundle = null;
        }
        await this.loadOfflineTrips(userId);
      } catch (err) {
        console.error('Failed to delete offline trip:', err);
        throw err;
      }
    },

    /**
     * Clear all offline data for a user (called on account switch / logout)
     */
    async clearUserData(userId) {
      if (!userId) return;
      try {
        await clearAllUserOfflineData(userId);
        this.offlineTrips = [];
        this.activeTripBundle = null;
        this.pendingSyncQueue = [];
      } catch (err) {
        console.error('Failed to clear user offline data:', err);
      }
    },

    /**
     * Query browser storage estimate API
     */
    async refreshStorageEstimate() {
      try {
        this.storageEstimate = await estimateStorage();
      } catch {
        this.storageEstimate = null;
      }
    }
  }
});
