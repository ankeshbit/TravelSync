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

      // Accommodations & Transport
      expect(Array.isArray(res.body.staysAndTransport)).toBe(true);
      expect(res.body.staysAndTransport.length).toBeGreaterThanOrEqual(1);
      const stay = res.body.staysAndTransport.find(s => s.type === 'hotel');
      expect(stay).toBeDefined();
      expect(stay.name).toContain('Victoria Jungfrau Grand Hotel');

      // Emergency Contacts
      expect(Array.isArray(res.body.emergencyContacts)).toBe(true);
      expect(res.body.emergencyContacts.length).toBeGreaterThanOrEqual(2);
      expect(res.body.emergencyContacts.some(c => c.phone === '112')).toBe(true);

      // Checklists
      expect(Array.isArray(res.body.checklists)).toBe(true);
      expect(res.body.checklists.length).toBeGreaterThanOrEqual(5);

      // Travel Notes
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes.length).toBeGreaterThanOrEqual(1);

      // Documents & Metadata
      expect(Array.isArray(res.body.documents)).toBe(true);
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

    it('processes offline changes successfully for authorized member', async () => {
      const res = await request(app)
        .post(`/api/trips/${trip1.id}/offline-sync`)
        .set('Authorization', 'Bearer valid-user-1')
        .send({
          changes: [
            {
              type: 'checklist_item',
              itemId: `chk-1-${trip1.id}`,
              completed: true,
              modifiedAt: new Date().toISOString()
            },
            {
              type: 'travel_note',
              itemId: `note-1-${trip1.id}`,
              content: 'Offline note update test',
              modifiedAt: new Date().toISOString()
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.syncedCount).toBe(2);
      expect(res.body.serverTimestamp).toBeDefined();
    });
  });
});
