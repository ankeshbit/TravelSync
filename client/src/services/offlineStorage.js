/**
 * TravelSync IndexedDB Offline Storage Layer
 * Powered by 'idb' with atomic transactions, multi-user account isolation,
 * versioned schema migrations, and reliable offline-first persistence.
 */

import { openDB } from 'idb';

export const DB_NAME = 'TravelSyncOfflineDB';
export const DB_VERSION = 2;

/**
 * Creates compound key string for scoped primary storage keys
 */
export function createScopedKey(userId, ...parts) {
  return [userId, ...parts].join('::');
}

/**
 * Open database connection with schema creation and migration
 */
export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 1. Trips Store
      let tripStore;
      if (!db.objectStoreNames.contains('trips')) {
        tripStore = db.createObjectStore('trips', { keyPath: 'id' });
      } else {
        tripStore = transaction.objectStore('trips');
      }
      if (!tripStore.indexNames.contains('userId')) {
        tripStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!tripStore.indexNames.contains('user_trip')) {
        tripStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!tripStore.indexNames.contains('destination')) {
        tripStore.createIndex('destination', 'destination', { unique: false });
      }
      if (!tripStore.indexNames.contains('downloadedAt')) {
        tripStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // 2. Itineraries (Places) Store
      let itinStore;
      if (!db.objectStoreNames.contains('itineraries')) {
        itinStore = db.createObjectStore('itineraries', { keyPath: 'id' });
      } else {
        itinStore = transaction.objectStore('itineraries');
      }
      if (!itinStore.indexNames.contains('user_trip')) {
        itinStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!itinStore.indexNames.contains('userId')) {
        itinStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!itinStore.indexNames.contains('tripId')) {
        itinStore.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!itinStore.indexNames.contains('tripId_dayNumber')) {
        itinStore.createIndex('tripId_dayNumber', ['tripId', 'dayNumber'], { unique: false });
      }

      // 3. Stays and Transport Store (Hotels, Flights, Trains, etc.)
      let stayStore;
      if (!db.objectStoreNames.contains('staysAndTransport')) {
        stayStore = db.createObjectStore('staysAndTransport', { keyPath: 'id' });
      } else {
        stayStore = transaction.objectStore('staysAndTransport');
      }
      if (!stayStore.indexNames.contains('user_trip')) {
        stayStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!stayStore.indexNames.contains('userId')) {
        stayStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!stayStore.indexNames.contains('tripId')) {
        stayStore.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!stayStore.indexNames.contains('type')) {
        stayStore.createIndex('type', 'type', { unique: false });
      }

      // 4. Documents & Tickets Store
      let docStore;
      if (!db.objectStoreNames.contains('documents')) {
        docStore = db.createObjectStore('documents', { keyPath: 'id' });
      } else {
        docStore = transaction.objectStore('documents');
      }
      if (!docStore.indexNames.contains('user_trip')) {
        docStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!docStore.indexNames.contains('userId')) {
        docStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!docStore.indexNames.contains('tripId')) {
        docStore.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!docStore.indexNames.contains('docType')) {
        docStore.createIndex('docType', 'docType', { unique: false });
      }

      // 5. Emergency Contacts Store
      let emStore;
      if (!db.objectStoreNames.contains('emergencyContacts')) {
        emStore = db.createObjectStore('emergencyContacts', { keyPath: 'id' });
      } else {
        emStore = transaction.objectStore('emergencyContacts');
      }
      if (!emStore.indexNames.contains('user_trip')) {
        emStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!emStore.indexNames.contains('userId')) {
        emStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!emStore.indexNames.contains('tripId')) {
        emStore.createIndex('tripId', 'tripId', { unique: false });
      }

      // 6. Checklists Store (Packing & To-dos)
      let chkStore;
      if (!db.objectStoreNames.contains('checklists')) {
        chkStore = db.createObjectStore('checklists', { keyPath: 'id' });
      } else {
        chkStore = transaction.objectStore('checklists');
      }
      if (!chkStore.indexNames.contains('user_trip')) {
        chkStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!chkStore.indexNames.contains('userId')) {
        chkStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!chkStore.indexNames.contains('tripId')) {
        chkStore.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!chkStore.indexNames.contains('category')) {
        chkStore.createIndex('category', 'category', { unique: false });
      }

      // 7. Travel Notes Store
      let notesStore;
      if (!db.objectStoreNames.contains('notes')) {
        notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      } else {
        notesStore = transaction.objectStore('notes');
      }
      if (!notesStore.indexNames.contains('user_trip')) {
        notesStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!notesStore.indexNames.contains('userId')) {
        notesStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!notesStore.indexNames.contains('tripId')) {
        notesStore.createIndex('tripId', 'tripId', { unique: false });
      }

      // 8. Pending Synchronization Queue
      let queueStore;
      if (!db.objectStoreNames.contains('pendingSyncQueue')) {
        queueStore = db.createObjectStore('pendingSyncQueue', { keyPath: 'id' });
      } else {
        queueStore = transaction.objectStore('pendingSyncQueue');
      }
      if (!queueStore.indexNames.contains('user_trip')) {
        queueStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!queueStore.indexNames.contains('userId')) {
        queueStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!queueStore.indexNames.contains('tripId')) {
        queueStore.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!queueStore.indexNames.contains('createdAt')) {
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 9. Sync & Download Metadata
      let metaStore;
      if (!db.objectStoreNames.contains('syncMetadata')) {
        metaStore = db.createObjectStore('syncMetadata', { keyPath: 'id' });
      } else {
        metaStore = transaction.objectStore('syncMetadata');
      }
      if (!metaStore.indexNames.contains('user_trip')) {
        metaStore.createIndex('user_trip', ['userId', 'tripId'], { unique: false });
      }
      if (!metaStore.indexNames.contains('userId')) {
        metaStore.createIndex('userId', 'userId', { unique: false });
      }
    },
    blocked() {
      console.warn('[OfflineStorage] IndexedDB upgrade blocked by an open connection in another tab.');
    },
    blocking() {
      console.warn('[OfflineStorage] Database connection closing to permit upgrade in another tab.');
    },
    terminated() {
      console.error('[OfflineStorage] Database connection abnormally terminated.');
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
 * All records are strictly scoped to userId to ensure multi-account isolation.
 */
export async function saveOfflineTripPack(userId, pack) {
  if (!userId) throw new Error('Cannot save offline trip: User ID is required.');
  if (!pack || !pack.trip || !pack.trip.id) throw new Error('Invalid trip pack payload.');

  const db = await getDb();
  const tripId = pack.trip.id;
  const now = new Date().toISOString();

  // Calculate approximate data size
  const totalSizeBytes = estimateObjectSize(pack);

  // Normalize trip record with scoped primary key
  const scopedTripId = createScopedKey(userId, tripId);
  const tripRecord = {
    ...pack.trip,
    id: scopedTripId,
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
    'pendingSyncQueue',
    'syncMetadata'
  ], 'readwrite');

  try {
    // 1. Put trip
    await tx.objectStore('trips').put(tripRecord);

    // ─── Collect all pending sync record IDs so we never delete locally-edited records ───
    const pendingQueue = tx.objectStore('pendingSyncQueue');
    const pendingItems = await pendingQueue.index('user_trip').getAll([userId, tripId]);
    const pendingEntityIds = new Set(pendingItems.map(p => p.entityId || p.recordId).filter(Boolean));

    // 2. Merge itinerary places — preserve locally-edited records; replace others
    const itinStore = tx.objectStore('itineraries');
    const oldItinKeys = await itinStore.index('user_trip').getAllKeys([userId, tripId]);
    const existingItinItems = await itinStore.index('user_trip').getAll([userId, tripId]);
    const localItinMap = new Map(existingItinItems.map(i => [i.originalId || i.placeId, i]));

    for (const key of oldItinKeys) {
      // Only remove records that have no pending local edits
      const record = await itinStore.get(key);
      const origId = record?.originalId || record?.placeId;
      if (!record?.isLocalEdit && !pendingEntityIds.has(origId)) {
        await itinStore.delete(key);
      }
    }
    if (Array.isArray(pack.itinerary)) {
      for (const item of pack.itinerary) {
        if (!item.id) continue; // skip items without stable IDs to avoid random keys
        const rawItemId = item.id;
        const existing = localItinMap.get(rawItemId);
        // If there is a pending edit for this record, preserve local note; server data wins for everything else
        const mergedNote = (existing?.isLocalEdit && pendingEntityIds.has(rawItemId))
          ? existing.note
          : item.note;
        await itinStore.put({
          ...item,
          note: mergedNote,
          id: createScopedKey(userId, tripId, rawItemId),
          placeId: rawItemId,
          originalId: rawItemId,
          tripId,
          userId,
          isLocalEdit: existing?.isLocalEdit && pendingEntityIds.has(rawItemId) ? true : undefined
        });
      }
    }

    // 3. Stays and Transport — safe replace (no local edits possible)
    const stayStore = tx.objectStore('staysAndTransport');
    const oldStayKeys = await stayStore.index('user_trip').getAllKeys([userId, tripId]);
    for (const key of oldStayKeys) {
      await stayStore.delete(key);
    }
    if (Array.isArray(pack.staysAndTransport)) {
      for (const item of pack.staysAndTransport) {
        if (!item.id) continue;
        await stayStore.put({
          ...item,
          id: createScopedKey(userId, tripId, item.id),
          originalId: item.id,
          tripId,
          userId
        });
      }
    }

    // 4. Documents — safe replace (no local edits possible; server always returns empty array)
    const docStore = tx.objectStore('documents');
    const oldDocKeys = await docStore.index('user_trip').getAllKeys([userId, tripId]);
    for (const key of oldDocKeys) {
      await docStore.delete(key);
    }
    if (Array.isArray(pack.documents)) {
      for (const doc of pack.documents) {
        if (!doc.id) continue;
        await docStore.put({
          ...doc,
          id: createScopedKey(userId, tripId, doc.id),
          originalId: doc.id,
          tripId,
          userId
        });
      }
    }

    // 5. Emergency Contacts — safe replace
    const emStore = tx.objectStore('emergencyContacts');
    const oldEmKeys = await emStore.index('user_trip').getAllKeys([userId, tripId]);
    for (const key of oldEmKeys) {
      await emStore.delete(key);
    }
    if (Array.isArray(pack.emergencyContacts)) {
      for (const contact of pack.emergencyContacts) {
        if (!contact.id) continue;
        await emStore.put({
          ...contact,
          id: createScopedKey(userId, tripId, contact.id),
          originalId: contact.id,
          tripId,
          userId
        });
      }
    }

    // 6. Checklists — preserve local completion state; server data is the authoritative template list
    //    Checklists are DEVICE-LOCAL ONLY: no sync queue entries are created for them.
    const chkStore = tx.objectStore('checklists');
    const existingChecklistItems = await chkStore.index('user_trip').getAll([userId, tripId]);
    const completedMap = new Map();
    for (const item of existingChecklistItems) {
      const origId = item.originalId || item.id;
      completedMap.set(origId, { completed: item.isCompleted || item.completed || false });
    }

    const oldChkKeys = await chkStore.index('user_trip').getAllKeys([userId, tripId]);
    for (const key of oldChkKeys) {
      await chkStore.delete(key);
    }
    if (Array.isArray(pack.checklists)) {
      for (const item of pack.checklists) {
        if (!item.id) continue;
        const rawItemId = item.id;
        const localState = completedMap.get(rawItemId);
        const isCompleted = localState !== undefined
          ? localState.completed
          : Boolean(item.completed || item.isCompleted);
        await chkStore.put({
          ...item,
          id: createScopedKey(userId, tripId, rawItemId),
          originalId: rawItemId,
          tripId,
          userId,
          completed: isCompleted,
          isCompleted
          // Note: isLocalEdit intentionally NOT set — checklists are device-only, no sync queue
        });
      }
    }

    // 7. Travel Notes — preserve pending local edits; replace synced records
    const notesStore = tx.objectStore('notes');
    const existingNotes = await notesStore.index('user_trip').getAll([userId, tripId]);
    const localNoteMap = new Map(existingNotes.map(n => [n.originalId, n]));
    const oldNoteKeys = await notesStore.index('user_trip').getAllKeys([userId, tripId]);
    for (const key of oldNoteKeys) {
      const record = await notesStore.get(key);
      if (!record?.isLocalEdit && !pendingEntityIds.has(record?.originalId)) {
        await notesStore.delete(key);
      }
    }
    if (Array.isArray(pack.notes)) {
      for (const note of pack.notes) {
        if (!note.id) continue;
        const rawNoteId = note.id;
        const existing = localNoteMap.get(rawNoteId);
        // Skip server update if record has unsynced local edits
        if (existing?.isLocalEdit && pendingEntityIds.has(rawNoteId)) {
          continue;
        }
        await notesStore.put({
          ...note,
          id: createScopedKey(userId, tripId, rawNoteId),
          originalId: rawNoteId,
          tripId,
          userId
        });
      }
    }

    // 8. Update sync metadata
    const metaStore = tx.objectStore('syncMetadata');
    await metaStore.put({
      id: scopedTripId,
      tripId,
      userId,
      lastSyncedAt: now,
      lastDownloadSizeBytes: totalSizeBytes,
      status: 'synced',
      version: DB_VERSION
    });

    await tx.done;

    return {
      success: true,
      tripId,
      downloadedAt: now,
      dataSizeBytes: totalSizeBytes
    };
  } catch (err) {
    try { tx.abort(); } catch {}
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
  return userTrips.map(t => ({
    ...t,
    id: t.tripId || t.id,
    scopedId: t.id
  }));
}

/**
 * Check if a specific trip is downloaded for the user
 */
export async function isTripAvailableOffline(userId, tripId) {
  if (!userId || !tripId) return false;
  const db = await getDb();
  const scopedKey = createScopedKey(userId, tripId);
  const trip = await db.get('trips', scopedKey);
  return Boolean(trip && trip.userId === userId);
}

/**
 * Fetch full offline bundle for a saved trip scoped strictly to userId
 */
export async function getOfflineTripBundle(userId, tripId) {
  if (!userId || !tripId) return null;
  const db = await getDb();

  const scopedKey = createScopedKey(userId, tripId);
  const trip = await db.get('trips', scopedKey);
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
    db.getAllFromIndex('itineraries', 'user_trip', [userId, tripId]),
    db.getAllFromIndex('staysAndTransport', 'user_trip', [userId, tripId]),
    db.getAllFromIndex('documents', 'user_trip', [userId, tripId]),
    db.getAllFromIndex('emergencyContacts', 'user_trip', [userId, tripId]),
    db.getAllFromIndex('checklists', 'user_trip', [userId, tripId]),
    db.getAllFromIndex('notes', 'user_trip', [userId, tripId]),
    db.get('syncMetadata', scopedKey)
  ]);

  const normalizeItem = item => ({
    ...item,
    id: item.originalId || item.placeId || item.id,
    scopedId: item.id
  });

  return {
    trip: {
      ...trip,
      id: trip.tripId || trip.id,
      scopedId: trip.id
    },
    itinerary: (itinerary || []).map(normalizeItem).sort((a, b) => (a.dayNumber - b.dayNumber) || (a.orderIndex - b.orderIndex)),
    staysAndTransport: (staysAndTransport || []).map(normalizeItem),
    documents: (documents || []).map(normalizeItem),
    emergencyContacts: (emergencyContacts || []).map(normalizeItem),
    checklists: (checklists || []).map(normalizeItem),
    notes: (notes || []).map(normalizeItem),
    metadata: metadata || null
  };
}

