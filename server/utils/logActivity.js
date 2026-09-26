const { prisma } = require('../db');

module.exports = async function logActivity(tripId, userId, action, detail) {
  try {
    await prisma.activity.create({
      data: {
        tripId,
        userId: userId || null,
        action: action || '',
        detail: detail || ''
      }
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};
