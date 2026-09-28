const { errorHandler, asyncHandler } = require('../middleware/errorHandler');

describe('errorHandler middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let consoleErrorSpy;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      originalUrl: '/api/test-endpoint',
      userId: 'test-user-123',
      headers: {
        'x-request-id': 'custom-req-id-abc'
      }
    };
    mockRes = {
      statusCode: null,
      headers: {},
      status: jest.fn().mockImplementation(function (code) {
        this.statusCode = code;
        return this;
      }),
      setHeader: jest.fn().mockImplementation(function (key, val) {
        this.headers[key] = val;
        return this;
      }),
      json: jest.fn().mockImplementation(function (body) {
        this.body = body;
        return this;
      })
    };
    mockNext = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  describe('Request-ID and logging', () => {
    it('should include request-id and requestId in response and set header', () => {
      const err = new Error('Test generic failure');
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-Id', 'custom-req-id-abc');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'custom-req-id-abc',
          'request-id': 'custom-req-id-abc',
          success: false
        })
      );
    });

    it('should generate a uuid if no request ID is provided', () => {
      mockReq.headers = {};
      const err = new Error('No header failure');
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          'request-id': expect.any(String)
        })
      );
    });

    it('should log errors with method, path, and userId', () => {
      const err = new Error('Specific failure logged');
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [custom-req-id-abc] POST /api/test-endpoint - User: test-user-123')
      );
    });
  });

  describe('Prisma Error Mapping', () => {
    it('maps P2002 to 409 (unique constraint)', () => {
      const err = new Error('Unique constraint failed on the constraint: email_unique');
      err.code = 'P2002';
      err.meta = { target: ['email'] };

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'P2002',
          message: expect.stringContaining('Unique constraint failed on field(s): email')
        })
      );
    });

    it('maps P2025 to 404 (record not found)', () => {
      const err = new Error('An operation failed because it depends on one or more records that were required but not found');
      err.code = 'P2025';
      err.meta = { cause: 'Record to update not found.' };

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'P2025',
          message: 'Record to update not found.'
        })
      );
    });

    it('maps P2003 to 400 (foreign key constraint)', () => {
      const err = new Error('Foreign key constraint failed on the field: userId');
      err.code = 'P2003';
      err.meta = { field_name: 'userId' };

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'P2003',
          message: expect.stringContaining('Foreign key constraint failed on field: userId')
        })
      );
    });

    it('maps PrismaClientValidationError to 400', () => {
      const err = new Error('Invalid `prisma.trip.create()` invocation: Unknown argument `unknownField`');
      err.name = 'PrismaClientValidationError';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Unknown argument')
        })
      );
    });

    it('maps PrismaClientInitializationError to 503', () => {
      const err = new Error('Can\'t reach database server at postgres://...');
      err.name = 'PrismaClientInitializationError';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: expect.stringContaining('Can\'t reach database server')
        })
      );
    });
  });

  describe('Production privacy guarantees', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('never leaks raw Prisma messages or stack traces for P2002', () => {
      const err = new Error('Raw Prisma SQL internal constraint dump: table "Trip" column "name"');
      err.code = 'P2002';
      err.stack = 'Error: Raw Prisma SQL at line 123...';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      const jsonResponse = mockRes.json.mock.calls[0][0];
      expect(jsonResponse.message).toBe('A record with this identifier already exists.');
      expect(jsonResponse.stack).toBeUndefined();
    });

    it('never leaks raw Prisma messages or stack traces for PrismaClientValidationError', () => {
      const err = new Error('Prisma schema validation stack trace and internal AST query representation');
      err.name = 'PrismaClientValidationError';
      err.stack = 'Error: Validation error at prisma client AST';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const jsonResponse = mockRes.json.mock.calls[0][0];
      expect(jsonResponse.message).toBe('Invalid request payload or query parameters.');
      expect(jsonResponse.stack).toBeUndefined();
    });

    it('never leaks raw Prisma messages or stack traces for PrismaClientInitializationError', () => {
      const err = new Error('postgres://neon_user:secret_password@ep-neon-pooler.us-east-2.aws.neon.tech/neondb');
      err.name = 'PrismaClientInitializationError';
      err.stack = 'Connection error stack with secrets';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const jsonResponse = mockRes.json.mock.calls[0][0];
      expect(jsonResponse.message).toBe('Database service is temporarily unavailable.');
      expect(jsonResponse.stack).toBeUndefined();
    });

    it('never leaks stack trace for generic errors in production', () => {
      const err = new Error('Internal system failure');
      err.stack = 'Secret file trace';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonResponse = mockRes.json.mock.calls[0][0];
      expect(jsonResponse.message).toBe('Internal server error');
      expect(jsonResponse.stack).toBeUndefined();
    });
  });

  describe('asyncHandler wrapper', () => {
    it('catches thrown error from async route and calls next(err)', async () => {
      const errorToThrow = new Error('Async test failure');
      const asyncRoute = asyncHandler(async () => {
        throw errorToThrow;
      });

      const nextSpy = jest.fn();
      await asyncRoute(mockReq, mockRes, nextSpy);

      expect(nextSpy).toHaveBeenCalledWith(errorToThrow);
    });

    it('passes normal execution through if no error thrown', async () => {
      let executed = false;
      const asyncRoute = asyncHandler(async (req, res) => {
        executed = true;
        res.status(200).json({ ok: true });
      });

      const nextSpy = jest.fn();
      await asyncRoute(mockReq, mockRes, nextSpy);

      expect(executed).toBe(true);
      expect(nextSpy).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Additional Error Mappings', () => {
    const { AppError } = require('../middleware/errorHandler');

    it('maps AppError with custom status and code', () => {
      const err = new AppError('Resource unavailable', 422, 'UNPROCESSABLE_ENTITY');
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNPROCESSABLE_ENTITY',
          message: 'Resource unavailable'
        })
      );
    });

    it('maps P2024 to 503 (pool timeout)', () => {
      const err = new Error('Pool timeout');
      err.code = 'P2024';
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connection timed out.'
        })
      );
    });

    it('maps P1001/P1002/P1017 to 503 (DB unreachable)', () => {
      const err = new Error('Unreachable');
      err.code = 'P1001';
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database service is currently unreachable.'
        })
      );
    });

    it('maps body-parser SyntaxError to 400', () => {
      const err = new SyntaxError('Unexpected token in JSON');
      err.status = 400;
      err.body = '{ bad json';
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body.'
        })
      );
    });

    it('maps entity.too.large to 413', () => {
      const err = new Error('Too big');
      err.type = 'entity.too.large';
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds allowable limit.'
        })
      );
    });

    it('maps Multer LIMIT_FILE_SIZE to 400', () => {
      const err = new Error('File too large');
      err.name = 'MulterError';
      err.code = 'LIMIT_FILE_SIZE';
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'LIMIT_FILE_SIZE',
          message: 'File exceeds the maximum allowed size (5MB).'
        })
      );
    });

    it('maps CORS rejection to 403', () => {
      const err = new Error('Not allowed by CORS');
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CORS_ERROR',
          message: 'Not allowed by CORS'
        })
      );
    });
  });
});

