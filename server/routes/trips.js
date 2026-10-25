const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/env');
const { prisma, formatTrip, formatPlace, formatExpense, formatUser, formatActivity, calculateDurationDays } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { createLimiterStore } = require('../middleware/rateLimiter');
const { getIO, removeUserFromTripRoom, removeAllUsersFromTripRoom } = require('../socket');
const logActivity = require('../utils/logActivity');
const { calculateBalances } = require('../utils/calculateBalances');
const logger = require('../utils/logger');
const cache = require('../services/cache');
const crypto = require('crypto');
const { createTripSchema, updateTripSchema, addMemberSchema, aiSuggestionsSchema, offlineSyncSchema } = require('../validators/trip');
const { createPlaceSchema, updatePlaceNoteSchema, reorderPlacesSchema } = require('../validators/place');
const { createExpenseSchema } = require('../validators/expense');
const { tripIdParamSchema, idParamSchema, tripAndPlaceParamSchema, tripAndExpenseParamSchema, tripAndMemberParamSchema } = require('../validators/common');

// AI suggestion limiter: 5 requests per 10 minutes, backed by Redis with memory fallback
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  store: createLimiterStore('ai_planner'),
  keyGenerator: (req) => req.userId || ipKeyGenerator(req),
  message: {
    message: 'Too many itinerary requests, please try again in 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
router.aiLimiter = aiLimiter;

// Middleware to check if user is a member of the trip (place before specific routes)
const checkTripMembership = asyncHandler(async (req, res, next) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    select: {
      id: true,
      ownerId: true,
      currency: true,
      members: {
        select: { userId: true }
      }
    }
  });

  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const isOwner = trip.ownerId === req.userId;
  const isMember = trip.members.some(m => m.userId === req.userId);

  if (!isOwner && !isMember) {
    return res.status(403).json({ message: 'Access denied' });
  }

  req.trip = trip; // Attach trip to request
  next();
});

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Fetch all trips for the logged-in user
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of trips returned
 *       401:
 *         description: Unauthorized
 */
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { ownerId: req.userId },
      { members: { some: { userId: req.userId } } }
    ]
  };

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, picture: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } },
        places: true,
        expenses: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            splits: { include: { user: { select: { id: true, name: true, email: true } } } }
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.trip.count({ where })
  ]);

  res.json({
    trips: trips.map(formatTrip),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  });
}));

/**
 * @swagger
 * /api/trips/summary:
 *   get:
 *     summary: Fetch overview statistics for user's trips
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Overview statistics returned
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', verifyToken, asyncHandler(async (req, res) => {
  const cacheKey = cache.keys.dashboard(req.userId);
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const where = {
    OR: [
      { ownerId: req.userId },
      { members: { some: { userId: req.userId } } }
    ]
  };

  const userTrips = await prisma.trip.findMany({
    where,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      currency: true,
      ownerId: true,
      members: {
        select: {
          userId: true
        }
      },
      expenses: {
        select: {
          amount: true,
          paidById: true,
          currency: true
        }
      }
    }
  });

  const totalTrips = userTrips.length;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const upcomingTrips = userTrips.filter(t => {
    const status = (t.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled') return false;
    if (status === 'upcoming') return true;
    if (t.startDate) {
      const start = new Date(t.startDate);
      return !isNaN(start.getTime()) && start.getTime() >= today;
    }
    return false;
  }).length;

  const memberSet = new Set();
  userTrips.forEach(t => {
    if (t.ownerId) memberSet.add(t.ownerId);
    if (Array.isArray(t.members)) {
      t.members.forEach(m => {
        if (m.userId) memberSet.add(m.userId);
      });
    }
  });
  const totalMembers = memberSet.size;

  // Track gross spending paid by the user, aggregated per currency
  const spentByCurrency = {};

  userTrips.forEach(t => {
    const tripCurrency = (typeof t.currency === 'string' && t.currency.trim())
      ? t.currency.trim().toUpperCase()
      : 'INR';

    if (Array.isArray(t.expenses)) {
      t.expenses.forEach(e => {
        if (e.paidById === req.userId) {
          const rawAmount = Number(e.amount);
          if (!isNaN(rawAmount) && rawAmount > 0) {
            const expCurrency = (typeof e.currency === 'string' && e.currency.trim())
              ? e.currency.trim().toUpperCase()
              : tripCurrency;
            spentByCurrency[expCurrency] = (spentByCurrency[expCurrency] || 0) + rawAmount;
          }
        }
      });
    }
  });

  // Round amounts to 2 decimal places
  for (const curr of Object.keys(spentByCurrency)) {
    spentByCurrency[curr] = Math.round(spentByCurrency[curr] * 100) / 100;
  }

  // Determine fallback/primary currency: preserve trip's stored currency, default to INR only when needed
  const primaryTripCurrency = userTrips.find(t => typeof t.currency === 'string' && t.currency.trim())?.currency?.trim().toUpperCase();
  const defaultCurrency = primaryTripCurrency || 'INR';

  const distinctCurrencies = Object.keys(spentByCurrency);

  let totalSpent;
  let currency;
  let hasMultipleCurrencies = false;

  if (distinctCurrencies.length === 0) {
    // Zero expenses
    currency = defaultCurrency;
    totalSpent = 0;
    spentByCurrency[currency] = 0;
    hasMultipleCurrencies = false;
  } else if (distinctCurrencies.length === 1) {
    // Single currency: safe scalar total
    currency = distinctCurrencies[0];
    totalSpent = spentByCurrency[currency];
    hasMultipleCurrencies = false;
  } else {
    // Multiple currencies: DO NOT add different currencies without conversion
    hasMultipleCurrencies = true;
    totalSpent = null;
    currency = defaultCurrency || distinctCurrencies[0];
  }

  const payload = {
    totalTrips,
    upcomingTrips,
    totalMembers,
    totalSpent,
    currency,
    spentByCurrency,
    hasMultipleCurrencies
  };

  await cache.set(cacheKey, payload, cache.TTLS.DASHBOARD);
  res.setHeader('X-Cache', 'MISS');
  res.json(payload);
}));

/**
 * @swagger
 * /api/trips:
 *   post:
 *     summary: Create new trip
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, destination, startDate, endDate]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Europe Trip 2026
 *               destination:
 *                 type: string
 *                 example: Paris, France
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-06-01
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-06-15
 *     responses:
 *       201:
 *         description: Trip created successfully
 *       400:
 *         description: Bad request (missing fields)
 */
