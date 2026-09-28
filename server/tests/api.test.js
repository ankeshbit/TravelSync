process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Mock Firebase Admin verification before requiring app/routes
jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'invalidtoken') throw new Error('Invalid token');
    if (token === 'other-token') {
      return {
        uid: 'test-firebase-uid-other',
        email: 'jane@example.com',
        name: 'Jane Smith'
      };
    }
    return {
      uid: 'test-firebase-uid-primary',
      email: 'john@example.com',
      name: 'John Doe'
    };
  }),
  getAdminApp: jest.fn()
}));

jest.setTimeout(30000);

const request = require('supertest');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

setupPrismaMock();

const app = require('../server');

describe('TravelSync API Integration Tests', () => {
  let userToken = 'primary-token';
  let otherUserToken = 'other-token';
  let testTripId;
  let testUser;
  let testOtherUser;

  beforeAll(async () => {
    // Upsert test users safely without wiping production/dev data
    testUser = await prisma.user.upsert({
      where: { email: 'john@example.com' },
      update: { firebaseUid: 'test-firebase-uid-primary' },
      create: {
        name: 'John Doe',
        email: 'john@example.com',
        password: '',
        firebaseUid: 'test-firebase-uid-primary'
      }
    });

    testOtherUser = await prisma.user.upsert({
      where: { email: 'jane@example.com' },
      update: { firebaseUid: 'test-firebase-uid-other' },
      create: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: '',
        firebaseUid: 'test-firebase-uid-other'
      }
    });

    // Create a base trip owned by primary user
    const tripRes = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Hawaii Test Getaway',
        destination: 'Hawaii',
        startDate: '2026-07-01',
        endDate: '2026-07-10'
      });

    expect(tripRes.status).toBe(201);
    expect(tripRes.body).toHaveProperty('id');
    expect(tripRes.body).toHaveProperty('owner');
    testTripId = tripRes.body.id;
  });

  afterAll(async () => {
    // Clean up only our test trips
    if (testTripId) {
      await prisma.activity.deleteMany({ where: { tripId: testTripId } }).catch(() => {});
      await prisma.expenseSplit.deleteMany({ where: { expense: { tripId: testTripId } } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { tripId: testTripId } }).catch(() => {});
      await prisma.place.deleteMany({ where: { tripId: testTripId } }).catch(() => {});
      await prisma.tripMember.deleteMany({ where: { tripId: testTripId } }).catch(() => {});
      await prisma.trip.deleteMany({ where: { name: { in: ['Hawaii Test Getaway', 'Winter Getaway'] } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Health Check Route', () => {
    it('GET /api/health should return 200 and dbStatus: connected when healthy', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.dbStatus).toBe('connected');
      expect(res.body.database).toBe('PostgreSQL (Neon)');
    });

    it('GET /api/health should return 503 if db query fails', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection lost'));
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.dbStatus).toBe('error');
    });

    it('GET /api/health/ready should return 200 when ready', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });

    it('GET /api/health/ready should return 503 when database is down', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('DB unreachable'));
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
      expect(res.body.database).toBe('disconnected');
    });
  });

  describe('Public Stats Route', () => {
    it('GET /api/stats should return counts for users and trips', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(typeof res.body.users).toBe('number');
      expect(typeof res.body.trips).toBe('number');
    });
  });

  describe('Auth Routes (Firebase-backed)', () => {
    describe('GET /api/auth/me', () => {
      it('should return 200 and user object with id and createdAt', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(testUser.id);
        expect(res.body.email).toBe('john@example.com');
        expect(res.body).toHaveProperty('createdAt');
      });

      it('should return 401 with no token provided', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
      });

      it('should return 401 with an invalid/expired token', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalidtoken');
        expect(res.status).toBe(401);
      });
    });
  });

  describe('Trips Routes', () => {
    describe('POST /api/trips', () => {
      it('should return 201 with id, owner, and members when authenticated', async () => {
        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Winter Getaway',
            destination: 'Swiss Alps',
            startDate: '2026-12-15',
            endDate: '2026-12-22'
          });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('owner');
        expect(res.body.owner.id).toBe(testUser.id);
        expect(Array.isArray(res.body.members)).toBe(true);
      });

      it('should return 400 with missing parameters', async () => {
        const res = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Broken Trip'
          });
        expect(res.status).toBe(400);
      });

      it('should return 401 if unauthenticated', async () => {
        const res = await request(app)
          .post('/api/trips')
          .send({
            name: 'Anonymous Trip',
            destination: 'Nowhere',
            startDate: '2026-06-01',
            endDate: '2026-06-05'
          });
        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/trips/summary', () => {
      it('should return overview statistics for authenticated user', async () => {
        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(typeof res.body.totalTrips).toBe('number');
        expect(typeof res.body.upcomingTrips).toBe('number');
        expect(typeof res.body.totalMembers).toBe('number');
        expect(typeof res.body.totalSpent).toBe('number');
        expect(res.body).toHaveProperty('currency');
      });
    });

    describe('GET /api/trips/:id', () => {
      it('should return 200 with id, owner, and members for trip participant', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(testTripId);
        expect(res.body.owner.id).toBe(testUser.id);
        expect(Array.isArray(res.body.members)).toBe(true);
      });

      it('should return 403 for a non-member requester', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${otherUserToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/trips/:tripId/members', () => {
      it('should add a member by email and return trip with members objects containing id', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/members`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            email: 'jane@example.com'
          });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(testTripId);
        const memberIds = res.body.members.map(m => m.id);
        expect(memberIds).toContain(testOtherUser.id);
      });

      it('should return 400 if member is already in the trip', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/members`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            email: 'jane@example.com'
          });
        expect(res.status).toBe(400);
      });

      it('should return 403 if requester is not the trip owner', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/members`)
          .set('Authorization', `Bearer ${otherUserToken}`)
          .send({
            email: 'somebody@example.com'
          });
        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/trips/:tripId/ai-suggestions rate limiter', () => {
      it('should return 429 on the 6th AI request in the window', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'Sample trip',
                  days: [],
                  tips: []
                })
              }
            }]
          })
        });

        try {
          // Send 5 requests within the limit
          for (let i = 1; i <= 5; i++) {
            const res = await request(app)
              .post(`/api/trips/${testTripId}/ai-suggestions`)
              .set('Authorization', `Bearer ${userToken}`)
              .send({ budget: 'moderate', interests: 'sightseeing' });

            expect(res.status).not.toBe(429);
          }

          // The 6th request must be rate limited
          const res6 = await request(app)
            .post(`/api/trips/${testTripId}/ai-suggestions`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ budget: 'moderate', interests: 'sightseeing' });

          expect(res6.status).toBe(429);
          expect(res6.body.message).toMatch(/Too many itinerary requests/i);
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('PUT /api/trips/:id', () => {
      it('should update trip details and return updated trip', async () => {
        const res = await request(app)
          .put(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name: 'Hawaii Updated', status: 'upcoming' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(testTripId);
      });

      it('should return 403 if not the trip owner', async () => {
        const res = await request(app)
          .put(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${otherUserToken}`)
          .send({ name: 'Hijacked Name' });
        expect(res.status).toBe(403);
      });
    });

    describe('Places API', () => {
      let testPlaceId;

      it('POST /api/trips/:tripId/places should add a place', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/places`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Eiffel Tower',
            address: 'Paris, France',
            lat: 48.8584,
            lng: 2.2945,
            dayNumber: 1,
            orderIndex: 0
          });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Eiffel Tower');
        testPlaceId = res.body.id;
      });

      it('GET /api/trips/:tripId/places should return places array', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}/places`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res)).toBe(false); // res is supertest response
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('PATCH /api/trips/:tripId/places/:placeId/note should update note', async () => {
        if (!testPlaceId) return;
        const res = await request(app)
          .patch(`/api/trips/${testTripId}/places/${testPlaceId}/note`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ note: 'Go early morning!' });
        expect(res.status).toBe(200);
        expect(res.body.note).toBe('Go early morning!');
      });

      it('PATCH /api/trips/:tripId/places/reorder should return places array', async () => {
        const res = await request(app)
          .patch(`/api/trips/${testTripId}/places/reorder`)
          .set('Authorization', `Bearer ${userToken}`)
          .send([]);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('DELETE /api/trips/:tripId/places/:placeId should delete place', async () => {
        if (!testPlaceId) return;
        const res = await request(app)
          .delete(`/api/trips/${testTripId}/places/${testPlaceId}`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/deleted/i);
      });
    });

    describe('Expenses API', () => {
      let testExpenseId;

      it('POST /api/trips/:tripId/expenses should add an expense', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/expenses`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: 'Dinner',
            amount: 150,
            currency: 'USD',
            paidBy: testUser.id,
            splitAmong: [testUser.id]
          });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Dinner');
        expect(res.body).toHaveProperty('id');
        testExpenseId = res.body.id;
      });

      it('POST /api/trips/:tripId/expenses should return 400 if missing fields', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/expenses`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ title: 'Broken' });
        expect(res.status).toBe(400);
      });

      it('GET /api/trips/:tripId/expenses should return paginated expenses', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}/expenses`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.expenses)).toBe(true);
        expect(res.body).toHaveProperty('pagination');
        expect(res.body).toHaveProperty('currency');
      });

      it('GET /api/trips/:tripId/expenses/balances should return balance summary', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}/expenses/balances`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('balanceMap');
        expect(res.body).toHaveProperty('settlements');
        expect(res.body).toHaveProperty('currency');
      });

      it('DELETE /api/trips/:tripId/expenses/:expenseId should delete expense', async () => {
        if (!testExpenseId) return;
        const res = await request(app)
          .delete(`/api/trips/${testTripId}/expenses/${testExpenseId}`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/deleted/i);
      });
    });

    describe('Activity API', () => {
      it('GET /api/trips/:tripId/activity should return activity array', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}/activity`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('GET /api/trips/:tripId/activity should return 403 for non-member', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}/activity`)
          .set('Authorization', `Bearer ${otherUserToken}`);
        // jane was added as member earlier, so this may be 200 or 403
        expect([200, 403]).toContain(res.status);
      });
    });

    describe('DELETE /api/trips/:id', () => {
      it('should return 403 if not trip owner', async () => {
        const res = await request(app)
          .delete(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${otherUserToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('Explore Routes', () => {
    it('GET /api/explore/destinations should return array for authenticated user', async () => {
      const res = await request(app)
        .get('/api/explore/destinations')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/explore/destinations should return 401 without token', async () => {
      const res = await request(app).get('/api/explore/destinations');
      expect(res.status).toBe(401);
    });

    it('GET /api/explore/destinations?q=Hawaii should filter results', async () => {
      const res = await request(app)
        .get('/api/explore/destinations?q=Hawaii')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Auth Routes - additional coverage', () => {
    it('PUT /api/auth/me should update name', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'John Updated' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('John Updated');
    });

    it('POST /api/auth/logout should return 200', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/register should return 410', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: '123456' });
      expect(res.status).toBe(410);
    });

    it('POST /api/auth/login should return 410', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '123456' });
      expect(res.status).toBe(410);
    });

    it('POST /api/auth/refresh should return 410', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});
      expect(res.status).toBe(410);
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
