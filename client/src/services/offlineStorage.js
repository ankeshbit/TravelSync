/**
 * TravelSync IndexedDB Offline Storage Layer
 * Powered by 'idb' with atomic transactions, user data isolation, and versioned schema.
 */

import { openDB } from 'idb';

const DB_NAME = 'TravelSyncOfflineDB';
const DB_VERSION = 1;

/**
 * Open database connection with schema migration
 */
export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 1. Trips Store
      if (!db.objectStoreNames.contains('trips')) {
        const tripStore = db.createObjectStore('trips', { keyPath: 'id' });
        tripStore.createIndex('userId', 'userId', { unique: false });
        tripStore.createIndex('destination', 'destination', { unique: false });
        tripStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // 2. Itineraries (Places) Store
      if (!db.objectStoreNames.contains('itineraries')) {
        const itinStore = db.createObjectStore('itineraries', { keyPath: 'id' });
        itinStore.createIndex('tripId', 'tripId', { unique: false });
        itinStore.createIndex('tripId_dayNumber', ['tripId', 'dayNumber'], { unique: false });
      }

      // 3. Stays and Transport Store (Hotels, Flights, Trains, etc.)
      if (!db.objectStoreNames.contains('staysAndTransport')) {
        const stayStore = db.createObjectStore('staysAndTransport', { keyPath: 'id' });
        stayStore.createIndex('tripId', 'tripId', { unique: false });
        stayStore.createIndex('type', 'type', { unique: false });
      }

      // 4. Documents & Tickets Store
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('tripId', 'tripId', { unique: false });
        docStore.createIndex('userId', 'userId', { unique: false });
        docStore.createIndex('docType', 'docType', { unique: false });
      }

      // 5. Emergency Contacts Store
      if (!db.objectStoreNames.contains('emergencyContacts')) {
        const emStore = db.createObjectStore('emergencyContacts', { keyPath: 'id' });
        emStore.createIndex('tripId', 'tripId', { unique: false });
        emStore.createIndex('userId', 'userId', { unique: false });
      }

      // 6. Checklists Store (Packing & To-dos)
      if (!db.objectStoreNames.contains('checklists')) {
        const chkStore = db.createObjectStore('checklists', { keyPath: 'id' });
        chkStore.createIndex('tripId', 'tripId', { unique: false });
        chkStore.createIndex('userId', 'userId', { unique: false });
        chkStore.createIndex('category', 'category', { unique: false });
      }

      // 7. Travel Notes Store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('tripId', 'tripId', { unique: false });
        notesStore.createIndex('userId', 'userId', { unique: false });
      }

      // 8. Pending Synchronization Queue
      if (!db.objectStoreNames.contains('pendingSyncQueue')) {
        const queueStore = db.createObjectStore('pendingSyncQueue', { keyPath: 'id' });
        queueStore.createIndex('userId', 'userId', { unique: false });
        queueStore.createIndex('tripId', 'tripId', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 9. Sync & Download Metadata
      if (!db.objectStoreNames.contains('syncMetadata')) {
        const metaStore = db.createObjectStore('syncMetadata', { keyPath: 'tripId' });
        metaStore.createIndex('userId', 'userId', { unique: false });
      }
    }
  });
}

/**
 * Calculates rough size in bytes of a serialized object
 */
export function estimateObjectSize(obj) {
  try {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  } catch {
    return 1024;
  }
}

/**
 * Saves a complete trip package to IndexedDB inside an atomic transaction.
 */
