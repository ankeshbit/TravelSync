const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { exploreQuerySchema } = require('../validators/explore');
const cache = require('../services/cache');

/**
 * @swagger
 * /api/explore/destinations:
 *   get:
 *     summary: Fetch grouped destination statistics for explore page
 *     tags: [Explore]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for destination (case-insensitive substring)
 *     responses:
 *       200:
 *         description: List of aggregated destinations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   tripCount:
 *                     type: integer
 *                   coverImageUrl:
 *                     type: string
 *                   averageBudgetPerPerson:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/destinations', verifyToken, validate({ query: exploreQuerySchema }), asyncHandler(async (req, res) => {
  const { q, limit = 50, page = 1 } = req.validatedQuery || req.query;
  const searchFilter = q && typeof q === 'string' ? q.trim().toLowerCase() : '';
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;

  const cacheKey = cache.keys.explore(req.userId, `${searchFilter}:${pageNum}:${limitNum}`);
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const userTrips = await prisma.trip.findMany({
    where: {
      destination: { not: '' },
      OR: [
        { ownerId: req.userId },
        { members: { some: { userId: req.userId } } }
      ]
    },
    select: {
      id: true,
      destination: true,
      coverImageUrl: true,
      budgetPerPerson: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const groupMap = new Map();

  for (const trip of userTrips) {
    const rawDest = (trip.destination || '').trim();
    if (!rawDest) continue;
    const normKey = rawDest.toLowerCase();

    if (searchFilter && !normKey.includes(searchFilter)) {
      continue;
    }

    if (!groupMap.has(normKey)) {
      groupMap.set(normKey, {
        name: rawDest,
        tripCount: 0,
        coverImageUrl: trip.coverImageUrl || '',
        budgetSum: 0,
        budgetCount: 0
      });
    }

    const group = groupMap.get(normKey);
    group.tripCount += 1;
    if (!group.coverImageUrl && trip.coverImageUrl) {
      group.coverImageUrl = trip.coverImageUrl;
    }
    if (typeof trip.budgetPerPerson === 'number' && trip.budgetPerPerson > 0) {
      group.budgetSum += trip.budgetPerPerson;
      group.budgetCount += 1;
    }
  }

  const allDestinations = Array.from(groupMap.values()).map(g => ({
    name: g.name,
    tripCount: g.tripCount,
    coverImageUrl: g.coverImageUrl,
    averageBudgetPerPerson: g.budgetCount > 0 ? Math.round((g.budgetSum / g.budgetCount) * 100) / 100 : 0
  }));

  allDestinations.sort((a, b) => b.tripCount - a.tripCount || a.name.localeCompare(b.name));

  const startIndex = (pageNum - 1) * limitNum;
  const paginated = allDestinations.slice(startIndex, startIndex + limitNum);

  await cache.set(cacheKey, paginated, cache.TTLS.EXPLORE);
  res.setHeader('X-Cache', 'MISS');
  res.json(paginated);
}));

module.exports = router;
