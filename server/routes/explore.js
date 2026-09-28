const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { exploreQuerySchema } = require('../validators/explore');

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
  const { q, limit, page } = req.query;

  const where = {
    destination: {
      not: ''
    }
  };

  if (q && typeof q === 'string' && q.trim()) {
    where.destination = {
      not: '',
      contains: q.trim(),
      mode: 'insensitive'
    };
  }

  const groups = await prisma.trip.groupBy({
    by: ['destination'],
    take: limit || 50,
    skip: ((page || 1) - 1) * (limit || 50),
    where,
    _count: {
      destination: true
    },
    _avg: {
      budgetPerPerson: true
    },
    orderBy: {
      _count: {
        destination: 'desc'
      }
    }
  });

  const destinations = await Promise.all(
    groups.map(async (group) => {
      const recentTripWithImage = await prisma.trip.findFirst({
        where: {
          destination: group.destination,
          coverImageUrl: {
            not: ''
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          coverImageUrl: true
        }
      });

      return {
        name: group.destination,
        tripCount: group._count?.destination || 0,
        coverImageUrl: recentTripWithImage?.coverImageUrl || '',
        averageBudgetPerPerson: Math.round((group._avg?.budgetPerPerson || 0) * 100) / 100
      };
    })
  );

  res.json(destinations);
}));

module.exports = router;