export async function saveOfflineTripPack(userId, pack) {
  if (!userId) throw new Error('Cannot save offline trip: User ID is required.');
  if (!pack || !pack.trip || !pack.trip.id) throw new Error('Invalid trip pack payload.');

  const db = await getDb();
  const tripId = pack.trip.id;
  const now = new Date().toISOString();

  // Calculate approximate data size
  const totalSizeBytes = estimateObjectSize(pack);

  // Normalize trip record
  const tripRecord = {
    ...pack.trip,
    id: tripId,
    tripId,
    userId,
    downloadedAt: now,
    lastSyncedAt: now,
    dataSizeBytes: totalSizeBytes,
    isAvailableOffline: true
  };

  const tx = db.transaction([
    'trips',
    'itineraries',
    'staysAndTransport',
    'documents',
    'emergencyContacts',
    'checklists',
    'notes',
    'syncMetadata'
  ], 'readwrite');

  try {
    // 1. Put trip
    await tx.objectStore('trips').put(tripRecord);

    // 2. Put itinerary places
    const itinStore = tx.objectStore('itineraries');
    // Clear previous places for this trip to prevent duplicates
    const oldItinKeys = await itinStore.index('tripId').getAllKeys(tripId);
    for (const key of oldItinKeys) {
      await itinStore.delete(key);
    }
    if (Array.isArray(pack.itinerary)) {
      for (const item of pack.itinerary) {
        await itinStore.put({
          ...item,
          tripId,
          userId
        });
      }
    }

    // 3. Stays and Transport
    const stayStore = tx.objectStore('staysAndTransport');
    const oldStayKeys = await stayStore.index('tripId').getAllKeys(tripId);
    for (const key of oldStayKeys) {
      await stayStore.delete(key);
    }
    if (Array.isArray(pack.staysAndTransport)) {
      for (const item of pack.staysAndTransport) {
        await stayStore.put({
          ...item,
          tripId,
          userId
        });
      }
    }

    // 4. Documents & Tickets
    const docStore = tx.objectStore('documents');
    const oldDocKeys = await docStore.index('tripId').getAllKeys(tripId);
    for (const key of oldDocKeys) {
      await docStore.delete(key);
    }
    if (Array.isArray(pack.documents)) {
      for (const doc of pack.documents) {
        await docStore.put({
          ...doc,
          tripId,
          userId
        });
      }
    }

    // 5. Emergency Contacts
    const emStore = tx.objectStore('emergencyContacts');
    const oldEmKeys = await emStore.index('tripId').getAllKeys(tripId);
    for (const key of oldEmKeys) {
      await emStore.delete(key);
    }
    if (Array.isArray(pack.emergencyContacts)) {
      for (const contact of pack.emergencyContacts) {
        await emStore.put({
          ...contact,
          tripId,
          userId
        });
      }
    }

    // 6. Checklists (preserves local completion status if already present)
    const chkStore = tx.objectStore('checklists');
    const existingChecklistItems = await chkStore.index('tripId').getAll(tripId);
    const completedMap = new Map();
    for (const item of existingChecklistItems) {
      if (item.isCompleted) completedMap.set(item.id, true);
    }

    const oldChkKeys = await chkStore.index('tripId').getAllKeys(tripId);
    for (const key of oldChkKeys) {
      await chkStore.delete(key);
    }
    if (Array.isArray(pack.checklists)) {
      for (const item of pack.checklists) {
        await chkStore.put({
          ...item,
          tripId,
          userId,
          isCompleted: completedMap.get(item.id) ?? Boolean(item.isCompleted)
        });
      }
    }

    // 7. Travel Notes
    const notesStore = tx.objectStore('notes');
    const oldNoteKeys = await notesStore.index('tripId').getAllKeys(tripId);
    for (const key of oldNoteKeys) {
      await notesStore.delete(key);
    }
    if (Array.isArray(pack.notes)) {
      for (const note of pack.notes) {
        await notesStore.put({
          ...note,
          tripId,
          userId
        });
      }
    }

    // 8. Update sync metadata
    await tx.objectStore('syncMetadata').put({
      tripId,
      userId,
      lastSyncedAt: now,
      lastDownloadSizeBytes: totalSizeBytes,
      status: 'synced',
      version: 1
    });

    await tx.done;

    return {
      success: true,
      tripId,
      downloadedAt: now,
      dataSizeBytes: totalSizeBytes
    };
  } catch (err) {
    tx.abort();
    console.error('[OfflineStorage] Error saving trip pack:', err);
    throw err;
  }
}

/**
 * Retrieve all offline trips belonging to a user
 */
