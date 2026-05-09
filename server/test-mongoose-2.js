require('dotenv').config();
const mongoose = require('mongoose');
const Trip = require('./models/Trip');
const User = require('./models/User');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    // Find any trip to test with
    const trip = await Trip.findOne();
    if (!trip) {
      console.log('No trips found');
      process.exit(0);
    }

    const title = 'Test Expense';
    const amount = 100;
    const currency = 'INR';
    const paidBy = trip.ownerId;
    const splitAmong = [trip.ownerId];

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

    console.log('Trip saved');

    const populatedTrip = await Trip.findById(trip._id).populate({
      path: 'expenses.paidBy',
      select: 'name email'
    }).populate({
      path: 'expenses.splitAmong',
      select: 'name email'
    });

    console.log('Populated successfully');
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.stack);
    process.exit(1);
  }
}
test();