/**
 * Update checklist item status locally.
 * DEVICE-LOCAL ONLY: Checklists are not synchronized to the server because the server
 * has no checklist persistence model. Changes are saved in IndexedDB and reflected
 * in the UI immediately but are not added to the pendingSyncQueue.
 */
export async function updateChecklistItemLocal(userId, tripId, rawItemId, isCompleted) {
  if (!userId || !tripId || !rawItemId) return false;
  const db = await getDb();
  // Only open the checklists store — no pendingSyncQueue needed (device-only)
  const tx = db.transaction(['checklists'], 'readwrite');

  const scopedKey = createScopedKey(userId, tripId, rawItemId);
  let item = await tx.objectStore('checklists').get(scopedKey);
  if (!item) {
    // Fallback: check by raw ID matching this user and trip
    const all = await tx.objectStore('checklists').index('user_trip').getAll([userId, tripId]);
    item = all.find(i => i.originalId === rawItemId || i.id === rawItemId);
  }

  if (!item || item.userId !== userId) {
    try { tx.abort(); } catch {}
    return false;
  }

  const updatedItem = {
    ...item,
    isCompleted,
    completed: isCompleted,
    updatedAt: new Date().toISOString()
    // Deliberately NOT setting isLocalEdit — checklists are device-only, no sync
  };

  await tx.objectStore('checklists').put(updatedItem);
  await tx.done;
  return true;
}