router.post('/', verifyToken, validate({ body: createTripSchema }), asyncHandler(async (req, res) => {
  const { name, destination, startDate, endDate, budgetPerPerson, currency, status } = req.body;
  // Body already validated and coerced by Zod (dates are Date objects)

  const savedTrip = await prisma.trip.create({
    data: {
      name: name.trim(),
      destination: destination.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      budgetPerPerson: budgetPerPerson ?? 0,
      currency: currency || 'INR',
      status: status || 'planning',
      ownerId: req.userId,
      members: {
        create: [{ userId: req.userId }]
      }
    },
    include: {
      owner: { select: { id: true, name: true, email: true, picture: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } },
      places: true,
      expenses: true
    }
  });

  res.status(201).json(formatTrip(savedTrip));

  // Invalidate user dashboard and explore caches
  cache.invalidateUserDashboard(req.userId).catch(() => {});
  cache.invalidateExplore(req.userId).catch(() => {});

  // Non-blocking: fetch a cover image from Unsplash and patch the trip in the background
  fetchAndAttachCoverImage(savedTrip.id, destination);
}));

/**
 * Fetches the most relevant landscape photo for a destination from Unsplash
 * and saves the URL to the trip's coverImageUrl field.
 * Runs entirely in the background — never throws to the caller.
 */
async function fetchAndAttachCoverImage(tripId, destination) {
  const accessKey = config.UNSPLASH_ACCESS_KEY;
  if (!accessKey || accessKey === 'your_unsplash_access_key_here') {
    return; // Key not configured — skip silently
  }

  try {
    const query = encodeURIComponent(destination);
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      }
    });

    if (!response.ok) {
      logger.warn({ status: response.status, destination }, '[CoverImage] Unsplash returned non-OK status');
      return;
    }

    const data = await response.json();
    const photo = data.results && data.results[0];

    if (!photo || !photo.urls || !photo.urls.regular) {
      logger.warn({ destination }, '[CoverImage] No photo results');
      return;
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: { coverImageUrl: photo.urls.regular }
    });

    const updatedTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        places: true,
        expenses: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            splits: {
              orderBy: { id: 'asc' },
              include: { user: { select: { id: true, name: true, email: true } } }
            }
          }
        }
      }
    });

    if (updatedTrip) {
      getIO().to(`trip:${tripId}`).emit('trip:updated', formatTrip(updatedTrip));
    }
  } catch (err) {
    // Silently swallow — image is non-critical
    logger.warn({ err, destination }, '[CoverImage] Failed to fetch cover image');
  }
}

// --- MEMBERS API ---

/**
 * @swagger
 * /api/trips/{tripId}/members:
 *   get:
 *     summary: Fetch all members of a trip
 *     tags: [Members]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of trip members returned
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.get('/:tripId/members', verifyToken, asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: {
      owner: { select: { id: true, name: true, email: true, picture: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } }
    }
  });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const isOwner = trip.ownerId === req.userId;
  const isMember = trip.members.some(m => m.userId === req.userId);
  if (!isOwner && !isMember) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const memberUsers = trip.members.map(m => formatUser(m.user));
  res.json(memberUsers);
}));

/**
 * @swagger
 * /api/trips/{tripId}/members:
 *   post:
 *     summary: Invite member by email
 *     tags: [Members]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: friend@example.com
 *     responses:
 *       200:
 *         description: Member added successfully
 *       400:
 *         description: Bad request (user already member)
 *       403:
 *         description: Access denied (only owner can invite)
 *       404:
 *         description: User or Trip not found
 */
router.post('/:tripId/members', verifyToken,
  validate({ params: tripIdParamSchema, body: addMemberSchema }),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    // email already validated and lowercased by Zod

    const trip = await prisma.trip.findUnique({
      where: { id: req.params.tripId },
      include: { members: true }
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId !== req.userId) {
      return res.status(403).json({ message: 'Only the trip owner can invite members' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    if (trip.members.some(m => m.userId === user.id)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    if (trip.ownerId === user.id) {
      return res.status(400).json({ message: 'Owner is already part of the trip' });
    }

    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: user.id
      }
    });

    await logActivity(req.params.tripId, req.userId, 'invited a member', user.email);

    const updatedTrip = await prisma.trip.findUnique({
      where: { id: req.params.tripId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        places: true,
        expenses: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            splits: { include: { user: { select: { id: true, name: true, email: true } } } }
          }
        }
      }
    });

    getIO().to(`trip:${req.params.tripId}`).emit('member:joined', {
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture
    });

    const memberIds = [updatedTrip.ownerId, ...(updatedTrip.members || []).map(m => m.user?.id || m.userId)];
    cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

    res.status(200).json(formatTrip(updatedTrip));
  }));

