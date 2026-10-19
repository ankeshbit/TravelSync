const { validateMigrationEnv, sanitizeDatabaseUrl, validateEnv } = require('../config/env');

describe('Database Migration and Environment Configuration', () => {
  describe('sanitizeDatabaseUrl', () => {
    it('redacts password from connection URL while preserving other details', () => {
      const url = 'postgresql://neondb_owner:super_secret_password123@ep-cool-project-12345.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
      const sanitized = sanitizeDatabaseUrl(url);

      expect(sanitized).not.toContain('super_secret_password123');
      expect(sanitized).toContain('****');
      expect(sanitized).toContain('neondb_owner');
      expect(sanitized).toContain('ep-cool-project-12345.us-east-2.aws.neon.tech');
      expect(sanitized).toContain('sslmode=require');
    });

    it('handles empty or non-string input safely', () => {
      expect(sanitizeDatabaseUrl('')).toBe('');
      expect(sanitizeDatabaseUrl(null)).toBe('');
      expect(sanitizeDatabaseUrl(undefined)).toBe('');
      expect(sanitizeDatabaseUrl('not a url')).toBe('[malformed-url]');
    });
  });

  describe('validateMigrationEnv (Migration Execution Stage)', () => {
    it('fails when DATABASE_URL is missing', () => {
      const res = validateMigrationEnv({});
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('DATABASE_URL is missing'))).toBe(true);
    });

    it('fails when DATABASE_URL is an invalid URL format', () => {
      const res = validateMigrationEnv({ DATABASE_URL: 'http://localhost/db' });
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('DATABASE_URL must start with postgresql://'))).toBe(true);
    });

    it('fails when DATABASE_URL is pooled (Neon -pooler) and DIRECT_URL is missing', () => {
      const res = validateMigrationEnv({
        DATABASE_URL: 'postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require'
      });
      expect(res.valid).toBe(false);
      expect(res.isPooled).toBe(true);
      expect(res.errors.some(e => e.includes('DIRECT_URL is required for database migrations when DATABASE_URL uses a connection pooler'))).toBe(true);
      // Ensure no credentials leaked in error message
      expect(JSON.stringify(res.errors)).not.toContain('pass');
    });

    it('fails when DATABASE_URL is pooled and DIRECT_URL also points to a pooler', () => {
      const res = validateMigrationEnv({
        DATABASE_URL: 'postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require',
        DIRECT_URL: 'postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require'
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('DIRECT_URL must point to a direct database endpoint'))).toBe(true);
    });

    it('succeeds when DATABASE_URL is pooled and DIRECT_URL is a direct connection', () => {
      const pooled = 'postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require';
      const direct = 'postgresql://user:pass@ep-project.c-6.aws.neon.tech/neondb?sslmode=require';
      const res = validateMigrationEnv({
        DATABASE_URL: pooled,
        DIRECT_URL: direct
      });
      expect(res.valid).toBe(true);
      expect(res.isPooled).toBe(true);
      expect(res.effectiveDirectUrl).toBe(direct);
      expect(res.errors).toHaveLength(0);
    });

    it('succeeds for standalone/direct DATABASE_URL without DIRECT_URL by falling back safely', () => {
      const direct = 'postgresql://postgres:pass@localhost:5432/travelsync?sslmode=disable';
      const res = validateMigrationEnv({
        DATABASE_URL: direct
      });
      expect(res.valid).toBe(true);
      expect(res.isPooled).toBe(false);
      // Transparently defaults effectiveDirectUrl to DATABASE_URL so Prisma CLI directUrl is satisfied
      expect(res.effectiveDirectUrl).toBe(direct);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('validateEnv (Application Startup Stage)', () => {
    it('does not require DIRECT_URL for application startup runtime', () => {
      const config = validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require',
        OTP_SECRET: 'min-32-chars-long-secret-key-valid-for-travelsync',
        ALLOWED_ORIGIN: 'https://travelsync.example.com'
      });

      // App runtime only queries DB with PrismaClient, which uses DATABASE_URL
      expect(config.errors).toHaveLength(0);
      expect(config.DATABASE_URL).toBe('postgresql://user:pass@ep-project-pooler.c-6.aws.neon.tech/neondb?sslmode=require');
      expect(config.DIRECT_URL).toBe('');
    });

    it('validates DIRECT_URL format if provided at application startup', () => {
      const config = validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:pass@ep-project.c-6.aws.neon.tech/neondb?sslmode=require',
        DIRECT_URL: 'invalid-url',
        OTP_SECRET: 'min-32-chars-long-secret-key-valid-for-travelsync',
        ALLOWED_ORIGIN: 'https://travelsync.example.com'
      });

      expect(config.errors.some(e => e.includes('DIRECT_URL is not a valid URL format'))).toBe(true);
    });
  });

  describe('Migration Runner Script (server/scripts/migrate.js)', () => {
    it('exits with code 1 and prints clear error when DIRECT_URL is missing for pooled DB', () => {
      const { execSync } = require('child_process');
      const path = require('path');

      expect(() => {
        execSync('node scripts/migrate.js deploy', {
          cwd: path.join(__dirname, '..'),
          env: {
            ...process.env,
            _DOTENV_LOADED: 'true',
            DATABASE_URL: 'postgresql://u:p@ep-project-pooler.c-6.aws.neon.tech/neondb',
            DIRECT_URL: ''
          },
          stdio: 'pipe'
        });
      }).toThrow();
    });
  });
});
