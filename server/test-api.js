require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Trip = require('./models/Trip');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const trip = await Trip.findOne().populate('ownerId').populate('members');
    if (!trip) {
      console.log('No trips found');
      process.exit(0);
    }
    console.log('Found Trip:', trip._id);

    const title = 'API Test Expense';
    const amount = 50;
    const currency = 'INR';
    const paidBy = trip.ownerId ? trip.ownerId._id.toString() : null;
    const splitAmong = trip.members && trip.members.length > 0 
      ? trip.members.map(m => m._id.toString()) 
      : (paidBy ? [paidBy] : []);
    
    if (!paidBy) {
      console.log('No owner ID');
      process.exit(0);
    }

    console.log('Payload:', { title, amount, currency, paidBy, splitAmong });

    // Try doing exactly what the route does
    const allMemberIds = [trip.ownerId._id.toString(), ...trip.members.map(m => m._id.toString())];
    const invalidMembers = splitAmong.filter(userId => !allMemberIds.includes(userId.toString()));
    
    if (invalidMembers.length > 0) {
      console.log('Invalid members error');
      process.exit(0);
    }

    const newExpense = {
      title,
      amount: parseFloat(amount),
      currency: currency || 'INR',
      paidBy,
      splitAmong,
      createdAt: new Date()
    };

    trip.expenses.push(newExpense);
    await trip.save();
    console.log('Trip saved successfully!');

    // Populate
    const populatedTrip = await Trip.findById(trip._id).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    console.log('Populated Trip Expense Length:', populatedTrip.expenses.length);
    process.exit(0);

  } catch (err) {
    console.error('CAUGHT ERROR:', err.stack);
    process.exit(1);
  }
}
debug();