export async function getOfflineTrips(userId) {
  if (!userId) return [];
  const db = await getDb();
  const tx = db.transaction('trips', 'readonly');
  const store = tx.objectStore('trips');
  const userTrips = await store.index('userId').getAll(userId);
  await tx.done;
  return userTrips;
}

/**
 * Check if a specific trip is downloaded for the user
 */
export async function isTripAvailableOffline(userId, tripId) {
  if (!userId || !tripId) return false;
  const db = await getDb();
  const trip = await db.get('trips', tripId);
  return Boolean(trip && trip.userId === userId);
}

/**
 * Fetch full offline bundle for a saved trip
 */
export async function getOfflineTripBundle(userId, tripId) {
  if (!userId || !tripId) return null;
  const db = await getDb();

  const trip = await db.get('trips', tripId);
  if (!trip || trip.userId !== userId) {
    return null; // Not found or data isolation guard
  }

  const [
    itinerary,
    staysAndTransport,
    documents,
    emergencyContacts,
    checklists,
    notes,
    metadata
  ] = await Promise.all([
    db.getAllFromIndex('itineraries', 'tripId', tripId),
    db.getAllFromIndex('staysAndTransport', 'tripId', tripId),
    db.getAllFromIndex('documents', 'tripId', tripId),
    db.getAllFromIndex('emergencyContacts', 'tripId', tripId),
    db.getAllFromIndex('checklists', 'tripId', tripId),
    db.getAllFromIndex('notes', 'tripId', tripId),
    db.get('syncMetadata', tripId)
  ]);

  return {
    trip,
    itinerary: (itinerary || []).sort((a, b) => (a.dayNumber - b.dayNumber) || (a.orderIndex - b.orderIndex)),
    staysAndTransport: staysAndTransport || [],
    documents: documents || [],
    emergencyContacts: emergencyContacts || [],
    checklists: checklists || [],
    notes: notes || [],
    metadata: metadata || null
  };
}

/**
 * Update checklist item status offline and register pending sync action
 */
export async function updateChecklistItemLocal(userId, tripId, itemId, isCompleted) {
  if (!userId || !tripId || !itemId) return false;
  const db = await getDb();
  const tx = db.transaction(['checklists', 'pendingSyncQueue'], 'readwrite');

  const item = await tx.objectStore('checklists').get(itemId);
  if (!item || item.userId !== userId) {
    tx.abort();
    return false;
  }

  const updatedItem = {
    ...item,
    isCompleted,
    completed: isCompleted,
    updatedAt: new Date().toISOString(),
    isLocalEdit: true
  };

  await tx.objectStore('checklists').put(updatedItem);

  // Enqueue pending sync action
  const syncOpId = `sync_chk_${itemId}_${Date.now()}`;
  await tx.objectStore('pendingSyncQueue').put({
    id: syncOpId,
    userId,
    tripId,
    entityType: 'checklist',
    recordType: 'checklist',
    entityId: itemId,
    recordId: itemId,
    action: 'toggle',
    payload: { isCompleted, completed: isCompleted },
    createdAt: new Date().toISOString(),
    retryCount: 0
  });

  await tx.done;
  return true;
}

/**
 * Save or update a travel note locally and register pending sync action
 */
export async function updateNoteLocal(userId, tripId, noteId, titleOrContent, maybeContent) {
  if (!userId || !tripId || !noteId) return false;
  const db = await getDb();
  const tx = db.transaction(['notes', 'pendingSyncQueue'], 'readwrite');

  let title = titleOrContent;
  let content = maybeContent;
  if (maybeContent === undefined) {
    content = titleOrContent;
    title = '';
  }

  const existing = await tx.objectStore('notes').get(noteId);
  const noteTitle = (title || existing?.title || 'Travel Note').trim();
  const noteContent = (content || existing?.content || '').trim();

  const now = new Date().toISOString();
  const noteRecord = {
    ...(existing || {}),
    id: noteId,
    userId,
    tripId,
    title: noteTitle,
    content: noteContent,
    updatedAt: now,
    isLocalEdit: true
  };

  await tx.objectStore('notes').put(noteRecord);

  // Enqueue pending sync action
  const syncOpId = `sync_note_${noteId}_${Date.now()}`;
  await tx.objectStore('pendingSyncQueue').put({
    id: syncOpId,
    userId,
    tripId,
    entityType: 'note',
    recordType: 'note',
    entityId: noteId,
    recordId: noteId,
    action: 'update',
    payload: { title: noteTitle, content: noteContent, updatedAt: now },
    createdAt: now,
    retryCount: 0
  });

  await tx.done;
  return true;
}

