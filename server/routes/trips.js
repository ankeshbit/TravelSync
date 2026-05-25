const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { getIO } = require('../socket');
const logActivity = require('../utils/logActivity');

// Middleware to check if user is a member of the trip (place before specific routes)
const checkTripMembership = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId && !trip.members.some(m => m.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    req.trip = trip; // Attach trip to request
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { $or: [{ ownerId: req.userId }, { members: req.userId }] };

    const [trips, total] = await Promise.all([
      Trip.find(query)
        .populate('ownerId', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Trip.countDocuments(query)
    ]);

    res.json({
      trips,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.post('/', verifyToken, async (req, res) => {
  try {
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
    const newTrip = new Trip({
      name,
      destination,
      startDate,
      endDate,
      ownerId: req.userId,
      members: [req.userId]
    });

    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.get('/:tripId/members', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId && !trip.members.some(m => m.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const populatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    res.json(populatedTrip.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.post('/:tripId/members', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the trip owner can invite members' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    if (trip.members.some(m => m.toString() === user._id.toString())) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    if (trip.ownerId.toString() === user._id.toString()) {
      return res.status(400).json({ message: 'Owner is already part of the trip' });
    }

    trip.members.push(user._id);
    await trip.save();

    await logActivity(req.params.tripId, req.userId, 'invited a member', user.email);

    const updatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    
    getIO().to(`trip:${req.params.tripId}`).emit('member:joined', user);

    res.status(200).json(updatedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.delete('/:tripId/members/:userId', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the trip owner can remove members' });
    }

    if (trip.ownerId.toString() === req.params.userId) {
      return res.status(400).json({ message: 'Cannot remove the trip owner' });
    }

    const removedUser = await User.findById(req.params.userId);
    const removedEmail = removedUser ? removedUser.email : 'Unknown';

    trip.members = trip.members.filter(memberId => memberId.toString() !== req.params.userId);
    await trip.save();

    await logActivity(req.params.tripId, req.userId, 'removed a member', removedEmail);

    const updatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    res.status(200).json(updatedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.get('/:tripId/places', verifyToken, checkTripMembership, async (req, res) => {
  try {
    res.json(req.trip.places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.post('/:tripId/places', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const { name, address, lat, lng, dayNumber, orderIndex } = req.body;

    const newPlace = { name, address, lat, lng, dayNumber, orderIndex };
    req.trip.places.push(newPlace);

    await req.trip.save();

    const createdPlace = req.trip.places[req.trip.places.length - 1];

    await logActivity(req.params.tripId, req.userId, 'added a place', `${newPlace.name} on Day ${newPlace.dayNumber}`);
    
    getIO().to(`trip:${req.params.tripId}`).emit('place:added', createdPlace);

    res.status(201).json(createdPlace);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.delete('/:tripId/places/:placeId', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const placeIndex = req.trip.places.findIndex(p => p._id.toString() === req.params.placeId);
    if (placeIndex === -1) return res.status(404).json({ message: 'Place not found' });

    const place = req.trip.places[placeIndex];
    req.trip.places.splice(placeIndex, 1);
    await req.trip.save();

    await logActivity(req.params.tripId, req.userId, 'removed a place', place.name);

    getIO().to(`trip:${req.params.tripId}`).emit('place:deleted', { placeId: req.params.placeId });

    res.json({ message: 'Place deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.patch('/:tripId/places/:placeId/note', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const place = req.trip.places.id(req.params.placeId);
    if (!place) return res.status(404).json({ message: 'Place not found' });

    place.note = req.body.note;
    await req.trip.save();

    getIO().to(`trip:${req.params.tripId}`).emit('place:note_updated', place);

    res.json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.patch('/:tripId/places/reorder', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const updates = req.body; // Array of { placeId, dayNumber, orderIndex }

    updates.forEach(update => {
      const place = req.trip.places.id(update.placeId);
      if (place) {
        if (update.dayNumber !== undefined) place.dayNumber = update.dayNumber;
        if (update.orderIndex !== undefined) place.orderIndex = update.orderIndex;
      }
    });

    req.trip.places.sort((a, b) => {
      if (a.dayNumber === b.dayNumber) {
        return a.orderIndex - b.orderIndex;
      }
      return a.dayNumber - b.dayNumber;
    });

    await req.trip.save();

    getIO().to(`trip:${req.params.tripId}`).emit('place:reordered', req.trip.places);

    res.json(req.trip.places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- EXPENSES API ---

const { calculateBalances } = require('../utils/calculateBalances');

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
router.get('/:tripId/expenses', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const trip = await Trip.findById(req.params.tripId).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const allExpenses = trip.expenses.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = allExpenses.length;
    const paginatedExpenses = allExpenses.slice(skip, skip + limit);

    res.json({
      expenses: paginatedExpenses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.post('/:tripId/expenses', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const { title, amount, currency, paidBy, splitAmong } = req.body;

    if (!title || !amount || !paidBy || !splitAmong || splitAmong.length === 0) {
      return res.status(400).json({ message: 'Missing required fields: title, amount, paidBy, splitAmong' });
    }

    const allMemberIds = [req.trip.ownerId.toString(), ...req.trip.members.map(m => m.toString())];
    const invalidMembers = splitAmong.filter(userId => !allMemberIds.includes(userId.toString()));
    if (invalidMembers.length > 0) {
      return res.status(400).json({ message: 'One or more split members are not trip members' });
    }

    const newExpense = {
      title,
      amount: parseFloat(amount),
      currency: currency || 'INR',
      paidBy,
      splitAmong,
      createdAt: new Date()
    };

    req.trip.expenses.push(newExpense);
    await req.trip.save();

    await logActivity(req.params.tripId, req.userId, 'added an expense', `${newExpense.title} — ₹${newExpense.amount}`);

    const populatedTrip = await Trip.findById(req.params.tripId).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    const addedExpense = populatedTrip.expenses[populatedTrip.expenses.length - 1];
    
    getIO().to(`trip:${req.params.tripId}`).emit('expense:added', addedExpense);
    
    res.status(201).json(addedExpense);
  } catch (err) {
    console.error('Add expense error:', err);
    res.status(500).json({ message: err.message });
  }
});

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
router.delete('/:tripId/expenses/:expenseId', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const expenseIndex = req.trip.expenses.findIndex(e => e._id.toString() === req.params.expenseId);
    if (expenseIndex === -1) return res.status(404).json({ message: 'Expense not found' });

    const expense = req.trip.expenses[expenseIndex];

    if (expense.paidBy.toString() !== req.userId && req.trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the expense creator or trip owner can delete' });
    }

    req.trip.expenses.splice(expenseIndex, 1);
    await req.trip.save();

    await logActivity(req.params.tripId, req.userId, 'deleted an expense', expense.title);

    getIO().to(`trip:${req.params.tripId}`).emit('expense:deleted', { expenseId: req.params.expenseId });

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.get('/:tripId/expenses/balances', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate({
      path: 'members',
      select: 'name email'
    }).populate({
      path: 'ownerId',
      select: 'name email'
    }).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const allMembers = [trip.ownerId, ...trip.members];
    const { balanceMap, settlements, membersWithBalance } = calculateBalances(trip.expenses, allMembers);

    res.json({
      balanceMap,
      settlements,
      membersWithBalance
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.post('/:tripId/ai-suggestions', verifyToken, checkTripMembership, async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate('members', 'name');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const memberNames = trip.members.map(m => m.name).join(', ');
    const existingPlaces = (trip.places || []).map(p => p.name).join(', ');
    const tripDays = trip.startDate && trip.endDate
      ? Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24))
      : 3;

    const prompt = `You are a travel expert. Plan a ${tripDays}-day trip to ${trip.destination}.

Trip details:
- Name: ${trip.name}
- Members: ${memberNames} (${trip.members.length} people)
- Theme/Notes: ${trip.description || 'General sightseeing'}
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
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
  } catch (err) {
    next(err);
  }
});

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
router.get('/:tripId/activity', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId && !trip.members.some(m => m.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const populatedTrip = await Trip.findById(req.params.tripId).populate({
      path: 'activity.user',
      select: 'name'
    });

    const activities = (populatedTrip.activity || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('ownerId', 'name email')
      .populate('members', 'name email');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId._id.toString() !== req.userId && !trip.members.some(m => m.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, destination, startDate, endDate } = req.body;
    trip.name = name || trip.name;
    trip.destination = destination || trip.destination;
    trip.startDate = startDate || trip.startDate;
    trip.endDate = endDate || trip.endDate;

    const updatedTrip = await trip.save();
    res.json(updatedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Access denied. Only the creator can delete.' });
    }

    await trip.deleteOne();
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
