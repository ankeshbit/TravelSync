import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory IndexedDB Mock for idb
class InMemoryIndex {
  constructor(store, keyField) {
    this.store = store;
    this.keyField = keyField;
  }

  async getAllKeys(val) {
    const keys = [];
    for (const [k, v] of this.store.records.entries()) {
      if (Array.isArray(this.keyField)) {
        const matches = this.keyField.every((f, idx) => v[f] === val[idx]);
        if (matches) keys.push(k);
      } else if (v[this.keyField] === val) {
        keys.push(k);
      }
    }
    return keys;
  }

  async getAll(val) {
    const results = [];
    for (const v of this.store.records.values()) {
      if (Array.isArray(this.keyField)) {
        const matches = this.keyField.every((f, idx) => v[f] === val[idx]);
        if (matches) results.push({ ...v });
      } else if (v[this.keyField] === val) {
        results.push({ ...v });
      }
    }
    return results;
  }
}

const INDEX_KEY_MAP = {
  user_trip: ['userId', 'tripId'],
  tripId_dayNumber: ['tripId', 'dayNumber'],
  userId: 'userId',
  tripId: 'tripId',
  type: 'type',
  category: 'category',
  createdAt: 'createdAt'
};

class InMemoryObjectStore {
  constructor(name) {
    this.name = name;
    this.records = new Map();
    this.indexes = new Map();
  }

  index(name) {
    if (!this.indexes.has(name)) {
      this.indexes.set(name, new InMemoryIndex(this, INDEX_KEY_MAP[name] || name));
    }
    return this.indexes.get(name);
  }

  async get(key) {
    return this.records.get(key) ? { ...this.records.get(key) } : undefined;
  }

  async put(value) {
    const key = value.id || value.tripId || `id-${Math.random()}`;
    this.records.set(key, { ...value });
    return key;
  }

  async delete(key) {
    this.records.delete(key);
  }

  async getAll() {
    return Array.from(this.records.values()).map(v => ({ ...v }));
  }
}

class InMemoryDb {
  constructor() {
    this.stores = new Map([
      ['trips', new InMemoryObjectStore('trips')],
      ['itineraries', new InMemoryObjectStore('itineraries')],
      ['staysAndTransport', new InMemoryObjectStore('staysAndTransport')],
      ['documents', new InMemoryObjectStore('documents')],
      ['emergencyContacts', new InMemoryObjectStore('emergencyContacts')],
      ['checklists', new InMemoryObjectStore('checklists')],
      ['notes', new InMemoryObjectStore('notes')],
      ['pendingSyncQueue', new InMemoryObjectStore('pendingSyncQueue')],
      ['syncMetadata', new InMemoryObjectStore('syncMetadata')]
    ]);
  }

  async getAllFromIndex(storeName, indexName, val) {
    const store = this.stores.get(storeName);
    return store.index(indexName).getAll(val);
  }

  async get(storeName, key) {
    return this.stores.get(storeName).get(key);
  }

  async put(storeName, val) {
    return this.stores.get(storeName).put(val);
  }

  async delete(storeName, key) {
    return this.stores.get(storeName).delete(key);
  }

  transaction(storeNames, mode) {
    const txStores = this.stores;
    return {
      objectStore(name) {
        return txStores.get(name);
      },
      done: Promise.resolve()
    };
  }
}

let mockDbInstance;

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDbInstance))
}));

import {
  saveOfflineTripPack,
  getOfflineTrips,
  getOfflineTripBundle,
  updateChecklistItemLocal,
  updateNoteLocal,
  updatePlaceNoteLocal,
  getPendingSyncQueue,
  clearPendingSyncItem,
  markPendingSyncItemError,
  deleteOfflineTrip,
  clearAllUserOfflineData,
  estimateStorage
} from '../services/offlineStorage';

