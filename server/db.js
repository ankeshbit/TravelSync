const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['error', 'warn']
    });
  }
  prisma = global.__prisma;
}

function calculateDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffInMs = end.getTime() - start.getTime();
  if (Number.isNaN(diffInMs)) return 0;
  return Math.max(0, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)) + 1);
}

function formatUser(user) {
  if (!user) return null;
  const { password, refreshToken, ...safeUser } = user;
  return {
    ...safeUser,
    _id: user.id
  };
}

function formatPlace(place) {
  if (!place) return null;
  return {
    ...place,
    _id: place.id
  };
}

function formatExpense(expense) {
  if (!expense) return null;
  const formatted = {
    ...expense,
    _id: expense.id
  };

  if (expense.paidBy) {
    formatted.paidBy = formatUser(expense.paidBy);
  } else if (expense.paidById) {
    formatted.paidBy = expense.paidById;
  }

  if (Array.isArray(expense.splits)) {
    formatted.splitAmong = expense.splits.map(s => s.user ? formatUser(s.user) : (s.userId || s));
  } else if (Array.isArray(expense.splitAmong)) {
    formatted.splitAmong = expense.splitAmong.map(u => (typeof u === 'object' && u ? formatUser(u) : u));
  } else {
    formatted.splitAmong = [];
  }

  return formatted;
}

function formatActivity(act) {
  if (!act) return null;
  return {
    _id: act.id,
    id: act.id,
    user: act.user ? formatUser(act.user) : (act.userId ? { _id: act.userId, id: act.userId } : null),
    action: act.action,
    detail: act.detail,
    createdAt: act.createdAt
  };
}

function formatTrip(trip) {
  if (!trip) return null;
  const formatted = {
    ...trip,
    _id: trip.id,
    durationDays: calculateDurationDays(trip.startDate, trip.endDate)
  };

  if (trip.owner) {
    formatted.ownerId = formatUser(trip.owner);
  } else {
    formatted.ownerId = trip.ownerId;
  }

  if (Array.isArray(trip.members)) {
    formatted.members = trip.members.map(m => {
      if (m.user) return formatUser(m.user);
      if (m.name || m.email) return formatUser(m);
      return m.userId || m;
    });
  } else {
    formatted.members = [];
  }

  if (Array.isArray(trip.places)) {
    formatted.places = trip.places.map(formatPlace);
  }

  if (Array.isArray(trip.expenses)) {
    formatted.expenses = trip.expenses.map(formatExpense);
  }

  if (Array.isArray(trip.activities)) {
    formatted.activity = trip.activities.map(formatActivity);
  }

  return formatted;
}

async function ensureUserSynced(userId) {
  if (!userId) return null;
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) return user;

  try {
    const neonUsers = await prisma.$queryRawUnsafe(
      'SELECT id, name, email, image FROM neon_auth.user WHERE id = $1',
      userId
    );
    if (neonUsers && neonUsers.length > 0) {
      const u = neonUsers[0];
      user = await prisma.user.create({
        data: {
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          picture: u.image || '',
          password: ''
        }
      });
      return user;
    }
  } catch (e) {
    console.error('Error syncing user from neon_auth.user:', e.message);
  }
  return null;
}

module.exports = {
  prisma,
  formatUser,
  formatPlace,
  formatExpense,
  formatActivity,
  formatTrip,
  calculateDurationDays,
  ensureUserSynced
};

