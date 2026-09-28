const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');

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
router.get('/destinations', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;

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
  } catch (error) {
    console.error('Error in GET /api/explore/destinations:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch explore destinations' });
  }
});

module.exports = router;