/**
 * Save or update a travel note locally and register pending sync action
 */
export async function updateNoteLocal(userId, tripId, rawNoteId, titleOrContent, maybeContent) {
  if (!userId || !tripId || !rawNoteId) return false;
  const db = await getDb();
  const tx = db.transaction(['notes', 'pendingSyncQueue'], 'readwrite');

  let title = titleOrContent;
  let content = maybeContent;
  if (maybeContent === undefined) {
    content = titleOrContent;
    title = '';
  }

  const scopedKey = createScopedKey(userId, tripId, rawNoteId);
  let existing = await tx.objectStore('notes').get(scopedKey);
  if (!existing) {
    const all = await tx.objectStore('notes').index('user_trip').getAll([userId, tripId]);
    existing = all.find(n => n.originalId === rawNoteId || n.id === rawNoteId);
  }

  const noteTitle = (title || existing?.title || 'Travel Note').trim();
  const noteContent = (content || existing?.content || '').trim();
  const now = new Date().toISOString();

  const noteRecord = {
    ...(existing || {}),
    id: existing?.id || scopedKey,
    originalId: rawNoteId,
    userId,
    tripId,
    title: noteTitle,
    content: noteContent,
    updatedAt: now,
    isLocalEdit: true
  };

  await tx.objectStore('notes').put(noteRecord);

  // Enqueue pending sync action
  const syncOpId = `sync_note_${rawNoteId}_${Date.now()}`;
  await tx.objectStore('pendingSyncQueue').put({
    id: createScopedKey(userId, syncOpId),
    queueKey: syncOpId,
    userId,
    tripId,
    entityType: 'note',
    recordType: existing?.placeId ? 'place_note' : 'note',
    placeId: existing?.placeId || undefined,
    entityId: rawNoteId,
    recordId: rawNoteId,
    action: 'update',
    payload: { title: noteTitle, content: noteContent, note: noteContent, placeId: existing?.placeId, updatedAt: now },
    createdAt: now,
    retryCount: 0
  });

  await tx.done;
  return true;
}

