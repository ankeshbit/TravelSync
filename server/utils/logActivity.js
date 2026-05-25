const Trip = require('../models/Trip');

module.exports = async function logActivity(tripId, userId, action, detail) {
  try {
    await Trip.findByIdAndUpdate(tripId, {
      $push: { activity: { user: userId, action, detail } }
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};
