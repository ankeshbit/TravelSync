const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { prisma, ensureUserSynced } = require('../db');

let jwksClient = null;
if (process.env.NEON_AUTH_JWKS_URL) {
  try {
    jwksClient = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  } catch (err) {
    console.warn('Failed to initialize JWKS remote client:', err.message);
  }
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Authorization denied.' });
  }

  let verifiedUserId = null;

  // 1. Check Neon Auth session table in database
  try {
    const sessionRows = await prisma.$queryRawUnsafe(
      'SELECT "userId", "expiresAt" FROM neon_auth.session WHERE token = $1 AND "expiresAt" > NOW()',
      token
    );
    if (sessionRows && sessionRows.length > 0) {
      verifiedUserId = sessionRows[0].userId;
    }
  } catch (dbErr) {
    // If neon_auth schema doesn't exist or table lookup fails, continue to next checks
  }

  // 2. Check Neon Auth JWKS verification (if token is a signed JWT from Neon Auth)
  if (!verifiedUserId && jwksClient) {
    try {
      const { payload } = await jwtVerify(token, jwksClient);
      if (payload && (payload.sub || payload.userId || payload.id)) {
        verifiedUserId = payload.sub || payload.userId || payload.id;
      }
    } catch (jwksErr) {
      // Continue to local secret check
    }
  }

  // 3. Fallback to local JWT verification
  if (!verifiedUserId) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      verifiedUserId = decoded.userId;
    } catch (jwtErr) {
      // Fall through to 401
    }
  }

  if (!verifiedUserId) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  // Ensure user is present in public.users for relational integrity
  await ensureUserSynced(verifiedUserId);

  req.userId = verifiedUserId;
  next();
};

module.exports = { verifyToken };
