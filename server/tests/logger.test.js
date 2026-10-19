const logger = require('../utils/logger');

describe('logger unit tests', () => {
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('supports (message, meta) style', () => {
    logger.error('Something went wrong', { userId: '123' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = consoleErrorSpy.mock.calls[0][0];
    expect(logOutput).toContain('Something went wrong');
    expect(logOutput).toContain('"userId":"123"');
  });

  test('supports pino-style ({ err }, message) call', () => {
    const err = new Error('Database connection lost');
    err.code = 'ECONNREFUSED';
    logger.error({ err }, 'Operation failed');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = consoleErrorSpy.mock.calls[0][0];
    expect(logOutput).toContain('Operation failed');
    expect(logOutput).toContain('"name":"Error"');
    expect(logOutput).toContain('"message":"Database connection lost"');
    expect(logOutput).toContain('"code":"ECONNREFUSED"');
  });

  test('serializes Error objects correctly', () => {
    const err = new Error('Custom failure');
    err.code = 'ERR_CUSTOM';
    err.statusCode = 500;
    const serialized = logger.serializeError(err);
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('Custom failure');
    expect(serialized.code).toBe('ERR_CUSTOM');
    expect(serialized.statusCode).toBe(500);
    expect(serialized.stack).toBeDefined();
  });

  test('redact truncates objects deeper than 5 levels', () => {
    const deepObj = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  secretPassword: 'supersecret'
                }
              }
            }
          }
        }
      }
    };
    const redacted = logger.redact(deepObj);
    expect(redacted.level1.level2.level3.level4.level5.level6).toBe('[TRUNCATED]');
  });

  test('redact masks sensitive keys at shallow levels', () => {
    const obj = {
      username: 'john',
      password: 'mypassword',
      token: 'jwt-token-here',
      details: {
        otp: '123456',
        data: 'safe'
      }
    };
    const redacted = logger.redact(obj);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.details.otp).toBe('[REDACTED]');
    expect(redacted.details.data).toBe('safe');
  });
});
