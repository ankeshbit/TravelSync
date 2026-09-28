const { validateEnv } = require('../config/env');
const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('Environment & Server Configuration Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('validateEnv accepts valid environment variables', () => {
    const customEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      JWT_SECRET: 'a'.repeat(32),
      REFRESH_SECRET: 'b'.repeat(32),
      ALLOWED_ORIGIN: 'http://localhost:5173,http://localhost:3000',
      NODE_ENV: 'development'
    };

    const config = validateEnv(customEnv);
    expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/testdb');
    expect(config.JWT_SECRET).toBe('a'.repeat(32));
    expect(config.REFRESH_SECRET).toBe('b'.repeat(32));
    expect(config.ALLOWED_ORIGIN).toBe('http://localhost:5173,http://localhost:3000');
    expect(config.isProduction).toBe(false);
    expect(config.errors).toHaveLength(0);
  });

  test('in production mode, fails fast and calls process.exit(1) on missing env vars', () => {
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });
    const errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    const invalidProdEnv = {
      NODE_ENV: 'production'
    };

    expect(() => {
      validateEnv(invalidProdEnv);
    }).toThrow('process.exit: 1');

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalled();

    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  test('in production mode, fails fast if JWT_SECRET is less than 32 characters', () => {
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });
    const errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    const invalidProdEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'short-secret',
      REFRESH_SECRET: 'b'.repeat(32),
      ALLOWED_ORIGIN: 'https://example.com'
    };

    expect(() => {
      validateEnv(invalidProdEnv);
    }).toThrow('process.exit: 1');

    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  test('in production mode, fails fast if REFRESH_SECRET matches JWT_SECRET', () => {
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });
    const errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    const sameSecret = 'c'.repeat(32);
    const invalidProdEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: sameSecret,
      REFRESH_SECRET: sameSecret,
      ALLOWED_ORIGIN: 'https://example.com'
    };

    expect(() => {
      validateEnv(invalidProdEnv);
    }).toThrow('process.exit: 1');

    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  test('in development mode, warns but does not exit when variables are missing', () => {
    const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const devMissingEnv = {
      NODE_ENV: 'development'
    };

    const config = validateEnv(devMissingEnv);
    expect(exitMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
    expect(config.isProduction).toBe(false);
    expect(config.errors.length).toBeGreaterThan(0);

    exitMock.mockRestore();
    warnMock.mockRestore();
  });

  describe('CORS behavior verification', () => {
    const createTestApp = (envConfig) => {
      const app = express();
      const allowedOrigins = (envConfig.ALLOWED_ORIGIN || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

      const isAllowedOrigin = (origin) => {
        if (!origin) return true;
        if (!envConfig.isProduction) {
          if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return true;
          }
        }
        return allowedOrigins.includes(origin);
      };

      app.use(cors({
        origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
        credentials: true
      }));
      app.use(express.json({ limit: '1mb' }));
      app.post('/test-endpoint', (req, res) => res.json({ ok: true, data: req.body }));
      return app;
    };

    test('allows localhost in non-production mode', async () => {
      const app = createTestApp({
        isProduction: false,
        ALLOWED_ORIGIN: 'https://production-app.com'
      });

      const res = await request(app)
        .post('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .send({ message: 'hello' });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.status).toBe(200);
    });

    test('blocks localhost in production mode if not in ALLOWED_ORIGIN', async () => {
      const app = createTestApp({
        isProduction: true,
        ALLOWED_ORIGIN: 'https://app.travelsync.com,https://admin.travelsync.com'
      });

      const res = await request(app)
        .post('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .send({ message: 'hello' });

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('supports comma-separated ALLOWED_ORIGIN in production', async () => {
      const app = createTestApp({
        isProduction: true,
        ALLOWED_ORIGIN: 'https://app.travelsync.com, https://admin.travelsync.com'
      });

      const res1 = await request(app)
        .post('/test-endpoint')
        .set('Origin', 'https://app.travelsync.com')
        .send({ message: 'hello' });

      expect(res1.headers['access-control-allow-origin']).toBe('https://app.travelsync.com');

      const res2 = await request(app)
        .post('/test-endpoint')
        .set('Origin', 'https://admin.travelsync.com')
        .send({ message: 'hello' });

      expect(res2.headers['access-control-allow-origin']).toBe('https://admin.travelsync.com');
    });

    test('enforces 1mb JSON payload limit', async () => {
      const app = createTestApp({
        isProduction: false,
        ALLOWED_ORIGIN: 'http://localhost:5173'
      });

      // Generate a payload slightly larger than 1MB
      const largePayload = { largeString: 'x'.repeat(1024 * 1024 + 100) };

      const res = await request(app)
        .post('/test-endpoint')
        .send(largePayload);

      expect(res.status).toBe(413); // Payload Too Large
    });
  });
});
