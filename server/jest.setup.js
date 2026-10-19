if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
if (!process.env.REFRESH_SECRET) process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
if (!process.env.OTP_SECRET) process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
if (!process.env.ALLOWED_ORIGIN) process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
