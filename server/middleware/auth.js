// Authentication middleware — uses shared verifyAuthToken
// Reusable across both Express REST routes and Socket.IO
const { verifyAuthToken, isDatabaseDownError } = require('../utils/verifyAuthToken');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Authorization denied.' });
  }

  try {
    const user = await verifyAuthToken(token);
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    if (err.statusCode === 503 || isDatabaseDownError(err)) {
      console.error('[verifyToken] Database unavailable error:', err.message || err);
      return res.status(503).json({ message: 'Database service unavailable. Please try again later.' });
    }
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({ message: err.message || 'Invalid or expired token.' });
  }
};

module.exports = { verifyToken, isDatabaseDownError };
