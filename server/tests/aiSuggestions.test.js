const request = require('supertest');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');
const logger = require('../utils/logger');
const config = require('../config/env');

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (_token) => {
    return {
      uid: 'ai-test-uid',
      email: 'aiuser@example.com',
      name: 'AI User',
      email_verified: true
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

setupPrismaMock();

const app = require('../server');

describe('POST /api/trips/:tripId/ai-suggestions error sanitization', () => {
  let tripId;
  const userToken = 'ai-test-token';
  let loggerErrorSpy;

  beforeAll(async () => {
    // Create user and trip
    const user = await prisma.user.create({
      data: {
        firebaseUid: 'ai-test-uid',
        email: 'aiuser@example.com',
        name: 'AI User'
      }
    });

    const trip = await prisma.trip.create({
      data: {
        name: 'AI Test Trip',
        destination: 'Tokyo',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
        ownerId: user.id
      }
    });
    tripId = trip.id;
  });

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('returns 502 and "AI service is not configured" when GROQ_API_KEY is missing', async () => {
    const originalKey = config.GROQ_API_KEY;
    config.GROQ_API_KEY = '';

    try {
      const res = await request(app)
        .post(`/api/trips/${tripId}/ai-suggestions`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 'moderate', interests: 'food' });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('AI service is not configured');
      expect(loggerErrorSpy).toHaveBeenCalled();
    } finally {
      config.GROQ_API_KEY = originalKey;
    }
  });

  it('returns 502 and "AI service is unavailable" when fetch throws a network error', async () => {
    const originalKey = config.GROQ_API_KEY;
    config.GROQ_API_KEY = 'mock-groq-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));

    try {
      const res = await request(app)
        .post(`/api/trips/${tripId}/ai-suggestions`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 'moderate', interests: 'food' });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('AI service is unavailable');
      expect(res.body.raw).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
    } finally {
      config.GROQ_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });

  it('returns 502 and "AI service is unavailable" when upstream returns !res.ok', async () => {
    const originalKey = config.GROQ_API_KEY;
    config.GROQ_API_KEY = 'mock-groq-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Groq Server Error'
    });

    try {
      const res = await request(app)
        .post(`/api/trips/${tripId}/ai-suggestions`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 'moderate', interests: 'food' });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('AI service is unavailable');
      expect(res.body.raw).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
    } finally {
      config.GROQ_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });

  it('returns 502 and "AI returned an invalid response" without returning raw output when JSON is invalid', async () => {
    const originalKey = config.GROQ_API_KEY;
    config.GROQ_API_KEY = 'mock-groq-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Sorry, I cannot generate an itinerary for this destination.'
          }
        }]
      })
    });

    try {
      const res = await request(app)
        .post(`/api/trips/${tripId}/ai-suggestions`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ budget: 'moderate', interests: 'food' });

      expect(res.status).toBe(502);
      expect(res.body.message).toBe('AI returned an invalid response');
      expect(res.body.raw).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
    } finally {
      config.GROQ_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });
});
