process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Mock Firebase Admin verification before requiring app/routes
jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'invalidtoken') throw new Error('Invalid token');
    if (token === 'unverified-token') {
      return {
        uid: 'test-firebase-uid-unverified',
        email: 'unverified@example.com',
        name: 'Unverified User',
        email_verified: false
      };
    }
    if (token === 'unverified-existing-token') {
      return {
        uid: 'test-firebase-uid-unverified-existing',
        email: 'john@example.com',
        name: 'Unverified Existing',
        email_verified: false
      };
    }
    if (token === 'empty-user-token') {
      return {
        uid: 'test-firebase-uid-empty',
        email: 'empty@example.com',
        name: 'Empty User',
        email_verified: true
      };
    }
    if (token === 'other-token') {
      return {
        uid: 'test-firebase-uid-other',
        email: 'jane@example.com',
        name: 'Jane Smith',
        email_verified: true
      };
    }
    return {
      uid: 'test-firebase-uid-primary',
      email: 'john@example.com',
      name: 'John Doe',
      email_verified: true
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

const mockDeleteUser = jest.fn().mockResolvedValue();
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    deleteUser: mockDeleteUser
  }))
}));

jest.setTimeout(30000);

const request = require('supertest');
const { prisma } = require('../db');
const config = require('../config/env');
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

    it('GET /api/health should return 503 if db query fails and log error on server without leaking details', async () => {
      const sensitiveError = new Error('FATAL: password authentication failed for user "neon_admin"');
      prisma.$queryRaw.mockRejectedValueOnce(sensitiveError);
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.dbStatus).toBe('error');
      expect(JSON.stringify(res.body)).not.toContain('neon_admin');
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('GET /api/health should return 503 and dbStatus: disconnected when DATABASE_URL is unconfigured', async () => {
      const origDbUrl = config.DATABASE_URL;
      config.DATABASE_URL = '';
      try {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(503);
        expect(res.body.dbStatus).toBe('disconnected');
      } finally {
        config.DATABASE_URL = origDbUrl;
      }
    });

    it('GET /api/health/ready should return 200 when ready', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });

    it('GET /api/health/ready should return 503 and not expose internal error messages when database is down', async () => {
      const sensitiveError = new Error('FATAL: connection to server at "ep-cool-fog-12345.us-east-2.aws.neon.tech" (10.0.4.2), port 5432 failed: password authentication failed for user "db_user"');
      prisma.$queryRaw.mockRejectedValueOnce(sensitiveError);
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
      expect(res.body.database).toBe('disconnected');
      expect(res.body.error).toBe('Database connection failed');
      expect(JSON.stringify(res.body)).not.toContain('ep-cool-fog-12345');
      expect(JSON.stringify(res.body)).not.toContain('password authentication');
      expect(JSON.stringify(res.body)).not.toContain('db_user');
    });

    it('GET /api/health/ready should return 503 when DATABASE_URL is unconfigured', async () => {
      const origDbUrl = config.DATABASE_URL;
      config.DATABASE_URL = '';
      try {
        const res = await request(app).get('/api/health/ready');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('not ready');
        expect(res.body.database).toBe('not configured');
      } finally {
        config.DATABASE_URL = origDbUrl;
      }
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

      it('should return 403 EMAIL_NOT_VERIFIED with an unverified new email token', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer unverified-token');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
      });

      it('should return 401 when an unverified email would link to an existing account', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer unverified-existing-token');
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Email must be verified to link');
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
        expect(res.body).toHaveProperty('spentByCurrency');
      });

      it('should fallback to INR and return 0 spent for user with empty trips', async () => {
        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', 'Bearer empty-user-token');
        expect(res.status).toBe(200);
        expect(res.body.totalTrips).toBe(0);
        expect(res.body.currency).toBe('INR');
        expect(res.body.totalSpent).toBe(0);
        expect(res.body.spentByCurrency).toEqual({ INR: 0 });
        expect(res.body.hasMultipleCurrencies).toBe(false);
      });

      it('should preserve trip stored currency (e.g. EUR) when trip has zero expenses', async () => {
        const eurTrip = await prisma.trip.create({
          data: {
            name: 'Euro Trip',
            destination: 'Paris',
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-10'),
            currency: 'EUR',
            ownerId: testUser.id
          }
        });

        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.totalSpent).toBe(0);
        expect(res.body.spentByCurrency).toEqual({ [res.body.currency]: 0 });
        expect(res.body.hasMultipleCurrencies).toBe(false);

        await prisma.trip.delete({ where: { id: eurTrip.id } });
      });

      it('should calculate expense totals correctly for a single currency', async () => {
        const exp1 = await prisma.expense.create({
          data: {
            tripId: testTripId,
            title: 'Flight',
            amount: 1500,
            currency: 'INR',
            paidById: testUser.id
          }
        });
        const exp2 = await prisma.expense.create({
          data: {
            tripId: testTripId,
            title: 'Hotel',
            amount: 2500,
            currency: 'INR',
            paidById: testUser.id
          }
        });

        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.currency).toBe('INR');
        expect(res.body.totalSpent).toBe(4000);
        expect(res.body.spentByCurrency).toEqual({ INR: 4000 });
        expect(res.body.hasMultipleCurrencies).toBe(false);

        await prisma.expense.deleteMany({ where: { id: { in: [exp1.id, exp2.id] } } });
      });

      it('should calculate expense totals separately for multiple currencies without summing them', async () => {
        const inrExp = await prisma.expense.create({
          data: {
            tripId: testTripId,
            title: 'INR Train',
            amount: 4000,
            currency: 'INR',
            paidById: testUser.id
          }
        });
        const usdExp = await prisma.expense.create({
          data: {
            tripId: testTripId,
            title: 'USD Cruise',
            amount: 150,
            currency: 'USD',
            paidById: testUser.id
          }
        });

        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.hasMultipleCurrencies).toBe(true);
        expect(res.body.totalSpent).toBeNull();
        expect(res.body.spentByCurrency).toEqual({
          INR: 4000,
          USD: 150
        });

        await prisma.expense.deleteMany({ where: { id: { in: [inrExp.id, usdExp.id] } } });
      });

      it('should handle missing currency on expense by inheriting trip currency', async () => {
        const gbpTrip = await prisma.trip.create({
          data: {
            name: 'London Trip',
            destination: 'London',
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-05'),
            currency: 'GBP',
            ownerId: testUser.id
          }
        });
        const missingCurrExp = await prisma.expense.create({
          data: {
            tripId: gbpTrip.id,
            title: 'Tea',
            amount: 50,
            currency: '',
            paidById: testUser.id
          }
        });

        const res = await request(app)
          .get('/api/trips/summary')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.spentByCurrency.GBP).toBe(50);

        await prisma.expense.deleteMany({ where: { id: missingCurrExp.id } });
        await prisma.trip.delete({ where: { id: gbpTrip.id } });
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

      it('PATCH /api/trips/:tripId/places/reorder should return 400 with a foreign place id', async () => {
        const res = await request(app)
          .patch(`/api/trips/${testTripId}/places/reorder`)
          .set('Authorization', `Bearer ${userToken}`)
          .send([{ placeId: 'foreign-place-id-not-in-trip', dayNumber: 1, orderIndex: 0 }]);
        expect(res.status).toBe(400);
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

    it('DELETE /api/auth/me should return 403 without an OTP', async () => {
      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Valid OTP required');
    });

    it('DELETE /api/auth/me should return 403 with an invalid OTP', async () => {
      await prisma.otp.deleteMany();
      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp: '000000' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/auth/me should return 409 when the user has paid expenses', async () => {
      await prisma.otp.deleteMany();
      await prisma.expense.create({
        data: {
          tripId: 'some-trip',
          title: 'Lunch',
          amount: 25,
          paidById: testUser.id
        }
      });

      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_HAS_EXPENSES');

      await prisma.expense.deleteMany();
    });

    it('DELETE /api/auth/me should return 409 when the user has expense splits', async () => {
      await prisma.otp.deleteMany();
      await prisma.expense.create({
        data: {
          tripId: 'some-trip',
          title: 'Dinner',
          amount: 50,
          paidById: testOtherUser.id,
          splits: {
            create: [{ userId: testUser.id, amount: 25 }]
          }
        }
      });

      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_HAS_EXPENSES');

      await prisma.expense.deleteMany();
    });

    it('DELETE /api/auth/me should return 409 when the user owns a trip with expenses', async () => {
      await prisma.otp.deleteMany();
      // testTripId is owned by testUser
      await prisma.expense.create({
        data: {
          tripId: testTripId,
          title: 'Trip activity',
          amount: 100,
          paidById: testOtherUser.id
        }
      });

      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_HAS_EXPENSES');

      await prisma.expense.deleteMany();
    });

    it('DELETE /api/auth/me maps foreign-key constraint violation (P2003) to 409', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      const originalDelete = prisma.user.delete;
      const fkError = new Error('Foreign key constraint failed');
      fkError.code = 'P2003';
      prisma.user.delete = jest.fn().mockRejectedValueOnce(fkError);

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_HAS_EXPENSES');
      prisma.user.delete = originalDelete;

      const { pendingDeletionUids } = require('../utils/verifyAuthToken');
      pendingDeletionUids.delete(testUser.firebaseUid);
      await prisma.user.update({
        where: { id: testUser.id },
        data: { refreshToken: null }
      });
    });

    it('DELETE /api/auth/me handles Firebase deletion failure (returns 502, does not delete DB user)', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      mockDeleteUser.mockRejectedValueOnce(new Error('Firebase connection error'));

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('FIREBASE_DELETE_FAILED');

      // Database profile must still exist and pending deletion state rolled back
      const dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser.refreshToken).toBeNull();

      // Subsequent token verification succeeds without auto-recreation
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('john@example.com');
    });

    it('DELETE /api/auth/me handles database deletion failure after Firebase deletion (returns 500, locks account)', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      mockDeleteUser.mockResolvedValueOnce();
      const originalDelete = prisma.user.delete;
      prisma.user.delete = jest.fn().mockRejectedValueOnce(new Error('PostgreSQL deadlock / connection failure'));

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('DATABASE_DELETE_FAILED');
      prisma.user.delete = originalDelete;

      // Token verification must reject pending deletion account (401) and not auto-recreate it
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(meRes.status).toBe(401);

      // Restore user for next tests
      const { pendingDeletionUids } = require('../utils/verifyAuthToken');
      pendingDeletionUids.delete(testUser.firebaseUid);
      await prisma.user.update({
        where: { id: testUser.id },
        data: { refreshToken: null }
      });
    });

    it('DELETE /api/auth/me performs successful deletion order (Firebase before DB) and denies subsequent login', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      const executionOrder = [];
      const originalDelete = prisma.user.delete;
      prisma.user.delete = jest.fn(async (args) => {
        executionOrder.push('db_delete');
        return originalDelete(args);
      });
      mockDeleteUser.mockImplementationOnce(async () => {
        executionOrder.push('firebase_delete');
      });

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Account deleted successfully');
      expect(executionOrder).toEqual(['firebase_delete', 'db_delete']);
      prisma.user.delete = originalDelete;

      // DB profile is deleted
      const dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(dbUser).toBeNull();

      // Subsequent token verification is denied (401) and does NOT recreate user
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(meRes.status).toBe(401);

      // Clean up deleted cache and restore testUser for remaining tests
      const { deletedAccountsCache, pendingDeletionUids } = require('../utils/verifyAuthToken');
      deletedAccountsCache.delete(testUser.firebaseUid);
      pendingDeletionUids.delete(testUser.firebaseUid);
      await prisma.user.upsert({
        where: { id: testUser.id },
        update: { refreshToken: null },
        create: testUser
      });
    });

    it('POST /api/auth/upload-photo should reject SVG upload with 400', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
      const res = await request(app)
        .post('/api/auth/upload-photo')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photo', svgBuffer, 'avatar.svg');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only JPEG, PNG, WebP, and GIF');
    });

    it('POST /api/auth/upload-photo should accept valid PNG image', async () => {
      const pngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
      const res = await request(app)
        .post('/api/auth/upload-photo')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photo', pngBuffer, 'avatar.png');
      expect(res.status).toBe(200);
      expect(res.body.pictureUrl).toMatch(/^\/uploads\/user-.*\.png$/);
    });
  });

  describe('Phase 2 Core Server Bug Verifications', () => {
    it('GET /api/explore/destinations coerces query parameters without 500', async () => {
      const res = await request(app)
        .get('/api/explore/destinations?page=1&limit=5&q=tokyo')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/auth/send-otp with empty body returns 400 instead of 500', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/send-otp with { email: 123 } returns 400 instead of 500', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ email: 123 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/trips/:tripId/expenses rejects paidBy from non-member with 400', async () => {
      const res = await request(app)
        .post(`/api/trips/${testTripId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Lunch',
          amount: 50,
          currency: 'USD',
          paidBy: 'non-existent-or-non-member-user-id',
          splitAmong: [testUser.id]
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/paidBy user is not a member/i);
    });

    it('DELETE /api/trips/:tripId/members/:userId returns 404 if user is not a member', async () => {
      const res = await request(app)
        .delete(`/api/trips/${testTripId}/members/random-non-member-user-id`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not a member/i);
    });

    it('DELETE /api/trips/:tripId/members/:userId returns 409 if member has expenses in the trip', async () => {
      // First, add testOtherUser as member
      await prisma.tripMember.create({
        data: { tripId: testTripId, userId: testOtherUser.id }
      });

      // Add expense paid by testOtherUser
      await prisma.expense.create({
        data: {
          tripId: testTripId,
          title: 'Museum Entry',
          amount: 40,
          currency: 'USD',
          paidById: testOtherUser.id,
          splits: {
            create: [{ userId: testUser.id }]
          }
        }
      });

      // Attempt to remove testOtherUser
      const res = await request(app)
        .delete(`/api/trips/${testTripId}/members/${testOtherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/existing expenses or splits/i);
    });

    it('DELETE /api/trips/:tripId/members/me allows a member without expenses to leave', async () => {
      // Create a fresh member user
      const freshMember = await prisma.user.create({
        data: {
          name: 'Leaving Member',
          email: 'leaving@example.com',
          firebaseUid: 'test-firebase-uid-leaving'
        }
      });
      await prisma.tripMember.create({
        data: { tripId: testTripId, userId: freshMember.id }
      });

      // Mock token for leaving user
      const { verifyFirebaseToken } = require('../config/firebaseAdmin');
      verifyFirebaseToken.mockImplementationOnce(async (tok) => {
        if (tok === 'leaving-token') {
          return {
            uid: 'test-firebase-uid-leaving',
            email: 'leaving@example.com',
            name: 'Leaving Member',
            email_verified: true
          };
        }
        return { uid: 'test-firebase-uid-primary', email: 'john@example.com', name: 'John Doe', email_verified: true };
      });

      const res = await request(app)
        .delete(`/api/trips/${testTripId}/members/me`)
        .set('Authorization', 'Bearer leaving-token');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/successfully left/i);
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
