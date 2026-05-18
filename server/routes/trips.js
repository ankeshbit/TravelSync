const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const Groq = require('groq-sdk');
const { getIO } = require('../socket');

// GET /api/trips - Fetch all trips for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const trips = await Trip.find({
      $or: [{ ownerId: req.userId }, { members: req.userId }]
    }).populate('ownerId', 'name email');
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trips - Create new trip
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, destination, startDate, endDate } = req.body;
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

// Middleware to check if user is a member of the trip (place before specific routes)
const checkTripMembership = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.ownerId.toString() !== req.userId && !trip.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    req.trip = trip; // Attach trip to request
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- MEMBERS API ---

// GET /api/trips/:tripId/members - Fetch all members of a trip
router.get('/:tripId/members', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Check access — only trip members can view members
    if (trip.ownerId.toString() !== req.userId && !trip.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Populate members array with name and email
    const populatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    res.json(populatedTrip.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trips/:tripId/members - Add member by email
router.post('/:tripId/members', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Only owner can invite members
    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the trip owner can invite members' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    // Check if user is already a member
    if (trip.members.includes(user._id)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Check if user is the owner
    if (trip.ownerId.toString() === user._id.toString()) {
      return res.status(400).json({ message: 'Owner is already part of the trip' });
    }

    // Add user to members array
    trip.members.push(user._id);
    await trip.save();

    // Return updated trip with populated members
    const updatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    
    getIO().to(`trip:${req.params.tripId}`).emit('member:joined', user);

    res.status(200).json(updatedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/trips/:tripId/members/:userId - Remove member from trip
router.delete('/:tripId/members/:userId', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Only owner can remove members
    if (trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the trip owner can remove members' });
    }

    // Cannot remove the owner
    if (trip.ownerId.toString() === req.params.userId) {
      return res.status(400).json({ message: 'Cannot remove the trip owner' });
    }

    // Remove user from members array
    trip.members = trip.members.filter(memberId => memberId.toString() !== req.params.userId);
    await trip.save();

    // Return updated trip with populated members
    const updatedTrip = await Trip.findById(req.params.tripId).populate('members', 'name email').populate('ownerId', 'name email');
    res.status(200).json(updatedTrip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PLACES API ---

// GET /api/trips/:tripId/places (Handled by the GET trip endpoint already but can create a specific one if needed, though fetchPlaces implies getting from trip)
router.get('/:tripId/places', verifyToken, checkTripMembership, async (req, res) => {
  try {
    res.json(req.trip.places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trips/:tripId/places
router.post('/:tripId/places', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const { name, address, lat, lng, dayNumber, orderIndex } = req.body;

    const newPlace = { name, address, lat, lng, dayNumber, orderIndex };
    req.trip.places.push(newPlace);

    await req.trip.save();

    const createdPlace = req.trip.places[req.trip.places.length - 1];
    
    // Broadcast itinerary update
    getIO().to(`trip:${req.params.tripId}`).emit('place:added', createdPlace);

    // Return the newly created place (the last one in the array)
    res.status(201).json(createdPlace);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/trips/:tripId/places/:placeId
router.delete('/:tripId/places/:placeId', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const placeIndex = req.trip.places.findIndex(p => p._id.toString() === req.params.placeId);
    if (placeIndex === -1) return res.status(404).json({ message: 'Place not found' });

    req.trip.places.splice(placeIndex, 1);
    await req.trip.save();

    // Broadcast itinerary update
    getIO().to(`trip:${req.params.tripId}`).emit('place:deleted', { placeId: req.params.placeId });

    res.json({ message: 'Place deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/trips/:tripId/places/:placeId/note
router.patch('/:tripId/places/:placeId/note', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const place = req.trip.places.id(req.params.placeId);
    if (!place) return res.status(404).json({ message: 'Place not found' });

    place.note = req.body.note;
    await req.trip.save();

    // Broadcast itinerary update
    getIO().to(`trip:${req.params.tripId}`).emit('place:reordered', req.trip.places);

    res.json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/trips/:tripId/places/reorder
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

    // Sort the places array based on dayNumber and orderIndex just to keep the DB tidy
    req.trip.places.sort((a, b) => {
      if (a.dayNumber === b.dayNumber) {
        return a.orderIndex - b.orderIndex;
      }
      return a.dayNumber - b.dayNumber;
    });

    await req.trip.save();

    // Broadcast itinerary update
    getIO().to(`trip:${req.params.tripId}`).emit('place:reordered', req.trip.places);

    res.json(req.trip.places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- EXPENSES API ---

const { calculateBalances } = require('../utils/calculateBalances');

// GET /api/trips/:tripId/expenses - Fetch all expenses for the trip
router.get('/:tripId/expenses', verifyToken, checkTripMembership, async (req, res) => {
  try {

    const trip = await Trip.findById(req.params.tripId).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip.expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trips/:tripId/expenses - Add new expense
router.post('/:tripId/expenses', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const { title, amount, currency, paidBy, splitAmong } = req.body;

    // Validate required fields
    if (!title || !amount || !paidBy || !splitAmong || splitAmong.length === 0) {
      return res.status(400).json({ message: 'Missing required fields: title, amount, paidBy, splitAmong' });
    }

    // Validate that all splitAmong users are trip members
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

    // Populate the newly added expense
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
    require('fs').writeFileSync('expense_error.log', err.stack || err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/trips/:tripId/expenses/:expenseId - Delete expense
router.delete('/:tripId/expenses/:expenseId', verifyToken, checkTripMembership, async (req, res) => {
  try {

    const expenseIndex = req.trip.expenses.findIndex(e => e._id.toString() === req.params.expenseId);
    if (expenseIndex === -1) return res.status(404).json({ message: 'Expense not found' });

    const expense = req.trip.expenses[expenseIndex];

    // Check if user is the payer or trip owner
    if (expense.paidBy.toString() !== req.userId && req.trip.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the expense creator or trip owner can delete' });
    }

    req.trip.expenses.splice(expenseIndex, 1);
    await req.trip.save();

    getIO().to(`trip:${req.params.tripId}`).emit('expense:deleted', { expenseId: req.params.expenseId });

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trips/:tripId/expenses/balances - Get balance calculations
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

    // Get all members including owner
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

// POST /api/trips/:tripId/ai-plan
router.post('/:tripId/ai-plan', verifyToken, checkTripMembership, async (req, res) => {
  try {
    const { destination, days, budget, style } = req.body;

    if (!destination || !days || !budget || !style) {
      return res.status(400).json({ message: 'Missing required fields: destination, days, budget, style' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are an expert travel planner. Return ONLY a valid JSON array of place objects for a ${days}-day trip to ${destination}.

Budget: Rs.${budget} INR total. Travel style: ${style}.

Each object must have exactly these fields:
- name: string (place or attraction name)
- address: string (full address or area name)
- lat: number (realistic latitude for the destination)
- lng: number (realistic longitude for the destination)
- dayNumber: number (day of the trip, 1 to ${days})
- orderIndex: number (order within that day, starting from 0)
- note: string (one helpful tip about the place)

Rules:
- Aim for 3-4 places per day spread across all ${days} days
- orderIndex resets to 0 for each new dayNumber
- lat/lng must be accurate geographic coordinates
- Return ONLY the raw JSON array, no markdown, no explanation, no code fences`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a travel planning assistant. You always respond with only valid JSON arrays, no other text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    });

    const rawText = completion.choices[0]?.message?.content?.trim();
    if (!rawText) {
      return res.status(500).json({ message: 'AI returned an empty response. Please try again.' });
    }

    let places;
    try {
      places = JSON.parse(rawText);
    } catch (parseErr) {
      // Strip markdown fences if present
      const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      places = JSON.parse(stripped);
    }

    if (!Array.isArray(places)) {
      return res.status(500).json({ message: 'AI returned an unexpected format. Please try again.' });
    }

    res.json(places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Generic Routes (place these LAST so specific routes match first) ---

// GET /api/trips/:id - Fetch single trip
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('ownerId', 'name email')
      .populate('members', 'name email');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Check access
    if (trip.ownerId._id.toString() !== req.userId && !trip.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(trip);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trips/:id - Update trip
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Only owner can update details currently
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

// DELETE /api/trips/:id - Delete trip
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
