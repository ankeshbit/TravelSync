const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/env');
const { prisma, formatTrip, formatPlace, formatExpense, formatUser, formatActivity } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getIO } = require('../socket');
const logActivity = require('../utils/logActivity');
const { calculateBalances } = require('../utils/calculateBalances');
const logger = require('../utils/logger');

// AI suggestion limiter: 5 requests per 10 minutes, keyed by authenticated user ID (falls back to IP)
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
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
    include: {
      members: true,
      places: true,
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        }
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
          paidById: true
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

  let totalSpent = 0;
  userTrips.forEach(t => {
    if (Array.isArray(t.expenses)) {
      t.expenses.forEach(e => {
        if (e.paidById === req.userId) {
          totalSpent += Number(e.amount) || 0;
        }
      });
    }
  });

  const currency = userTrips[0]?.currency || 'USD';

  res.json({
    totalTrips,
    upcomingTrips,
    totalMembers,
    totalSpent: Math.round(totalSpent * 100) / 100,
    currency
  });
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
router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { name, destination, startDate, endDate } = req.body;
  if (!name || !destination || !startDate || !endDate) {
    return res.status(400).json({ message: 'name, destination, startDate and endDate are all required.' });
  }
  if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
    return res.status(400).json({ message: 'startDate and endDate must be valid dates.' });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ message: 'endDate must be on or after startDate.' });
  }

  const savedTrip = await prisma.trip.create({
    data: {
      name: name.trim(),
      destination: destination.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
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
router.post('/:tripId/members', verifyToken, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

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

  getIO().to(`trip:${req.params.tripId}`).emit('member:joined', formatUser(user));

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
router.delete('/:tripId/members/:userId', verifyToken, asyncHandler(async (req, res) => {
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

  const removedUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
  const removedEmail = removedUser ? removedUser.email : 'Unknown';

  await prisma.tripMember.deleteMany({
    where: {
      tripId: trip.id,
      userId: req.params.userId
    }
  });

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
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        }
      }
    }
  });

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
router.post('/:tripId/places', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const { name, address, lat, lng, dayNumber, orderIndex, category, duration, note } = req.body;

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
      address,
      lat: Number(lat),
      lng: Number(lng),
      dayNumber: Number(dayNumber),
      orderIndex: Number(computedOrder),
      category: category || 'attraction',
      duration: duration !== undefined ? Number(duration) : 60,
      note: note || ''
    }
  });

  await logActivity(req.params.tripId, req.userId, 'added a place', `${createdPlace.name} on Day ${createdPlace.dayNumber}`);

  const formatted = formatPlace(createdPlace);
  getIO().to(`trip:${req.params.tripId}`).emit('place:added', formatted);

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
router.delete('/:tripId/places/:placeId', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
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
router.patch('/:tripId/places/:placeId/note', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (note !== undefined && typeof note === 'string' && note.length > 2000) {
    return res.status(400).json({ message: 'note must be 2000 characters or fewer.' });
  }

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
  const updates = req.body; // Array of { placeId, dayNumber, orderIndex }

  if (Array.isArray(updates) && updates.length > 0) {
    await prisma.$transaction(
      updates.map(update => {
        const id = update.placeId || update._id || update.id;
        const data = {};
        if (update.dayNumber !== undefined) data.dayNumber = Number(update.dayNumber);
        if (update.orderIndex !== undefined) data.orderIndex = Number(update.orderIndex);
        return prisma.place.update({
          where: { id },
          data
        });
      })
    );
  }

  const allPlaces = await prisma.place.findMany({
    where: { tripId: req.params.tripId },
    orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }]
  });

  const formattedPlaces = allPlaces.map(formatPlace);
  getIO().to(`trip:${req.params.tripId}`).emit('place:reordered', formattedPlaces);

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
router.post('/:tripId/expenses', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
  const { title, amount, currency, category, receiptUrl, paidBy, splitAmong } = req.body;

  if (!title || !amount || !paidBy || !splitAmong || splitAmong.length === 0) {
    return res.status(400).json({ message: 'Missing required fields: title, amount, paidBy, splitAmong' });
  }

  const trip = req.trip;
  const allMemberIds = [trip.ownerId, ...trip.members.map(m => m.userId)];
  const normalizedSplits = splitAmong.map(u => (typeof u === 'object' && u ? (u._id || u.id) : u));

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
      splits: { include: { user: { select: { id: true, name: true, email: true } } } }
    }
  });

  await logActivity(req.params.tripId, req.userId, 'added an expense', `${createdExpense.title} — ${createdExpense.currency} ${createdExpense.amount}`);

  const formatted = formatExpense(createdExpense);
  getIO().to(`trip:${req.params.tripId}`).emit('expense:added', formatted);

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
router.delete('/:tripId/expenses/:expenseId', verifyToken, checkTripMembership, asyncHandler(async (req, res) => {
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
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        }
      }
    }
  });

  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const memberMap = new Map();
  if (trip.owner) {
    memberMap.set(trip.owner.id, formatUser(trip.owner));
  }
  trip.members.forEach(m => {
    if (m.user) memberMap.set(m.user.id, formatUser(m.user));
  });

  const allMembers = Array.from(memberMap.values());
  const formattedExpenses = trip.expenses.map(formatExpense);

  const { balanceMap, settlements, membersWithBalance } = calculateBalances(formattedExpenses, allMembers);

  res.json({
    currency: trip.currency || 'INR',
    balanceMap,
    settlements,
    membersWithBalance
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
router.post('/:tripId/ai-suggestions', verifyToken, aiLimiter, checkTripMembership, asyncHandler(async (req, res) => {
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
  const tripDays = trip.startDate && trip.endDate
    ? Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24))
    : 3;

  const prompt = `You are a travel expert. Plan a ${tripDays}-day trip to ${trip.destination}.

Trip details:
- Name: ${trip.name}
- Members: ${memberNames} (${trip.members.length} people)
- Theme/Notes: General sightseeing
- Already planned: ${existingPlaces || 'Nothing yet'}
- Budget level: ${req.body.budget || 'moderate'}
- Interests: ${req.body.interests || 'culture, food, sightseeing'}

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
          "estimatedDuration": "1-2 hours"
        }
      ]
    }
  ],
  "tips": ["Practical tip 1", "Practical tip 2", "Practical tip 3"]
}`;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  const groqData = await groqRes.json();
  const raw = groqData.choices?.[0]?.message?.content || '{}';

  let suggestions;
  try {
    suggestions = JSON.parse(raw);
  } catch {
    try {
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      suggestions = JSON.parse(stripped);
    } catch (e) {
      suggestions = { error: 'Could not parse AI response', raw };
    }
  }

  res.json({
    suggestions,
    tripContext: {
      destination: trip.destination,
      days: tripDays,
      members: trip.members.length
    }
  });
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

  res.json(formatTrip(trip));
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
router.put('/:id', verifyToken, asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  if (trip.ownerId !== req.userId) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { name, destination, startDate, endDate, budgetPerPerson, currency, status } = req.body;
  const updateData = {};

  if (name !== undefined) {
    if (!name || !name.trim()) return res.status(400).json({ message: 'name cannot be empty.' });
    if (name.trim().length > 200) return res.status(400).json({ message: 'name must be 200 characters or fewer.' });
    updateData.name = name.trim();
  }
  if (destination !== undefined) {
    if (!destination || !destination.trim()) return res.status(400).json({ message: 'destination cannot be empty.' });
    updateData.destination = destination.trim();
  }

  // Validate dates if provided
  const resolvedStart = startDate ? new Date(startDate) : trip.startDate;
  const resolvedEnd = endDate ? new Date(endDate) : trip.endDate;
  if (startDate && isNaN(resolvedStart.getTime())) {
    return res.status(400).json({ message: 'startDate must be a valid date.' });
  }
  if (endDate && isNaN(resolvedEnd.getTime())) {
    return res.status(400).json({ message: 'endDate must be a valid date.' });
  }
  if (resolvedEnd < resolvedStart) {
    return res.status(400).json({ message: 'endDate must be on or after startDate.' });
  }
  if (startDate) updateData.startDate = resolvedStart;
  if (endDate) updateData.endDate = resolvedEnd;

  if (budgetPerPerson !== undefined) {
    const budget = Number(budgetPerPerson);
    if (isNaN(budget) || budget < 0) return res.status(400).json({ message: 'budgetPerPerson must be a non-negative number.' });
    updateData.budgetPerPerson = budget;
  }
  if (currency) updateData.currency = currency.trim().toUpperCase().slice(0, 3);
  if (status) {
    const validStatuses = ['planning', 'upcoming', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}.` });
    }
    updateData.status = status;
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
          splits: { include: { user: { select: { id: true, name: true, email: true } } } }
        }
      }
    }
  });

  res.json(formatTrip(updatedTrip));
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
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  if (trip.ownerId !== req.userId) {
    return res.status(403).json({ message: 'Access denied. Only the creator can delete.' });
  }

  await prisma.trip.delete({ where: { id: req.params.id } });
  res.json({ message: 'Trip deleted' });
}));

module.exports = router;