/**
 * @swagger
 * /api/trips/{tripId}/members/{userId}:
 *   delete:
 *     summary: Remove member from trip
 *     tags: [Members]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: Bad request (cannot remove owner)
 *       403:
 *         description: Access denied (only owner can remove)
 *       404:
 *         description: User or Trip not found
 */
router.delete('/:tripId/members/me', verifyToken, validate({ params: tripIdParamSchema }), asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: { members: true }
  });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  if (trip.ownerId === req.userId) {
    return res.status(400).json({ message: 'Cannot leave the trip as the owner' });
  }

  const isMember = trip.members.some(m => m.userId === req.userId);
  if (!isMember) {
    return res.status(404).json({ message: 'You are not a member of this trip' });
  }

  const [userExpensesCount, userSplitsCount] = await Promise.all([
    prisma.expense.count({
      where: { tripId: trip.id, paidById: req.userId }
    }),
    prisma.expenseSplit.count({
      where: {
        expense: { tripId: trip.id },
        userId: req.userId
      }
    })
  ]);

  if (userExpensesCount > 0 || userSplitsCount > 0) {
    return res.status(409).json({ message: 'Cannot leave trip with existing expenses or splits' });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  const userEmail = currentUser ? currentUser.email : 'Unknown';

  await prisma.tripMember.deleteMany({
    where: {
      tripId: trip.id,
      userId: req.userId
    }
  });

  await removeUserFromTripRoom(req.params.tripId, req.userId);
  await logActivity(req.params.tripId, req.userId, 'left the trip', userEmail);

  cache.invalidateTrip(req.params.tripId, [trip.ownerId, req.userId]).catch(() => {});

  res.status(200).json({ message: 'Successfully left the trip' });
}));

router.delete('/:tripId/members/:userId', verifyToken, validate({ params: tripAndMemberParamSchema }), asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: { members: true }
  });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  if (trip.ownerId !== req.userId) {
    return res.status(403).json({ message: 'Only the trip owner can remove members' });
  }

  if (trip.ownerId === req.params.userId) {
    return res.status(400).json({ message: 'Cannot remove the trip owner' });
  }

  const isMember = trip.members.some(m => m.userId === req.params.userId);
  if (!isMember) {
    return res.status(404).json({ message: 'User is not a member of this trip' });
  }

  const [userExpensesCount, userSplitsCount] = await Promise.all([
    prisma.expense.count({
      where: { tripId: trip.id, paidById: req.params.userId }
    }),
    prisma.expenseSplit.count({
      where: {
        expense: { tripId: trip.id },
        userId: req.params.userId
      }
    })
  ]);

  if (userExpensesCount > 0 || userSplitsCount > 0) {
    return res.status(409).json({ message: 'Cannot remove member with existing expenses or splits in the trip' });
  }

  const removedUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
  const removedEmail = removedUser ? removedUser.email : 'Unknown';

  await prisma.tripMember.deleteMany({
    where: {
      tripId: trip.id,
      userId: req.params.userId
    }
  });

  await removeUserFromTripRoom(req.params.tripId, req.params.userId);
  await logActivity(req.params.tripId, req.userId, 'removed a member', removedEmail);

  const updatedTrip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      places: true,
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: {
            orderBy: { id: 'asc' },
            include: { user: { select: { id: true, name: true, email: true } } }
          }
        }
      }
    }
  });

  const memberIds = [updatedTrip.ownerId, req.params.userId, ...(updatedTrip.members || []).map(m => m.user?.id || m.userId)];
  cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

  res.status(200).json(formatTrip(updatedTrip));
}));

// --- PLACES API ---

/**
 * @swagger
 * /api/trips/{tripId}/places:
 *   get:
 *     summary: Fetch all places in the itinerary
 *     tags: [Places]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of places returned
 */
router.get('/:tripId/places', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const places = await prisma.place.findMany({
    where: { tripId: req.params.tripId },
    orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }]
  });
  res.json(places.map(formatPlace));
}));

/**
 * @swagger
 * /api/trips/{tripId}/places:
 *   post:
 *     summary: Add place to itinerary
 *     tags: [Places]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, lat, lng, dayNumber, orderIndex]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Eiffel Tower
 *               address:
 *                 type: string
 *                 example: Champ de Mars, Paris
 *               lat:
 *                 type: number
 *                 example: 48.8584
 *               lng:
 *                 type: number
 *                 example: 2.2945
 *               dayNumber:
 *                 type: integer
 *                 example: 1
 *               orderIndex:
 *                 type: integer
 *                 example: 0
 *     responses:
 *       201:
 *         description: Place added successfully
 */