/**
 * Get all pending sync items for user
 */
export async function getPendingSyncQueue(userId) {
  if (!userId) return [];
  const db = await getDb();
  return db.getAllFromIndex('pendingSyncQueue', 'userId', userId);
}

/**
 * Clear a synced item from pending queue
 */
export async function clearPendingSyncItem(queueId) {
  if (!queueId) return;
  const db = await getDb();
  return db.delete('pendingSyncQueue', queueId);
}

/**
 * Delete a single trip's offline data completely
 */
export async function deleteOfflineTrip(userId, tripId) {
  if (!userId || !tripId) return false;
  const db = await getDb();

  const tx = db.transaction([
    'trips',
    'itineraries',
    'staysAndTransport',
    'documents',
    'emergencyContacts',
    'checklists',
    'notes',
    'pendingSyncQueue',
    'syncMetadata'
  ], 'readwrite');

  try {
    await tx.objectStore('trips').delete(tripId);
    await tx.objectStore('syncMetadata').delete(tripId);

    const stores = ['itineraries', 'staysAndTransport', 'documents', 'emergencyContacts', 'checklists', 'notes', 'pendingSyncQueue'];
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      const keys = await store.index('tripId').getAllKeys(tripId);
      for (const k of keys) {
        await store.delete(k);
      }
    }

    await tx.done;
    return true;
  } catch (err) {
    tx.abort();
    console.error('[OfflineStorage] Error deleting offline trip:', err);
    throw err;
  }
}

/**
 * Clear all offline data belonging to a user (e.g. on sign out or user switch)
 */
export async function clearAllUserOfflineData(userId) {
  if (!userId) return;
  const db = await getDb();

  const tx = db.transaction([
    'trips',
    'itineraries',
    'staysAndTransport',
    'documents',
    'emergencyContacts',
    'checklists',
    'notes',
    'pendingSyncQueue',
    'syncMetadata'
  ], 'readwrite');

  try {
    const storesWithUserIndex = [
      'trips',
      'documents',
      'emergencyContacts',
      'checklists',
      'notes',
      'pendingSyncQueue',
      'syncMetadata'
    ];

    for (const storeName of storesWithUserIndex) {
      const store = tx.objectStore(storeName);
      const keys = await store.index('userId').getAllKeys(userId);
      for (const k of keys) {
        await store.delete(k);
      }
    }

    await tx.done;
    console.log(`[OfflineStorage] Wiped all offline records for user: ${userId}`);
  } catch (err) {
    tx.abort();
    console.error('[OfflineStorage] Error clearing user offline data:', err);
  }
}

/**
 * Estimate storage quota and usage
 */
export async function estimateStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return {
        usage,
        quota,
        percentage: percent,
        usageBytes: usage,
        quotaBytes: quota,
        usageMB: (usage / (1024 * 1024)).toFixed(1),
        quotaMB: (quota / (1024 * 1024)).toFixed(0),
        humanUsage: (usage / (1024 * 1024)).toFixed(1) + ' MB',
        humanQuota: (quota / (1024 * 1024)).toFixed(0) + ' MB',
        percent
      };
    } catch {
      // Fallback
    }
  }

  return {
    usage: 0,
    quota: 0,
    percentage: 0,
    usageBytes: 0,
    quotaBytes: 0,
    usageMB: '0.0',
    quotaMB: 'Unknown',
    humanUsage: '0.0 MB',
    humanQuota: 'Unknown',
    percent: 0
  };
}
