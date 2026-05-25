process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Trip = require('../models/Trip');

beforeAll(async () => {
  // Tests require MONGO_URI to be set in environment
  // Run with: MONGO_URI=mongodb://localhost:27017/travelsync_test npx jest
  if (!process.env.MONGO_URI) {
    throw new Error(
      'MONGO_URI environment variable is required for tests. ' +
      'Set it to a test database URI, never a production database.'
    );
  }
  await mongoose.connect(process.env.MONGO_URI);

  // Clear collections once at the start
  await User.deleteMany({});
  await Trip.deleteMany({});
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});

describe('TravelSync API Integration Tests', () => {
  let userToken;
  let otherUserToken;
  let testTripId;
  let testUser;
  let testOtherUser;

  const validUser = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    otpVerified: true
  };

  const otherUser = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    otpVerified: true
  };

  beforeAll(async () => {
    // Register primary user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send(validUser);
    
    expect(regRes.status).toBe(201);
    userToken = regRes.body.accessToken;
    testUser = regRes.body.user;

    // Register secondary user for member/access tests
    const otherRegRes = await request(app)
      .post('/api/auth/register')
      .send(otherUser);
    
    expect(otherRegRes.status).toBe(201);
    otherUserToken = otherRegRes.body.accessToken;
    testOtherUser = otherRegRes.body.user;

    // Create a base trip owned by primary user
    const tripRes = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Summer Vacation',
        destination: 'Hawaii',
        startDate: '2026-07-01',
        endDate: '2026-07-10'
      });
    
    expect(tripRes.status).toBe(201);
    testTripId = tripRes.body._id;
  });

  describe('Auth Routes', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully with valid inputs', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'alicepassword',
            otpVerified: true
          });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body.user).toHaveProperty('email', 'alice@example.com');
      });

      it('should return 400 if email is already registered', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validUser);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/exists/i);
      });

      it('should return 400 if required fields are missing', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'missing@example.com',
            otpVerified: true
          });
        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/auth/login', () => {
      it('should return 200 and a JWT token with correct credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: validUser.email,
            password: validUser.password
          });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body.user.email).toBe(validUser.email);
      });

      it('should return 401 with wrong password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: validUser.email,
            password: 'wrongpassword'
          });
        expect(res.status).toBe(401);
      });

      it('should return 404 with unregistered email', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'unregistered@example.com',
            password: 'password123'
          });
        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return 200 and user object with valid JWT in Authorization header', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(validUser.email);
      });

      it('should return 401 with no token provided', async () => {
        const res = await request(app)
          .get('/api/auth/me');
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
      it('should return 201 with valid body when authenticated', async () => {
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
        expect(res.body.name).toBe('Winter Getaway');
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

      it('should return 403 (or 401) if unauthenticated', async () => {
        const res = await request(app)
          .post('/api/trips')
          .send({
            name: 'Anonymous Trip',
            destination: 'Nowhere',
            startDate: '2026-06-01',
            endDate: '2026-06-05'
          });
        expect([401, 403]).toContain(res.status);
      });
    });

    describe('GET /api/trips/:tripId', () => {
      it('should return 200 for a trip member', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(testTripId);
      });

      it('should return 403 for a non-member requester', async () => {
        const res = await request(app)
          .get(`/api/trips/${testTripId}`)
          .set('Authorization', `Bearer ${otherUserToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/trips/:tripId/members', () => {
      it('should add a member by email and return 200 when requested by owner', async () => {
        const res = await request(app)
          .post(`/api/trips/${testTripId}/members`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            email: otherUser.email
          });
        expect(res.status).toBe(200);
        const memberIds = res.body.members.map(m => m._id.toString());
        expect(memberIds).toContain(testOtherUser.id);
      });

      it('should return 400 if member is already in the trip', async () => {
        // Try adding them again (since they are already added in the previous test or we add them here to be certain)
        // First ensure they are in members (in case tests run in different order or isolation, we do it explicitly)
        await Trip.findByIdAndUpdate(testTripId, { $addToSet: { members: testOtherUser.id } });

        const res = await request(app)
          .post(`/api/trips/${testTripId}/members`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            email: otherUser.email
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
  });
});