router.post('/:tripId/places', verifyToken, checkTripMembership,
  validate({ params: tripIdParamSchema, body: createPlaceSchema }),
  asyncHandler(async (req, res) => {
    const { name, address, lat, lng, dayNumber, orderIndex, category, duration, note } = req.body;
    // All values already validated and coerced by Zod
    let computedOrder = orderIndex;
    if (computedOrder === undefined || computedOrder === null) {
      computedOrder = await prisma.place.count({
        where: { tripId: req.params.tripId, dayNumber: Number(dayNumber) }
      });
    }

    const createdPlace = await prisma.place.create({
      data: {
        tripId: req.params.tripId,
        name,
        address: address || '',
        lat: lat ?? 0,
        lng: lng ?? 0,
        dayNumber: dayNumber ?? 1,
        orderIndex: computedOrder ?? 0,
        category: category || 'attraction',
        duration: duration ?? 60,
        note: note || ''
      }
    });

    await logActivity(req.params.tripId, req.userId, 'added a place', `${createdPlace.name} on Day ${createdPlace.dayNumber}`);

    const formatted = formatPlace(createdPlace);
    getIO().to(`trip:${req.params.tripId}`).emit('place:added', formatted);

    const memberIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
    cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

    res.status(201).json(formatted);
  }));

/**
 * @swagger
 * /api/trips/{tripId}/places/{placeId}:
 *   delete:
 *     summary: Delete place from itinerary
 *     tags: [Places]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: placeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Place deleted successfully
 *       404:
 *         description: Place not found
 */
router.delete('/:tripId/places/:placeId', verifyToken, checkTripMembership, validate({ params: tripAndPlaceParamSchema }), asyncHandler(async (req, res) => {
  const place = await prisma.place.findUnique({
    where: { id: req.params.placeId }
  });
  if (!place || place.tripId !== req.params.tripId) {
    return res.status(404).json({ message: 'Place not found' });
  }

  await prisma.place.delete({
    where: { id: req.params.placeId }
  });

  await logActivity(req.params.tripId, req.userId, 'removed a place', place.name);

  getIO().to(`trip:${req.params.tripId}`).emit('place:deleted', { placeId: req.params.placeId });

  const memberIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
  cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

  res.json({ message: 'Place deleted' });
}));

/**
 * @swagger
 * /api/trips/{tripId}/places/{placeId}/note:
 *   patch:
 *     summary: Update location note
 *     tags: [Places]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: placeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note]
 *             properties:
 *               note:
 *                 type: string
 *                 example: Must visit early morning.
 *     responses:
 *       200:
 *         description: Note updated successfully
 */
router.patch('/:tripId/places/:placeId/note', verifyToken, checkTripMembership,
  validate({ params: tripAndPlaceParamSchema, body: updatePlaceNoteSchema }),
  asyncHandler(async (req, res) => {
    const { note } = req.body;
    // note already validated by Zod

    const place = await prisma.place.findUnique({
      where: { id: req.params.placeId }
    });
    if (!place || place.tripId !== req.params.tripId) {
      return res.status(404).json({ message: 'Place not found' });
    }

    const updated = await prisma.place.update({
      where: { id: req.params.placeId },
      data: { note: note || '' }
    });

    const formatted = formatPlace(updated);
    getIO().to(`trip:${req.params.tripId}`).emit('place:note_updated', formatted);

    const memberIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
    cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

    res.json(formatted);
  }));

/**
 * @swagger
 * /api/trips/{tripId}/places/reorder:
 *   patch:
 *     summary: Reorder places within itinerary
 *     tags: [Places]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Places reordered successfully
 */
router.patch('/:tripId/places/reorder', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const parseResult = reorderPlacesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      message: 'Invalid reorder data',
      errors: parseResult.error.format()
    });
  }

  const updates = parseResult.data; // Array of { placeId, dayNumber, orderIndex }

  if (updates.length > 0) {
    const placeIds = [...new Set(updates.map(u => u.placeId))];
    const matchingCount = await prisma.place.count({
      where: {
        id: { in: placeIds },
        tripId: req.params.tripId
      }
    });

    if (matchingCount !== placeIds.length) {
      return res.status(400).json({ message: 'One or more places do not belong to this trip.' });
    }

    await prisma.$transaction(
      updates.map(update => prisma.place.update({
        where: { id: update.placeId },
        data: {
          dayNumber: update.dayNumber,
          orderIndex: update.orderIndex
        }
      }))
    );
  }

  const allPlaces = await prisma.place.findMany({
    where: { tripId: req.params.tripId },
    orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }]
  });

  const formattedPlaces = allPlaces.map(formatPlace);
  getIO().to(`trip:${req.params.tripId}`).emit('place:reordered', formattedPlaces);

  const memberIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
  cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});

  res.json(formattedPlaces);
}));

// --- EXPENSES API ---

/**
 * @swagger
 * /api/trips/{tripId}/expenses:
 *   get:
 *     summary: Fetch all expenses for a trip
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of expenses returned
 */
router.get('/:tripId/expenses', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where: { tripId: req.params.tripId },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.expense.count({ where: { tripId: req.params.tripId } })
  ]);

  res.json({
    expenses: expenses.map(formatExpense),
    currency: req.trip?.currency || 'INR',
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  });
}));

/**
 * @swagger
 * /api/trips/{tripId}/expenses:
 *   post:
 *     summary: Add new expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, amount, paidBy, splitAmong]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Dinner
 *               amount:
 *                 type: number
 *                 example: 100
 *               currency:
 *                 type: string
 *                 example: INR
 *               paidBy:
 *                 type: string
 *                 example: USER_ID
 *               splitAmong:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Expense added successfully
 *       400:
 *         description: Bad request (missing fields)
 */
