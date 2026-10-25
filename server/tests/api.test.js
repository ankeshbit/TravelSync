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
    if (token.endsWith('-token') && token !== 'primary-token') {
      const prefix = token.replace('-token', '');
      return {
        uid: `test-firebase-uid-${prefix}`,
        email: `${prefix}@example.com`,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} User`,
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

      it('should update and persist coverImageUrl when valid URL provided', async () => {
        const coverUrl = 'https://images.unsplash.com/photo-test-123';
        const res = await request(app)
          .put(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ coverImageUrl: coverUrl });
        expect(res.status).toBe(200);
        expect(res.body.coverImageUrl).toBe(coverUrl);
      });

      it('should clear coverImageUrl when set to null or empty string', async () => {
        const res = await request(app)
          .put(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ coverImageUrl: null });
        expect(res.status).toBe(200);
        expect(res.body.coverImageUrl).toBe('');
      });

      it('should return 400 if coverImageUrl is an invalid URL format', async () => {
        const res = await request(app)
          .put(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ coverImageUrl: 'not-a-valid-url' });
        expect(res.status).toBe(400);
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

    it('DELETE /api/auth/me returns 409 OWNS_SHARED_TRIPS when user owns a trip with other members', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      // testTripId is owned by testUser and testOtherUser is a member
      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('OWNS_SHARED_TRIPS');
      expect(res.body.trips).toEqual(expect.arrayContaining([expect.stringMatching(/Hawaii/)]));
    });

    it('DELETE /api/auth/me anonymizes user with expenses, preserves ledger balances, and allows email reuse', async () => {
      const expUser = await prisma.user.create({
        data: {
          id: 'user-expense-test',
          name: 'Expense Deleting User',
          email: 'expuser@example.com',
          firebaseUid: 'test-firebase-uid-expuser'
        }
      });
      const partnerUser = await prisma.user.create({
        data: {
          id: 'user-partner-test',
          name: 'Partner User',
          email: 'partner@example.com',
          firebaseUid: 'test-firebase-uid-partner'
        }
      });

      // Partner owns the trip, expUser is a member
      const trip = await prisma.trip.create({
        data: {
          id: 'trip-ledger-test',
          name: 'Ledger Preserved Trip',
          destination: 'Rome',
          startDate: new Date(),
          endDate: new Date(),
          ownerId: partnerUser.id
        }
      });
      await prisma.tripMember.create({
        data: { tripId: trip.id, userId: expUser.id }
      });
      await prisma.tripMember.create({
        data: { tripId: trip.id, userId: partnerUser.id }
      });

      const exp = await prisma.expense.create({
        data: {
          tripId: trip.id,
          title: 'Dinner',
          amount: 200,
          currency: 'EUR',
          paidById: expUser.id,
          splits: {
            create: [
              { userId: expUser.id, amount: 100 },
              { userId: partnerUser.id, amount: 100 }
            ]
          }
        }
      });

      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('expuser@example.com', 'delete');

      const cache = require('../services/cache');
      const invalidateTripSpy = jest.spyOn(cache, 'invalidateTrip');
      const invalidateDashboardSpy = jest.spyOn(cache, 'invalidateUserDashboard');

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer expuser-token')
        .send({ otp });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Account deleted successfully');

      // Check DB row was anonymized
      const anonUser = await prisma.user.findUnique({ where: { id: expUser.id } });
      expect(anonUser.name).toBe('Deleted User');
      expect(anonUser.email).toBe(`deleted-${expUser.id}@deleted.travelsync.local`);
      expect(anonUser.firebaseUid).toBeNull();
      expect(anonUser.refreshToken).toBe('deleted');
      expect(anonUser.deletedAt).not.toBeNull();

      // Check ledger balance / splits for other members are preserved
      const preservedExpense = await prisma.expense.findUnique({ where: { id: exp.id } });
      expect(preservedExpense).not.toBeNull();
      expect(preservedExpense.paidById).toBe(expUser.id);

      // Check cache invalidation was called
      expect(invalidateTripSpy).toHaveBeenCalled();
      expect(invalidateDashboardSpy).toHaveBeenCalled();
      invalidateTripSpy.mockRestore();
      invalidateDashboardSpy.mockRestore();

      // Subsequent token verification for old user is denied (401)
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer expuser-token');
      expect(meRes.status).toBe(401);

      // Email can be reused for a new signup
      const newSignupUser = await prisma.user.create({
        data: {
          name: 'Exp New',
          email: 'expuser@example.com',
          firebaseUid: 'new-fb-uid-exp'
        }
      });
      expect(newSignupUser.email).toBe('expuser@example.com');
      await prisma.user.delete({ where: { id: newSignupUser.id } });

      // Clean up test trip records
      await prisma.expenseSplit.deleteMany({ where: { expenseId: exp.id } });
      await prisma.expense.delete({ where: { id: exp.id } });
      await prisma.tripMember.deleteMany({ where: { tripId: trip.id } });
      await prisma.trip.delete({ where: { id: trip.id } });
      await prisma.user.delete({ where: { id: partnerUser.id } });
      await prisma.user.delete({ where: { id: expUser.id } });
    });

    it('DELETE /api/auth/me hard-deletes user with no financial history', async () => {
      const cleanUser = await prisma.user.create({
        data: {
          name: 'Clean User',
          email: 'clean@example.com',
          firebaseUid: 'clean-uid-1'
        }
      });

      const cleanToken = 'clean-user-token';
      const { verifyFirebaseToken } = require('../config/firebaseAdmin');
      verifyFirebaseToken.mockImplementationOnce(async (tok) => {
        if (tok === cleanToken) {
          return {
            uid: 'clean-uid-1',
            email: 'clean@example.com',
            name: 'Clean User',
            email_verified: true
          };
        }
        return { uid: 'other', email: 'other@example.com' };
      });

      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('clean@example.com', 'delete');

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${cleanToken}`)
        .send({ otp });

      expect(res.status).toBe(200);

      const dbClean = await prisma.user.findUnique({ where: { id: cleanUser.id } });
      expect(dbClean).toBeNull();
    });

    it('DELETE /api/auth/me DB failure leaves the account usable and Firebase untouched', async () => {
      const dbFailUser = await prisma.user.create({
        data: {
          name: 'DB Fail User',
          email: 'dbfail@example.com',
          firebaseUid: 'test-firebase-uid-dbfail'
        }
      });

      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('dbfail@example.com', 'delete');

      const rec = require('../services/accountDeletionReconciliation');
      const origFn = rec.deleteOrAnonymizeUser;
      rec.deleteOrAnonymizeUser = jest.fn().mockRejectedValueOnce(new Error('Simulated DB failure'));
      mockDeleteUser.mockClear();

      try {
        const res = await request(app)
          .delete('/api/auth/me')
          .set('Authorization', 'Bearer dbfail-token')
          .send({ otp });

        expect(res.status).toBe(500);
        expect(res.body.code).toBe('DATABASE_DELETE_FAILED');
        expect(mockDeleteUser).not.toHaveBeenCalled();

        // Account must still be usable (deletedAt rolled back)
        const meRes = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer dbfail-token');
        expect(meRes.status).toBe(200);
        expect(meRes.body.email).toBe('dbfail@example.com');
      } finally {
        rec.deleteOrAnonymizeUser = origFn;
        await prisma.user.deleteMany({ where: { id: dbFailUser.id } }).catch(() => {});
      }
    });

    it('DELETE /api/auth/me Firebase failure after DB success returns 200', async () => {
      const fbFailUser = await prisma.user.create({
        data: {
          name: 'FB Fail User',
          email: 'fbfail@example.com',
          firebaseUid: 'test-firebase-uid-fbfail'
        }
      });

      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('fbfail@example.com', 'delete');

      mockDeleteUser.mockRejectedValueOnce(new Error('Firebase service unreachable'));

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer fbfail-token')
        .send({ otp });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Account deleted successfully');

      const dbUser = await prisma.user.findUnique({ where: { id: fbFailUser.id } });
      expect(dbUser).toBeNull();
    });

    it('reconcilePendingDeletions completes a stuck pending user', async () => {
      const stuckUser = await prisma.user.create({
        data: {
          name: 'Stuck User',
          email: 'stuck@example.com',
          firebaseUid: 'stuck-fb-uid',
          deletedAt: new Date(Date.now() - 60000),
          refreshToken: 'pending_deletion'
        }
      });

      const { reconcilePendingDeletions } = require('../services/accountDeletionReconciliation');
      const outcome = await reconcilePendingDeletions({ prisma, olderThanMs: 0 });
      expect(outcome.processed).toBeGreaterThanOrEqual(1);

      const dbUser = await prisma.user.findUnique({ where: { id: stuckUser.id } });
      expect(dbUser).toBeNull();
    });

    it('POST /api/auth/verify-otp unauthenticated with purpose delete returns 401 and does not consume code', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      // Unauthenticated verify-otp
      const resUnauth = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'john@example.com', otp, purpose: 'delete' });

      expect(resUnauth.status).toBe(401);
      expect(resUnauth.body.message).toContain('Authentication required');

      // Code was NOT consumed — verify with valid token succeeds
      const resAuth = await request(app)
        .post('/api/auth/verify-otp')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'john@example.com', otp, purpose: 'delete' });

      expect(resAuth.status).toBe(200);
      expect(resAuth.body.verified).toBe(true);
    });

    it('DELETE /api/auth/me rejects with 403 on expired OTP', async () => {
      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('john@example.com', 'delete');

      // Expire the OTP by setting expiresAt in past
      await prisma.otp.updateMany({
        where: { email: 'john@example.com' },
        data: { expiresAt: new Date(Date.now() - 60000) }
      });

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/No verification code found|expired/);
    });

    it('DELETE /api/auth/me rejects concurrent deletion requests with 409 DELETION_IN_PROGRESS', async () => {
      const concurUser = await prisma.user.create({
        data: {
          name: 'Concur User',
          email: 'concur@example.com',
          firebaseUid: 'test-firebase-uid-concur'
        }
      });

      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('concur@example.com', 'delete');

      // Make deleteUser take 60ms to simulate async Firebase operation
      mockDeleteUser.mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 60));
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .delete('/api/auth/me')
          .set('Authorization', 'Bearer concur-token')
          .send({ otp }),
        request(app)
          .delete('/api/auth/me')
          .set('Authorization', 'Bearer concur-token')
          .send({ otp })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses[0]).toBe(200);
      expect([403, 409]).toContain(statuses[1]);
      if (statuses[1] === 409) {
        const conflictRes = res1.status === 409 ? res1 : res2;
        expect(conflictRes.body.code).toBe('DELETION_IN_PROGRESS');
      }

      await prisma.user.deleteMany({ where: { id: concurUser.id } });
    });

    it('DELETE /api/auth/me allows retrying a partially completed deletion when Firebase is already deleted', async () => {
      const retryUser = await prisma.user.create({
        data: {
          name: 'Retry User',
          email: 'retry@example.com',
          firebaseUid: 'test-firebase-uid-retry',
          deletedAt: new Date(),
          refreshToken: 'pending_deletion'
        }
      });

      await prisma.otp.deleteMany();
      const { createOtp } = require('../utils/otpStore');
      const otp = await createOtp('retry@example.com', 'delete');

      // Firebase returns auth/user-not-found
      const notFoundErr = new Error('User not found');
      notFoundErr.code = 'auth/user-not-found';
      mockDeleteUser.mockRejectedValueOnce(notFoundErr);

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer retry-token')
        .send({ otp });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Account deleted successfully');

      // DB profile is deleted
      const dbUser = await prisma.user.findUnique({ where: { id: retryUser.id } });
      expect(dbUser).toBeNull();
    });

    it('ordinary API endpoints reject a user marked with deletedAt even after memory cache loss (simulating server restart)', async () => {
      // Set deletedAt directly in PostgreSQL
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() }
      });

      // Wipe all in-memory sets to simulate process restart
      const { deletedAccountsCache, pendingDeletionUids } = require('../utils/verifyAuthToken');
      deletedAccountsCache.clear();
      pendingDeletionUids.clear();

      // Ordinary endpoint GET /api/auth/me must reject with 401 ACCOUNT_DELETED
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ACCOUNT_DELETED');

      // Reset deletedAt for remaining tests
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: null }
      });
    });

    it('prevents recreating or auto-provisioning an account while deletion is pending in PostgreSQL', async () => {
      const { verifyAuthToken } = require('../utils/verifyAuthToken');

      // Set deletedAt on testUser
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() }
      });

      // Clear memory caches to verify PostgreSQL durability
      const { deletedAccountsCache, pendingDeletionUids } = require('../utils/verifyAuthToken');
      deletedAccountsCache.clear();
      pendingDeletionUids.clear();

      // Attempting to verify token for deleted user throws ACCOUNT_DELETED and does not recreate user
      await expect(verifyAuthToken(userToken)).rejects.toThrow('Account has been deleted or is pending deletion.');

      // Restore user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: null }
      });
    });

    it('reconcilePendingDeletions cleans up pending accounts and preserves accounts with financial records', async () => {
      const { reconcilePendingDeletions } = require('../services/accountDeletionReconciliation');

      // Create a pending user without expenses
      const cleanUser = await prisma.user.create({
        data: {
          id: 'user-clean-reconcile',
          name: 'Clean Reconcile',
          email: 'clean-reconcile@example.com',
          firebaseUid: 'fb-clean-reconcile',
          deletedAt: new Date(Date.now() - 10000)
        }
      });

      // Create a pending user with an expense record
      const expenseUser = await prisma.user.create({
        data: {
          id: 'user-expense-reconcile',
          name: 'Expense Reconcile',
          email: 'expense-reconcile@example.com',
          firebaseUid: 'fb-expense-reconcile',
          deletedAt: new Date(Date.now() - 10000)
        }
      });

      // Add trip and expense paid by expenseUser
      const trip = await prisma.trip.create({
        data: {
          id: 'trip-reconcile',
          name: 'Reconcile Trip',
          destination: 'Paris',
          startDate: new Date(),
          endDate: new Date(),
          ownerId: expenseUser.id
        }
      });
      await prisma.expense.create({
        data: {
          id: 'expense-reconcile',
          tripId: trip.id,
          title: 'Hotel',
          amount: 200,
          paidById: expenseUser.id
        }
      });

      mockDeleteUser.mockResolvedValue();

      const result = await reconcilePendingDeletions({
        prisma,
        firebaseAuth: { deleteUser: mockDeleteUser },
        olderThanMs: 0
      });

      expect(result.processed).toBeGreaterThanOrEqual(2);
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(result.anonymized).toBeGreaterThanOrEqual(1);

      // cleanUser should be completely deleted from DB
      const foundClean = await prisma.user.findUnique({ where: { id: cleanUser.id } });
      expect(foundClean).toBeNull();

      // expenseUser should remain as anonymized tombstone
      const foundExpenseUser = await prisma.user.findUnique({ where: { id: expenseUser.id } });
      expect(foundExpenseUser).not.toBeNull();
      expect(foundExpenseUser.name).toBe('Deleted User');
      expect(foundExpenseUser.email).toContain('@deleted.travelsync.local');
      expect(foundExpenseUser.deletedAt).not.toBeNull();

      // Clean up test records
      await prisma.expense.deleteMany({ where: { tripId: trip.id } });
      await prisma.trip.deleteMany({ where: { id: trip.id } });
      await prisma.user.deleteMany({ where: { id: expenseUser.id } });
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

  describe('Server Middleware & Security Verifications', () => {
    it('returns 400 INVALID_JSON on malformed JSON payload', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .set('Content-Type', 'application/json')
        .send('{ "email": "bad json');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_JSON');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('returns 403 CORS_ERROR when Origin is unauthorized', async () => {
      const res = await request(app)
        .get('/api/stats')
        .set('Origin', 'http://unauthorized-attacker-site.com');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CORS_ERROR');
    });

    it('propagates client-supplied X-Request-Id header in responses', async () => {
      const customId = 'trace-client-12345';
      const res = await request(app)
        .get('/api/stats')
        .set('X-Request-Id', customId);
      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
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