describe('offlineStorage.js — IndexedDB Operations & Offline Travel Companion', () => {
  beforeEach(() => {
    mockDbInstance = new InMemoryDb();
    vi.clearAllMocks();
  });

  const samplePack = {
    trip: {
      id: 'trip-101',
      name: 'Himalayan Trek',
      destination: 'Manali, India',
      startDate: '2026-09-10T00:00:00.000Z',
      endDate: '2026-09-16T00:00:00.000Z',
      status: 'upcoming'
    },
    itinerary: [
      { id: 'place-1', dayNumber: 1, orderIndex: 0, name: 'Solang Valley', category: 'attraction' }
    ],
    staysAndTransport: [
      { id: 'stay-1', name: 'Pine View Resort', type: 'hotel', bookingRef: 'PV-9912' }
    ],
    documents: [
      { id: 'doc-1', name: 'Permit_Pass.pdf', size: 54000 }
    ],
    emergencyContacts: [
      { id: 'emg-1', name: 'Local Mountain Rescue', phone: '112', relationship: 'Emergency' }
    ],
    checklists: [
      { id: 'chk-1', title: 'Trekking Boots', category: 'Gear', completed: false }
    ],
    notes: [
      { id: 'note-1', title: 'High Altitude Prep', content: 'Drink 3L water daily' }
    ]
  };

  it('saves an offline trip pack atomically to IndexedDB', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    const trips = await getOfflineTrips('user-alpha');
    expect(trips.length).toBe(1);
    expect(trips[0].tripId).toBe('trip-101');
    expect(trips[0].name).toBe('Himalayan Trek');
    expect(trips[0].isAvailableOffline).toBe(true);
    expect(trips[0].downloadedAt).toBeDefined();

    const bundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    expect(bundle).not.toBeNull();
    expect(bundle.trip.id).toBe('trip-101');
    expect(bundle.itinerary.length).toBe(1);
    expect(bundle.staysAndTransport.length).toBe(1);
    expect(bundle.emergencyContacts.length).toBe(1);
    expect(bundle.checklists.length).toBe(1);
    expect(bundle.notes.length).toBe(1);
  });

  it('rejects saving when userId or trip payload is missing', async () => {
    await expect(saveOfflineTripPack(null, samplePack)).rejects.toThrow('User ID is required');
    await expect(saveOfflineTripPack('user-alpha', null)).rejects.toThrow('Invalid trip pack');
  });

  it('isolates user data so User B cannot see User A trips', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    const alphaTrips = await getOfflineTrips('user-alpha');
    expect(alphaTrips.length).toBe(1);

    const betaTrips = await getOfflineTrips('user-beta');
    expect(betaTrips.length).toBe(0);

    const betaBundle = await getOfflineTripBundle('user-beta', 'trip-101');
    expect(betaBundle).toBeNull();
  });

  it('updates checklist items locally and records a pending sync queue item', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    await updateChecklistItemLocal('user-alpha', 'trip-101', 'chk-1', true);

    const bundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    expect(bundle.checklists[0].completed).toBe(true);

    const queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(1);
    expect(queue[0].recordType).toBe('checklist');
    expect(queue[0].payload.completed).toBe(true);
  });

  it('updates travel notes locally and queues them for synchronization', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    await updateNoteLocal('user-alpha', 'trip-101', 'note-1', 'Updated trail guide details');

    const bundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    expect(bundle.notes[0].content).toBe('Updated trail guide details');

    const queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(1);
    expect(queue[0].recordType).toBe('note');
    expect(queue[0].payload.content).toBe('Updated trail guide details');
  });

  it('clears pending sync items once synchronization succeeds', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);
    await updateChecklistItemLocal('user-alpha', 'trip-101', 'chk-1', true);

    let queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(1);

    await clearPendingSyncItem(queue[0].id);

    queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(0);
  });

  it('deletes an offline trip while preserving unrelated offline trips', async () => {
    const secondPack = {
      trip: {
        id: 'trip-202',
        name: 'Goa Coastal Getaway',
        destination: 'Goa, India',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-05T00:00:00.000Z'
      },
      itinerary: [],
      staysAndTransport: [],
      documents: [],
      emergencyContacts: [],
      checklists: [],
      notes: []
    };

    await saveOfflineTripPack('user-alpha', samplePack);
    await saveOfflineTripPack('user-alpha', secondPack);

    let trips = await getOfflineTrips('user-alpha');
    expect(trips.length).toBe(2);

    await deleteOfflineTrip('user-alpha', 'trip-101');

    trips = await getOfflineTrips('user-alpha');
    expect(trips.length).toBe(1);
    expect(trips[0].tripId).toBe('trip-202');

    const deletedBundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    expect(deletedBundle).toBeNull();
  });

  it('clears all user offline data cleanly upon logout / account switch', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    let trips = await getOfflineTrips('user-alpha');
    expect(trips.length).toBe(1);

    await clearAllUserOfflineData('user-alpha');

    trips = await getOfflineTrips('user-alpha');
    expect(trips.length).toBe(0);
  });

  it('isolates offline records when two users download the same trip on the same browser', async () => {
    // Both user A and user B save trip-101
    await saveOfflineTripPack('user-alpha', samplePack);
    await saveOfflineTripPack('user-beta', samplePack);

    const alphaTrips = await getOfflineTrips('user-alpha');
    const betaTrips = await getOfflineTrips('user-beta');

    expect(alphaTrips.length).toBe(1);
    expect(betaTrips.length).toBe(1);
    expect(alphaTrips[0].tripId).toBe('trip-101');
    expect(betaTrips[0].tripId).toBe('trip-101');

    // Both can independently access their bundle
    const alphaBundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    const betaBundle = await getOfflineTripBundle('user-beta', 'trip-101');
    expect(alphaBundle).not.toBeNull();
    expect(betaBundle).not.toBeNull();

    // User A deleting trip-101 does NOT remove User B's trip or places
    await deleteOfflineTrip('user-alpha', 'trip-101');

    const alphaAfter = await getOfflineTripBundle('user-alpha', 'trip-101');
    const betaAfter = await getOfflineTripBundle('user-beta', 'trip-101');

    expect(alphaAfter).toBeNull();
    expect(betaAfter).not.toBeNull();
    expect(betaAfter.trip.tripId).toBe('trip-101');
    expect(betaAfter.itinerary.length).toBe(1);
  });

  it('updates place notes locally and enqueues place_note operation', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);

    const success = await updatePlaceNoteLocal('user-alpha', 'trip-101', 'place-1', 'Scenic viewpoint at sunrise');
    expect(success).toBe(true);

    const bundle = await getOfflineTripBundle('user-alpha', 'trip-101');
    expect(bundle.itinerary[0].note).toBe('Scenic viewpoint at sunrise');

    const queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(1);
    expect(queue[0].recordType).toBe('place_note');
    expect(queue[0].placeId).toBe('place-1');
    expect(queue[0].payload.note).toBe('Scenic viewpoint at sunrise');
  });

  it('preserves failed sync items and records error information', async () => {
    await saveOfflineTripPack('user-alpha', samplePack);
    await updateChecklistItemLocal('user-alpha', 'trip-101', 'chk-1', true);

    const queue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(queue.length).toBe(1);
    const item = queue[0];

    await markPendingSyncItemError(item.id, 'UNSUPPORTED_OPERATION: Checklists are local only');

    const updatedQueue = await getPendingSyncQueue('user-alpha', 'trip-101');
    expect(updatedQueue.length).toBe(1);
    expect(updatedQueue[0].lastError).toContain('UNSUPPORTED_OPERATION');
    expect(updatedQueue[0].retryCount).toBe(1);
  });

  it('estimates storage usage gracefully even if navigator.storage is unsupported', async () => {
    const est = await estimateStorage();
    expect(est).toBeDefined();
    expect(typeof est.usage).toBe('number');
    expect(typeof est.quota).toBe('number');
    expect(typeof est.percentage).toBe('number');
  });
});