router.post('/:tripId/expenses', verifyToken, checkTripMembership,
  validate({ params: tripIdParamSchema, body: createExpenseSchema }),
  asyncHandler(async (req, res) => {
    const { title, amount, currency, category, receiptUrl, paidBy, splitAmong } = req.body;
    // All fields already validated by Zod

    const trip = req.trip;
    const allMemberIds = [trip.ownerId, ...trip.members.map(m => m.userId)];

    if (!allMemberIds.includes(paidBy)) {
      return res.status(400).json({ message: 'paidBy user is not a member of this trip' });
    }

    const rawSplits = splitAmong.map(u => (typeof u === 'object' && u ? (u._id || u.id) : u));
    const normalizedSplits = Array.from(new Set(rawSplits));

    const invalidMembers = normalizedSplits.filter(userId => !allMemberIds.includes(userId));
    if (invalidMembers.length > 0) {
      return res.status(400).json({ message: 'One or more split members are not trip members' });
    }

    const createdExpense = await prisma.expense.create({
      data: {
        tripId: req.params.tripId,
        title: title.trim(),
        amount: parseFloat(amount),
        currency: currency || trip.currency || 'INR',
        category: category || 'other',
        receiptUrl: receiptUrl || '',
        paidById: paidBy,
        splits: {
          create: normalizedSplits.map(userId => ({ userId }))
        }
      },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          orderBy: { id: 'asc' },
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    await logActivity(req.params.tripId, req.userId, 'added an expense', `${createdExpense.title} — ${createdExpense.currency} ${createdExpense.amount}`);

    const formatted = formatExpense(createdExpense);
    getIO().to(`trip:${req.params.tripId}`).emit('expense:added', formatted);

    cache.invalidateTrip(req.params.tripId, allMemberIds).catch(() => {});

    res.status(201).json(formatted);
  }));

/**
 * @swagger
 * /api/trips/{tripId}/expenses/{expenseId}:
 *   delete:
 *     summary: Delete expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Expense deleted successfully
 *       404:
 *         description: Expense not found
 */
router.delete('/:tripId/expenses/:expenseId', verifyToken, checkTripMembership, validate({ params: tripAndExpenseParamSchema }), asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findUnique({
    where: { id: req.params.expenseId }
  });
  if (!expense || expense.tripId !== req.params.tripId) {
    return res.status(404).json({ message: 'Expense not found' });
  }

  if (expense.paidById !== req.userId && req.trip.ownerId !== req.userId) {
    return res.status(403).json({ message: 'Only the expense creator or trip owner can delete' });
  }

  await prisma.expense.delete({
    where: { id: req.params.expenseId }
  });

  await logActivity(req.params.tripId, req.userId, 'deleted an expense', expense.title);

  getIO().to(`trip:${req.params.tripId}`).emit('expense:deleted', { expenseId: req.params.expenseId });

  const memberIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
  cache.invalidateTrip(req.params.tripId, memberIds).catch(() => {});
  cache.invalidateUserDashboard(memberIds).catch(() => {});

  res.json({ message: 'Expense deleted' });
}));

/**
 * @swagger
 * /api/trips/{tripId}/expenses/balances:
 *   get:
 *     summary: Fetch member balance calculation summary
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Balance summary returned
 */
router.get('/:tripId/expenses/balances', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const memberUserIds = [req.trip.ownerId, ...req.trip.members.map(m => m.userId)];
  const [expenses, users] = await Promise.all([
    prisma.expense.findMany({
      where: { tripId: req.trip.id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          orderBy: { id: 'asc' },
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    }),
    prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: { id: true, name: true, email: true }
    })
  ]);

  const allMembers = users.map(formatUser);
  const formattedExpenses = expenses.map(formatExpense);

  const { balanceMap, settlements, membersWithBalance, byCurrency } = calculateBalances(
    formattedExpenses,
    allMembers,
    req.trip.currency || 'INR'
  );

  res.json({
    currency: req.trip.currency || 'INR',
    balanceMap,
    settlements,
    membersWithBalance,
    byCurrency
  });
}));

// --- AI PLANNER ---

/**
 * @swagger
 * /api/trips/{tripId}/ai-suggestions:
 *   post:
 *     summary: Fetch AI itinerary suggestions
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               budget:
 *                 type: string
 *                 example: moderate
 *               interests:
 *                 type: string
 *                 example: culture, food
 *     responses:
 *       200:
 *         description: Itinerary suggestions returned
 */