/**
 * Update place note directly on an itinerary spot locally and register pending sync action
 */
export async function updatePlaceNoteLocal(userId, tripId, rawPlaceId, note) {
  if (!userId || !tripId || !rawPlaceId) return false;
  const db = await getDb();
  const tx = db.transaction(['itineraries', 'pendingSyncQueue'], 'readwrite');

  const scopedKey = createScopedKey(userId, tripId, rawPlaceId);
  let place = await tx.objectStore('itineraries').get(scopedKey);
  if (!place) {
    const all = await tx.objectStore('itineraries').index('user_trip').getAll([userId, tripId]);
    place = all.find(p => p.originalId === rawPlaceId || p.placeId === rawPlaceId || p.id === rawPlaceId);
  }

  if (!place || place.userId !== userId) {
    try { tx.abort(); } catch {}
    return false;
  }

  const sanitizedNote = (note || '').trim();
  const updatedPlace = {
    ...place,
    note: sanitizedNote,
    updatedAt: new Date().toISOString(),
    isLocalEdit: true
  };

  await tx.objectStore('itineraries').put(updatedPlace);

  // Enqueue pending sync action
  const syncOpId = `sync_place_${rawPlaceId}_${Date.now()}`;
  await tx.objectStore('pendingSyncQueue').put({
    id: createScopedKey(userId, syncOpId),
    queueKey: syncOpId,
    userId,
    tripId,
    entityType: 'place_note',
    recordType: 'place_note',
    placeId: rawPlaceId,
    entityId: rawPlaceId,
    recordId: rawPlaceId,
    action: 'update_place_note',
    payload: { placeId: rawPlaceId, note: sanitizedNote },
    createdAt: new Date().toISOString(),
    retryCount: 0
  });

  await tx.done;
  return true;
}

