const request = require('supertest');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (_token) => {
    return {
      uid: 'rec-test-uid',
      email: 'recuser@example.com',
      name: 'Recommendation User',
      email_verified: true
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

setupPrismaMock();

const app = require('../server');

describe('Recommendations API Routes', () => {
  const authToken = 'valid-firebase-test-token';

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        firebaseUid: 'rec-test-uid',
        email: 'recuser@example.com',
        name: 'Recommendation User'
      }
    });
  });

  describe('GET /api/recommendations/health', () => {
    it('returns ML service health status without needing authentication', async () => {
      const res = await request(app).get('/api/recommendations/health');
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.mlService.status).toBe('healthy');
      }
    });
  });

  describe('POST /api/recommendations/recommend', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/recommendations/recommend')
        .send({ travel_type: 'beach' });

      expect(res.status).toBe(401);
    });

    it('processes authenticated recommendations request', async () => {
      const res = await request(app)
        .post('/api/recommendations/recommend?top_n=3')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          travel_type: 'beach',
          region: 'India',
          budget_level: 'moderate',
          companions: 'couple'
        });

      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('recommendations');
        expect(Array.isArray(res.body.recommendations)).toBe(true);
      }
    });
  });

  describe('POST /api/recommendations/chat', () => {
    it('rejects unauthenticated chat requests with 401', async () => {
      const res = await request(app)
        .post('/api/recommendations/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(401);
    });

    it('rejects empty message and no direct_preference_update with 400', async () => {
      const res = await request(app)
        .post('/api/recommendations/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('non-empty');
    });

    it('accepts direct_preference_update without message', async () => {
      const res = await request(app)
        .post('/api/recommendations/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          direct_preference_update: { budget_level: 'budget' },
          previous_preferences: {
            travel_type: 'adventure',
            region: 'Europe'
          }
        });

      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('extracted_preferences');
        expect(res.body.extracted_preferences.budget_level).toBe('budget');
      }
    });

    it('processes authenticated natural language query with structured direct_preference_update and previous_preferences', async () => {
      const res = await request(app)
        .post('/api/recommendations/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Budget (< $50/day)',
          previous_preferences: {
            travel_type: 'adventure',
            region: 'Europe',
            duration_days: 7
          },
          direct_preference_update: { budget_level: 'budget' }
        });

      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('recommendations');
        expect(res.body.extracted_preferences.budget_level).toBe('budget');
        expect(res.body.extracted_preferences.region).toBe('Europe');
      }
    });
  });
});