router.post('/:tripId/ai-suggestions', verifyToken, aiLimiter, checkTripMembership,
  validate({ params: tripIdParamSchema, body: aiSuggestionsSchema }),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.tripId },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        places: true
      }
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const memberNames = trip.members.map(m => m.user?.name).filter(Boolean).join(', ');
    const existingPlaces = (trip.places || []).map(p => p.name).join(', ');
    const calculatedDays = calculateDurationDays(trip.startDate, trip.endDate) || 3;
    const tripDays = Math.min(Math.max(1, calculatedDays), 14);

    const safeName = String(trip.name || '').slice(0, 100).replace(/[\\`$]/g, '');
    const safeDestination = String(trip.destination || '').slice(0, 100).replace(/[\\`$]/g, '');
    const safeMembers = String(memberNames || '').slice(0, 200).replace(/[\\`$]/g, '');
    const safeExistingPlaces = String(existingPlaces || 'Nothing yet').slice(0, 500).replace(/[\\`$]/g, '');
    const safeBudget = String(req.body.budget || 'moderate').slice(0, 50).replace(/[\\`$]/g, '');
    const safeInterests = String(Array.isArray(req.body.interests) ? req.body.interests.join(', ') : (req.body.interests || 'culture, food, sightseeing')).slice(0, 200).replace(/[\\`$]/g, '');

    // Check Redis cache for identical input request
    const inputHash = crypto
      .createHash('sha256')
      .update(`${safeDestination}|${tripDays}|${safeBudget}|${safeInterests}|${safeExistingPlaces}`)
      .digest('hex')
      .slice(0, 16);
    const cacheKey = cache.keys.aiSuggestions(req.params.tripId, inputHash);

    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const prompt = `You are a travel expert. Plan a ${tripDays}-day trip to ${safeDestination}.

Trip details:
- Name: ${safeName}
- Members: ${safeMembers} (${trip.members.length} people)
- Theme/Notes: General sightseeing
- Already planned: ${safeExistingPlaces}
- Budget level: ${safeBudget}
- Interests: ${safeInterests}

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "summary": "One sentence overview of the itinerary",
  "days": [
    {
      "day": 1,
      "theme": "Short day theme",
      "places": [
        {
          "name": "Place name",
          "type": "attraction|restaurant|hotel|activity",
          "description": "One sentence why this fits the trip",
          "bestTime": "morning|afternoon|evening",
          "estimatedDuration": "1-2 hours",
          "lat": 48.8584,
          "lng": 2.2945,
          "address": "Area or address"
        }
      ]
    }
  ],
  "tips": ["Practical tip 1", "Practical tip 2", "Practical tip 3"]
}
Ensure each place includes realistic numerical latitude ("lat") and longitude ("lng") coordinates for the destination, as well as an address.`;

    if (!config.GROQ_API_KEY) {
      logger.error('AI service is not configured (missing GROQ_API_KEY)');
      return res.status(502).json({ message: 'AI service is not configured' });
    }

    let groqRes;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          'Authorization': `Bearer ${config.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        })
      });
    } catch (err) {
      logger.error({ err }, 'AI request failed');
      return res.status(502).json({ message: 'AI service is unavailable' });
    }

    if (!groqRes.ok) {
      const errorText = await groqRes.text().catch(() => '');
      logger.error({ status: groqRes.status, errorText }, 'AI service returned error');
      return res.status(502).json({ message: 'AI service is unavailable' });
    }

    const groqData = await groqRes.json().catch(() => ({}));
    const raw = groqData.choices?.[0]?.message?.content || '';

    let suggestions;
    try {
      suggestions = JSON.parse(raw);
    } catch {
      try {
        const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        suggestions = JSON.parse(stripped);
      } catch (e) {
        logger.error({ err: e, raw }, 'Failed to parse AI response as JSON');
        return res.status(502).json({ message: 'AI returned an invalid response' });
      }
    }

    const responsePayload = {
      suggestions,
      tripContext: {
        destination: trip.destination,
        days: tripDays,
        members: trip.members.length
      }
    };

    await cache.set(cacheKey, responsePayload, cache.TTLS.AI_SUGGESTIONS);
    res.setHeader('X-Cache', 'MISS');
    res.json(responsePayload);
  }));

/**
 * @swagger
 * /api/trips/{tripId}/activity:
 *   get:
 *     summary: Fetch trip activity log (last 50 logs)
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of trip activity logs returned
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.get('/:tripId/activity', verifyToken, asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: { members: true }
  });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const isOwner = trip.ownerId === req.userId;
  const isMember = trip.members.some(m => m.userId === req.userId);
  if (!isOwner && !isMember) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const activities = await prisma.activity.findMany({
    where: { tripId: req.params.tripId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json(activities.map(formatActivity));
}));

// --- Offline Travel Companion Endpoints ---

/**
 * @swagger
 * /api/trips/{tripId}/offline-pack:
 *   get:
 *     summary: Fetch full bundle for offline travel companion
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offline package data returned
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.get('/:tripId/offline-pack', verifyToken, validate({ params: tripIdParamSchema }), checkTripMembership, asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: {
      owner: { select: { id: true, name: true, email: true, picture: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } },
      places: { orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }] },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  const formattedTrip = formatTrip(trip);
  const formattedPlaces = (trip.places || []).map(formatPlace);
  const formattedExpenses = (trip.expenses || []).map(formatExpense);
  const balances = calculateBalances(formattedExpenses);

  // Derive accommodations and transport (grounded in user's saved records only)
  const staysAndTransport = [];
  const lodgingPlaces = formattedPlaces.filter(p => {
    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return cat === 'lodging' || cat === 'hotel' || name.includes('hotel') || name.includes('resort') || name.includes('inn') || name.includes('stay') || name.includes('hostel');
  });

  if (lodgingPlaces.length > 0) {
    lodgingPlaces.forEach(p => {
      staysAndTransport.push({
        id: `stay-${p.id}`,
        tripId: trip.id,
        type: 'hotel',
        name: p.name,
        address: p.address || '',
        bookingRef: null, // No fabricated booking reference numbers
        checkIn: null,
        checkOut: null,
        notes: p.note || '',
        isUserAdded: true
      });
    });
  }
  // Note: If no accommodations or transit are stored, returns empty array — no fabricated hotels or flights.

  // Emergency contacts (grounded in verified numbers and member profile records)
  const emergencyContacts = [
    {
      id: `emg-universal-${trip.id}`,
      tripId: trip.id,
      name: 'Universal Emergency Services',
      relationship: 'Police / Ambulance / Fire',
      phone: '112',
      email: '',
      source: 'Universal Emergency Dispatch (112)',
      notes: 'Universal emergency dispatch dialable from GSM mobile devices without SIM or pin.'
    }
  ];

  if (trip.owner) {
    emergencyContacts.push({
      id: `emg-owner-${trip.owner.id}`,
      tripId: trip.id,
      name: trip.owner.name || 'Trip Leader',
      relationship: 'Trip Leader',
      // Note: User model does not have a phone field. Add `phone String?` to schema
      // and include it in the select above to surface real phone numbers here.
      phone: null,
      email: trip.owner.email || '',
      source: 'Trip Organizer Profile',
      notes: 'Trip organizer'
    });
  }

  (trip.members || []).forEach(m => {
    if (m.user && m.user.id !== trip.ownerId) {
      emergencyContacts.push({
        id: `emg-member-${m.user.id}`,
        tripId: trip.id,
        name: m.user.name || 'Travel Companion',
        relationship: 'Trip Member',
        // Note: User model does not have a phone field.
        phone: null,
        email: m.user.email || '',
        source: 'Trip Member Profile',
        notes: 'Co-traveler'
      });
    }
  });

  // Suggested packing checklists (explicitly identified as starter templates)
  const checklists = [
    { id: `chk-1-${trip.id}`, tripId: trip.id, title: 'Passport, Visa & Government Photo ID', category: 'Essential Documents', completed: false, isTemplate: true },
    { id: `chk-2-${trip.id}`, tripId: trip.id, title: 'Universal Power Adapter & Electronics Charger', category: 'Gear', completed: false, isTemplate: true },
    { id: `chk-3-${trip.id}`, tripId: trip.id, title: 'Prescription Medication & Travel First-Aid', category: 'Health & Safety', completed: false, isTemplate: true },
    { id: `chk-4-${trip.id}`, tripId: trip.id, title: 'Local Currency Cash & Secondary Payment Card', category: 'Finance', completed: false, isTemplate: true },
    { id: `chk-5-${trip.id}`, tripId: trip.id, title: 'Weather-appropriate Clothes & Comfortable Shoes', category: 'Attire', completed: false, isTemplate: true }
  ];

  // Notes derived from real itinerary places
  const notes = [];
  formattedPlaces.forEach(p => {
    if (p.note && p.note.trim()) {
      notes.push({
        id: `note-place-${p.id}`,
        placeId: p.id,
        tripId: trip.id,
        title: `${p.name} Notes`,
        content: p.note,
        updatedAt: p.createdAt || trip.createdAt
      });
    }
  });

  // Real travel documents only — empty array when no verified documents have been stored
  const documents = [];

  res.json({
    trip: formattedTrip,
    itinerary: formattedPlaces,
    expenses: formattedExpenses,
    balances,
    staysAndTransport,
    emergencyContacts,
    checklists,
    notes,
    documents,
    downloadTimestamp: new Date().toISOString(),
    version: 1
  });
}));

/**
 * @swagger
 * /api/trips/{tripId}/offline-sync:
 *   post:
 *     summary: Synchronize pending changes made offline with transactional validation
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientSyncId:
 *                 type: string
 *               changes:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Offline changes processed with granular per-operation results
 *       400:
 *         description: Invalid payload or parameters
 *       403:
 *         description: Access denied
 */
router.post('/:tripId/offline-sync', verifyToken, validate({ params: tripIdParamSchema, body: offlineSyncSchema }), checkTripMembership, asyncHandler(async (req, res) => {
  const { changes } = req.body;
  const results = [];
  let syncedCount = 0;
  let failedCount = 0;

  if (Array.isArray(changes) && changes.length > 0) {
    for (const change of changes) {
      const changeId = change.id || change.itemId || `change-${Date.now()}`;
      const changeType = (change.type || '').trim().toLowerCase();

      try {
        if (changeType === 'place_note') {
          const targetPlaceId = change.placeId || change.itemId;
          if (!targetPlaceId) {
            results.push({
              id: changeId,
              type: changeType,
              success: false,
              code: 'MISSING_PLACE_ID',
              error: 'placeId is required for place_note synchronization'
            });
            failedCount++;
            continue;
          }

          const rawNote = change.note !== undefined ? change.note : (change.content !== undefined ? change.content : '');
          if (typeof rawNote !== 'string') {
            results.push({
              id: changeId,
              type: changeType,
              success: false,
              code: 'INVALID_NOTE_TYPE',
              error: 'note content must be a string'
            });
            failedCount++;
            continue;
          }

          // Verify ownership & place existence within this trip
          const place = await prisma.place.findFirst({
            where: { id: targetPlaceId, tripId: req.params.tripId }
          });

          if (!place) {
            results.push({
              id: changeId,
              type: changeType,
              success: false,
              code: 'RECORD_NOT_FOUND',
              error: 'Referenced place was not found in this trip'
            });
            failedCount++;
            continue;
          }

          const sanitizedNote = rawNote.trim().slice(0, 2000);
          await prisma.place.update({
            where: { id: targetPlaceId },
            data: { note: sanitizedNote }
          });

          syncedCount++;
          results.push({
            id: changeId,
            type: changeType,
            success: true,
            message: 'Place note synchronized and persisted successfully'
          });
        } else if (changeType === 'note' || changeType === 'travel_note') {
          // If note is associated with a place, persist to that place
          const targetPlaceId = change.placeId || change.itemId;
          let place = null;
          if (targetPlaceId) {
            place = await prisma.place.findFirst({
              where: { id: targetPlaceId, tripId: req.params.tripId }
            });
          }

          if (place) {
            const rawNote = change.note !== undefined ? change.note : (change.content !== undefined ? change.content : '');
            const sanitizedNote = String(rawNote).trim().slice(0, 2000);
            await prisma.place.update({
              where: { id: place.id },
              data: { note: sanitizedNote }
            });

            syncedCount++;
            results.push({
              id: changeId,
              type: changeType,
              success: true,
              message: 'Place-linked travel note synchronized and persisted successfully'
            });
          } else {
            // Unattached general travel note — not supported by cloud schema
            results.push({
              id: changeId,
              type: changeType,
              success: false,
              code: 'UNSUPPORTED_OPERATION',
              error: 'General travel notes are stored locally on this device only. Attach notes to places to sync with cloud.'
            });
            failedCount++;
          }
        } else if (changeType === 'checklist' || changeType === 'checklist_item') {
          // Packing checklists are device-local only (no cloud table)
          results.push({
            id: changeId,
            type: changeType,
            success: false,
            code: 'UNSUPPORTED_OPERATION',
            error: 'Checklist modifications are stored locally on this device only and cannot be synchronized to cloud.'
          });
          failedCount++;
        } else {
          results.push({
            id: changeId,
            type: changeType,
            success: false,
            code: 'UNSUPPORTED_OPERATION',
            error: `Unsupported sync operation '${changeType}'`
          });
          failedCount++;
        }
      } catch (opErr) {
        logger.error(`[OfflineSync] Error syncing operation ${changeId}:`, opErr);
        results.push({
          id: changeId,
          type: changeType,
          success: false,
          code: 'PERSISTENCE_ERROR',
          error: 'Database error occurred while persisting operation'
        });
        failedCount++;
      }
    }

    if (syncedCount > 0) {
      logActivity(req.params.tripId, req.userId, 'synchronized offline items', `${syncedCount} offline change(s) persisted`).catch(() => {});
    }
  }

  res.json({
    success: true,
    message: syncedCount > 0 ? `Synchronized ${syncedCount} change(s)` : 'No changes were persisted',
    syncedCount,
    failedCount,
    results,
    serverTimestamp: new Date().toISOString()
  });
}));

// --- Generic Routes (place these LAST so specific routes match first) ---

/**
 * @swagger
 * /api/trips/{id}:
 *   get:
 *     summary: Fetch a single trip details
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip details returned
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const cacheKey = cache.keys.trip(req.params.id, req.userId);
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true, picture: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } },
      places: { orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }] },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      },
      activities: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }
    }
  });

  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const isOwner = trip.ownerId === req.userId;
  const isMember = trip.members.some(m => m.userId === req.userId);
  if (!isOwner && !isMember) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const formatted = formatTrip(trip);
  await cache.set(cacheKey, formatted, cache.TTLS.TRIP_DETAIL);
  res.setHeader('X-Cache', 'MISS');
  res.json(formatted);
}));

/**
 * @swagger
 * /api/trips/{id}:
 *   put:
 *     summary: Update trip details
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               destination:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Trip updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.put('/:id', verifyToken,
  validate({ params: idParamSchema, body: updateTripSchema }),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, destination, startDate, endDate, budgetPerPerson, currency, status, coverImageUrl } = req.body;
    // Body already validated and coerced by Zod
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (destination !== undefined) updateData.destination = destination.trim();

    // Cross-check dates against existing trip values when only one is provided
    const resolvedStart = startDate ? new Date(startDate) : trip.startDate;
    const resolvedEnd   = endDate   ? new Date(endDate)   : trip.endDate;
    if (resolvedEnd < resolvedStart) {
      return res.status(400).json({ message: 'endDate must be on or after startDate.' });
    }
    if (startDate) updateData.startDate = resolvedStart;
    if (endDate)   updateData.endDate   = resolvedEnd;

    if (budgetPerPerson !== undefined) updateData.budgetPerPerson = budgetPerPerson;
    if (currency) updateData.currency = currency.trim().toUpperCase();
    if (status)   updateData.status   = status;
    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl === null ? '' : coverImageUrl.trim();
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true, picture: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, picture: true } } } },
        places: true,
        expenses: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            splits: {
              orderBy: { id: 'asc' },
              include: { user: { select: { id: true, name: true, email: true } } }
            }
          }
        }
      }
    });

    const formatted = formatTrip(updatedTrip);
    getIO().to(`trip:${updatedTrip.id}`).emit('trip:updated', formatted);

    const memberIds = [updatedTrip.ownerId, ...(updatedTrip.members || []).map(m => m.user?.id || m.userId)];
    cache.invalidateTrip(req.params.id, memberIds).catch(() => {});

    res.json(formatted);
  }));

/**
 * @swagger
 * /api/trips/{id}:
 *   delete:
 *     summary: Delete trip
 *     tags: [Trips]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Trip not found
 */
router.delete('/:id', verifyToken, validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: { members: { select: { userId: true } } }
  });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  if (trip.ownerId !== req.userId) {
    return res.status(403).json({ message: 'Access denied. Only the creator can delete.' });
  }

  const memberIds = [trip.ownerId, ...(trip.members || []).map(m => m.userId)];
  await prisma.trip.delete({ where: { id: req.params.id } });
  cache.invalidateTrip(req.params.id, memberIds).catch(() => {});

  getIO().to(`trip:${req.params.id}`).emit('trip:deleted', { tripId: req.params.id });
  await removeAllUsersFromTripRoom(req.params.id, { silent: true });
  res.json({ message: 'Trip deleted' });
}));

module.exports = router;