/**
 * Get all pending sync items for user, optionally scoped to a trip
 */
export async function getPendingSyncQueue(userId, tripId = null) {
  if (!userId) return [];
  const db = await getDb();
  if (tripId) {
    return db.getAllFromIndex('pendingSyncQueue', 'user_trip', [userId, tripId]);
  }
  return db.getAllFromIndex('pendingSyncQueue', 'userId', userId);
}

/**
 * Clear a successfully synchronized item from the pending queue
 */
export async function clearPendingSyncItem(queueId) {
  if (!queueId) return;
  const db = await getDb();
  return db.delete('pendingSyncQueue', queueId);
}

/**
 * Mark a pending sync item with failure details to preserve user data without loss.
 * For retryable errors (network, server error), increments retryCount.
 * For permanent errors (UNSUPPORTED_OPERATION, schema mismatch), sets isPermanentFailure flag.
 */
export async function markPendingSyncItemError(queueId, errorMsg, isPermanent = false) {
  if (!queueId) return;
  const db = await getDb();
  const item = await db.get('pendingSyncQueue', queueId);
  if (!item) return;

  item.lastError = errorMsg || 'Sync failed';
  item.retryCount = (item.retryCount || 0) + 1;
  item.lastAttemptAt = new Date().toISOString();
  if (isPermanent) {
    item.isPermanentFailure = true;
  }

  return db.put('pendingSyncQueue', item);
}

