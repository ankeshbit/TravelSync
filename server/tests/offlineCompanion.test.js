const request = require('supertest');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'valid-user-1') {
      return {
        uid: 'firebase-user-1',
        email: 'offline1@example.com',
        name: 'Offline Traveler',
        email_verified: true
      };
    }
    if (token === 'valid-user-2') {
      return {
        uid: 'firebase-user-2',
        email: 'offline2@example.com',
        name: 'Other Traveler',
        email_verified: true
      };
    }
    throw new Error('Invalid token');
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

setupPrismaMock();

const app = require('../server');

describe('Offline Travel Companion API Endpoints', () => {
  let user1;
  let user2;
  let trip1;

  beforeAll(async () => {
    user1 = await prisma.user.create({
      data: {
        firebaseUid: 'firebase-user-1',
        email: 'offline1@example.com',
        name: 'Offline Traveler'
      }
    });

    user2 = await prisma.user.create({
      data: {
        firebaseUid: 'firebase-user-2',
        email: 'offline2@example.com',
        name: 'Other Traveler'
      }
    });

    trip1 = await prisma.trip.create({
      data: {
        name: 'Alpine Expedition',
        destination: 'Interlaken, Switzerland',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-08'),
        ownerId: user1.id,
        budgetPerPerson: 1500,
        currency: 'EUR',
        status: 'upcoming'
      }
    });

    await prisma.tripMember.create({
      data: {
        tripId: trip1.id,
        userId: user1.id
      }
    });

    await prisma.place.create({
      data: {
        tripId: trip1.id,
        name: 'Victoria Jungfrau Grand Hotel',
        address: 'Höheweg 41, Interlaken',
        lat: 46.6863,
        lng: 7.8632,
        dayNumber: 1,
        orderIndex: 0,
        category: 'lodging',
        duration: 60,
        note: 'Check-in voucher ready'
      }
    });

    await prisma.place.create({
      data: {
        tripId: trip1.id,
        name: 'Harder Kulm Funicular',
        address: 'Harderstrasse, Interlaken',
        lat: 46.6967,
        lng: 7.8601,
        dayNumber: 1,
        orderIndex: 1,
        category: 'attraction',
        duration: 120,
        note: 'Sunset panorama views'
      }
    });

    await prisma.expense.create({
      data: {
        tripId: trip1.id,
        title: 'Mountain Train Pass',
        amount: 320,
        currency: 'EUR',
        category: 'transport',
        paidById: user1.id
      }
    });
  });

  describe('GET /api/trips/:tripId/offline-pack', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/trips/${trip1.id}/offline-pack`);
      expect(res.status).toBe(401);
    });

    it('rejects requests from unauthorized non-members with 403', async () => {
      const res = await request(app)
        .get(`/api/trips/${trip1.id}/offline-pack`)
        .set('Authorization', 'Bearer valid-user-2');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('returns 404 if trip does not exist', async () => {
      const res = await request(app)
        .get('/api/trips/00000000-0000-0000-0000-000000000000/offline-pack')
        .set('Authorization', 'Bearer valid-user-1');

      expect(res.status).toBe(404);
    });

    it('returns comprehensive offline trip pack for authorized member', async () => {
      const res = await request(app)
        .get(`/api/trips/${trip1.id}/offline-pack`)
        .set('Authorization', 'Bearer valid-user-1');

      expect(res.status).toBe(200);
      expect(res.body.trip).toBeDefined();
      expect(res.body.trip.name).toBe('Alpine Expedition');
      expect(res.body.trip.destination).toBe('Interlaken, Switzerland');

      // Itinerary validation
      expect(Array.isArray(res.body.itinerary)).toBe(true);
      expect(res.body.itinerary.length).toBe(2);

      // Accommodations & Transport — grounded in real saved places, no fabricated booking refs
      expect(Array.isArray(res.body.staysAndTransport)).toBe(true);
      expect(res.body.staysAndTransport.length).toBe(1);
      const stay = res.body.staysAndTransport[0];
      expect(stay.type).toBe('hotel');
      expect(stay.name).toContain('Victoria Jungfrau Grand Hotel');
      expect(stay.bookingRef).toBeNull(); // No fabricated booking references

      // No fake flights generated
      const flights = res.body.staysAndTransport.filter(s => s.type === 'flight');
      expect(flights.length).toBe(0);

      // Emergency Contacts — no fabricated phone numbers
      expect(Array.isArray(res.body.emergencyContacts)).toBe(true);
      expect(res.body.emergencyContacts.some(c => c.phone === '112')).toBe(true);
      const fakePhones = res.body.emergencyContacts.filter(c => c.phone && c.phone.includes('555-01'));
      expect(fakePhones.length).toBe(0);

      // Checklists
      expect(Array.isArray(res.body.checklists)).toBe(true);
      expect(res.body.checklists.length).toBeGreaterThanOrEqual(5);

      // Travel Notes derived from places
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes.length).toBe(2);

      // Documents — no fake PDF vouchers generated
      expect(Array.isArray(res.body.documents)).toBe(true);
      expect(res.body.documents.length).toBe(0);
      expect(res.body.version).toBe(1);
      expect(res.body.downloadTimestamp).toBeDefined();
    });
  });

  describe('POST /api/trips/:tripId/offline-sync', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .send({ changes: [] });

      expect(res.status).toBe(401);
    });

    it('rejects non-members with 403', async () => {
      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-2')
        .send({ changes: [] });

      expect(res.status).toBe(403);
    });

    it('persists place_note changes to database and returns granular per-operation results', async () => {
      const places = await prisma.place.findMany({ where: { tripId: trip1.id } });
      const targetPlace = places[0];

      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              id: 'op-sync-place-1',
              type: 'place_note',
              placeId: targetPlace.id,
              note: 'Updated notes from mountain trail offline',
              modifiedAt: new Date().toISOString()
            },
            {
              id: 'op-sync-chk-1',
              type: 'checklist_item',
              itemId: `chk-1-${trip1.id}`,
              completed: true,
              modifiedAt: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.syncedCount).toBe(1);
      expect(res.body.failedCount).toBe(1);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(2);

      // Verify place_note succeeded
      const placeResult = res.body.results.find(r => r.id === 'op-sync-place-1');
      expect(placeResult.success).toBe(true);

      // Verify checklist operation was explicitly identified as unsupported
      const chkResult = res.body.results.find(r => r.id === 'op-sync-chk-1');
      expect(chkResult.success).toBe(false);
      expect(chkResult.code).toBe('UNSUPPORTED_OPERATION');

      // Verify DB persistence
      const updatedPlace = await prisma.place.findUnique({ where: { id: targetPlace.id } });
      expect(updatedPlace.note).toBe('Updated notes from mountain trail offline');
    });

    it('rejects invalid placeId with structured failure without crashing or faking success', async () => {
      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              id: 'op-nonexistent-place',
              type: 'place_note',
              placeId: '00000000-0000-0000-0000-000000000000',
              note: 'Should fail gracefully'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.syncedCount).toBe(0);
      expect(res.body.failedCount).toBe(1);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[0].code).toBe('RECORD_NOT_FOUND');
    });

    it('ensures sync is idempotent when retrying previously synced changes', async () => {
      const places = await prisma.place.findMany({ where: { tripId: trip1.id } });
      const targetPlace = places[0];

      // First sync
      const res1 = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              id: 'idempotent-op-1',
              type: 'place_note',
              placeId: targetPlace.id,
              note: 'Confirmed trail conditions'
            }
          ]
        });

      expect(res1.status).toBe(200);
      expect(res1.body.syncedCount).toBe(1);

      // Retry same sync
      const res2 = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              id: 'idempotent-op-1',
              type: 'place_note',
              placeId: targetPlace.id,
              note: 'Confirmed trail conditions'
            }
          ]
        });

      expect(res2.status).toBe(200);
      expect(res2.body.syncedCount).toBe(1);
      const after = await prisma.place.findUnique({ where: { id: targetPlace.id } });
      expect(after.note).toBe('Confirmed trail conditions');
    });

    it('rejects attempt to update a place that belongs to a different trip', async () => {
      // Create another trip with a place
      const tripOther = await prisma.trip.create({
        data: {
          name: 'Other Trip',
          destination: 'Rome',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-05'),
          ownerId: user2.id
        }
      });
      const foreignPlace = await prisma.place.create({
        data: {
          tripId: tripOther.id,
          name: 'Colosseum',
          address: 'Piazza del Colosseo',
          lat: 41.8902,
          lng: 12.4922,
          dayNumber: 1,
          orderIndex: 0
        }
      });

      // User 1 attempts to update foreign place via trip 1
      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              id: 'cross-trip-attack',
              type: 'place_note',
              placeId: foreignPlace.id,
              note: 'Unauthorized note update'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.syncedCount).toBe(0);
      expect(res.body.failedCount).toBe(1);
      expect(res.body.results[0].code).toBe('RECORD_NOT_FOUND');

      const checkForeign = await prisma.place.findUnique({ where: { id: foreignPlace.id } });
      expect(checkForeign.note).not.toBe('Unauthorized note update');
    });
  });
});
