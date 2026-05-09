require('dotenv').config();
const mongoose = require('mongoose');
require('./models/User'); // Required for populate
const Trip = require('./models/Trip');
const { calculateBalances } = require('./utils/calculateBalances');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const trip = await Trip.findOne().populate('ownerId').populate('members').populate('expenses.paidBy').populate('expenses.splitAmong');
    if (!trip) {
      console.log('No trips found');
      process.exit(0);
    }
    
    const allMembers = [trip.ownerId, ...trip.members];
    const result = calculateBalances(trip.expenses, allMembers);
    console.log('Balances calculated successfully');
    process.exit(0);

  } catch (err) {
    console.error('CAUGHT ERROR:', err.stack);
    process.exit(1);
  }
}
debug();