/**
 * Delete a single trip's offline data completely for the specified user ONLY.
 * Guarantees that deleting User A's trip never removes or corrupts User B's records.
 */
export async function deleteOfflineTrip(userId, tripId) {
  if (!userId || !tripId) return false;
  const db = await getDb();

  const scopedTripKey = createScopedKey(userId, tripId);
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
    // Delete user's trip header and metadata
    await tx.objectStore('trips').delete(scopedTripKey);
    await tx.objectStore('syncMetadata').delete(scopedTripKey);

    // Delete associated items belonging to [userId, tripId]
    const stores = ['itineraries', 'staysAndTransport', 'documents', 'emergencyContacts', 'checklists', 'notes', 'pendingSyncQueue'];
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      const keys = await store.index('user_trip').getAllKeys([userId, tripId]);
      for (const k of keys) {
        await store.delete(k);
      }
    }

    await tx.done;
    return true;
  } catch (err) {
    try { tx.abort(); } catch {}
    console.error('[OfflineStorage] Error deleting offline trip:', err);
    throw err;
  }
}

/**
 * Clear all offline data belonging to a user (e.g. on sign out or user switch).
 * Safely covers every object store without touching other accounts' records.
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
    const allStores = [
      'trips',
      'itineraries',
      'staysAndTransport',
      'documents',
      'emergencyContacts',
      'checklists',
      'notes',
      'pendingSyncQueue',
      'syncMetadata'
    ];

    for (const storeName of allStores) {
      const store = tx.objectStore(storeName);
      const keys = await store.index('userId').getAllKeys(userId);
      for (const k of keys) {
        await store.delete(k);
      }
    }

    await tx.done;
    console.log(`[OfflineStorage] Wiped all offline records for user: ${userId}`);
  } catch (err) {
    try { tx.abort(); } catch {}
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
