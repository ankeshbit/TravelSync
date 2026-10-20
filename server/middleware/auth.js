// Authentication middleware — uses shared verifyAuthToken
// Reusable across both Express REST routes and Socket.IO
const { verifyAuthToken, isDatabaseDownError } = require('../utils/verifyAuthToken');
const logger = require('../utils/logger');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Authorization denied.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: 'No token provided. Authorization denied.' });
  }

  try {
    const isDeletionRoute = req.method === 'DELETE' && (req.path === '/me' || req.originalUrl?.includes('/auth/me'));
    const user = await verifyAuthToken(token, { allowPendingDeletion: isDeletionRoute });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    if (err.statusCode === 503 || isDatabaseDownError(err)) {
      logger.error({ err }, '[verifyToken] Database unavailable error');
      return res.status(503).json({ message: 'Database service unavailable. Please try again later.' });
    }
    const statusCode = err.statusCode || 500;
    const body = { message: err.message || 'Internal server error.' };
    if (err.code) {
      body.code = err.code;
    }
    return res.status(statusCode).json(body);
  }
};

module.exports = { verifyToken, isDatabaseDownError };
