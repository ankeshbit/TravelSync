/**
 * In-memory Prisma mock for testing without a live database.
 * Mocks the methods on the shared `prisma` instance from `../db`.
 */
const crypto = require('crypto');
const { prisma } = require('../db');

function setupPrismaMock() {
  const users = new Map();
  const trips = new Map();
  const tripMembers = new Map();
  const places = new Map();
  const expenses = new Map();
  const otps = new Map();
  const activities = new Map();

  function reset() {
    users.clear();
    trips.clear();
    tripMembers.clear();
    places.clear();
    expenses.clear();
    otps.clear();
    activities.clear();
  }

  // ── prisma.user ────────────────────────────────────────────────────────────
  prisma.user.upsert = jest.fn(async ({ where, update, create }) => {
    let user = null;
    if (where.email) {
      user = Array.from(users.values()).find(u => u.email.toLowerCase() === where.email.toLowerCase());
    } else if (where.id) {
      user = users.get(where.id);
    } else if (where.firebaseUid) {
      user = Array.from(users.values()).find(u => u.firebaseUid === where.firebaseUid);
    }

    if (user) {
      Object.assign(user, update);
      return { ...user };
    }

    const newUser = {
      id: create.id || `user-${crypto.randomUUID()}`,
      name: create.name || '',
      email: (create.email || '').toLowerCase(),
      password: create.password || '',
      firebaseUid: create.firebaseUid || null,
      picture: create.picture || '',
      refreshToken: create.refreshToken || null,
      createdAt: new Date(),
      ...create
    };
    users.set(newUser.id, newUser);
    return { ...newUser };
  });

  prisma.user.findUnique = jest.fn(async ({ where, select }) => {
    let user = null;
    if (where.id) {
      user = users.get(where.id);
    } else if (where.email) {
      user = Array.from(users.values()).find(u => u.email.toLowerCase() === where.email.toLowerCase());
    } else if (where.firebaseUid) {
      user = Array.from(users.values()).find(u => u.firebaseUid === where.firebaseUid);
    }

    if (!user) return null;

    if (select) {
      const selected = {};
      for (const key of Object.keys(select)) {
        if (select[key]) selected[key] = user[key];
      }
      return selected;
    }
    return { ...user };
  });

  prisma.user.findFirst = jest.fn(async ({ where, select }) => {
    return prisma.user.findUnique({ where, select });
  });

  prisma.user.count = jest.fn(async () => users.size || 5);

  prisma.user.create = jest.fn(async ({ data }) => {
    const newUser = {
      id: data.id || `user-${crypto.randomUUID()}`,
      name: data.name || '',
      email: (data.email || '').toLowerCase(),
      password: data.password || '',
      firebaseUid: data.firebaseUid || null,
      picture: data.picture || '',
      refreshToken: data.refreshToken || null,
      createdAt: new Date(),
      ...data
    };
    users.set(newUser.id, newUser);
    return { ...newUser };
  });

  // ── prisma.trip ────────────────────────────────────────────────────────────
  function populateTrip(trip) {
    if (!trip) return null;
    const owner = users.get(trip.ownerId) || {
      id: trip.ownerId,
      name: 'Owner',
      email: 'owner@example.com',
      picture: ''
    };

    const members = Array.from(tripMembers.values())
      .filter(m => m.tripId === trip.id)
      .map(m => {
        const u = users.get(m.userId) || { id: m.userId, name: 'Member', email: 'member@example.com', picture: '' };
        return {
          ...m,
          user: { id: u.id, name: u.name, email: u.email, picture: u.picture }
        };
      });

    const tripPlaces = Array.from(places.values()).filter(p => p.tripId === trip.id);
    const tripExpenses = Array.from(expenses.values()).filter(e => e.tripId === trip.id);

    return {
      ...trip,
      owner: { id: owner.id, name: owner.name, email: owner.email, picture: owner.picture },
      members,
      places: tripPlaces,
      expenses: tripExpenses
    };
  }

  prisma.trip.create = jest.fn(async ({ data, include }) => {
    const tripId = data.id || `trip-${crypto.randomUUID()}`;
    const newTrip = {
      id: tripId,
      name: data.name,
      destination: data.destination,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status || 'planning',
      coverImageUrl: data.coverImageUrl || '',
      budgetPerPerson: data.budgetPerPerson || 0,
      currency: data.currency || 'INR',
      ownerId: data.ownerId,
      createdAt: new Date()
    };
    trips.set(tripId, newTrip);

    if (data.members?.create) {
      for (const m of data.members.create) {
        const memberRecord = {
          id: `tm-${crypto.randomUUID()}`,
          tripId,
          userId: m.userId,
          joinedAt: new Date()
        };
        tripMembers.set(memberRecord.id, memberRecord);
      }
    }

    if (include) {
      return populateTrip(newTrip);
    }
    return { ...newTrip };
  });

  prisma.trip.findUnique = jest.fn(async ({ where, include, select }) => {
    const trip = trips.get(where.id);
    if (!trip) return null;
    if (include) return populateTrip(trip);
    if (select) {
      const populated = populateTrip(trip);
      const res = {};
      for (const k of Object.keys(select)) {
        res[k] = populated[k];
      }
      return res;
    }
    return { ...trip };
  });

  prisma.trip.findFirst = jest.fn(async ({ where, include, select }) => {
    let trip = null;
    if (where.id) {
      trip = trips.get(where.id);
    } else {
      trip = Array.from(trips.values())[0] || null;
    }
    if (!trip) return null;
    if (include) return populateTrip(trip);
    if (select) {
      const populated = populateTrip(trip);
      const res = {};
      for (const k of Object.keys(select)) {
        res[k] = populated[k];
      }
      return res;
    }
    return { ...trip };
  });

  prisma.trip.findMany = jest.fn(async ({ where, include, select }) => {
    let results = Array.from(trips.values());
    if (where?.OR) {
      results = results.filter(t => {
        return where.OR.some(cond => {
          if (cond.ownerId && t.ownerId === cond.ownerId) return true;
          if (cond.members?.some?.userId) {
            const hasMember = Array.from(tripMembers.values()).some(
              m => m.tripId === t.id && m.userId === cond.members.some.userId
            );
            if (hasMember) return true;
          }
          return false;
        });
      });
    }
    if (include) {
      return results.map(populateTrip);
    }
    if (select) {
      return results.map(t => {
        const item = {};
        for (const k of Object.keys(select)) {
          if (select[k]) item[k] = t[k];
        }
        return item;
      });
    }
    return results;
  });

  prisma.trip.deleteMany = jest.fn(async ({ where }) => {
    let count = 0;
    for (const [id, t] of trips.entries()) {
      if (where?.name?.in && where.name.in.includes(t.name)) {
        trips.delete(id);
        count++;
      }
    }
    return { count };
  });

  prisma.user.delete = jest.fn(async ({ where }) => {
    const user = users.get(where.id);
    if (user) users.delete(where.id);
    return user || null;
  });

  prisma.trip.delete = jest.fn(async ({ where }) => {
    const trip = trips.get(where.id);
    if (trip) trips.delete(where.id);
    return trip || null;
  });

  prisma.trip.count = jest.fn(async () => trips.size || 12);

  // ── prisma.tripMember ──────────────────────────────────────────────────────
  prisma.tripMember.create = jest.fn(async ({ data }) => {
    const member = {
      id: `tm-${crypto.randomUUID()}`,
      tripId: data.tripId,
      userId: data.userId,
      joinedAt: new Date()
    };
    tripMembers.set(member.id, member);
    return { ...member };
  });

  prisma.tripMember.findFirst = jest.fn(async ({ where }) => {
    return Array.from(tripMembers.values()).find(
      m => (!where.tripId || m.tripId === where.tripId) && (!where.userId || m.userId === where.userId)
    ) || null;
  });

  prisma.tripMember.findMany = jest.fn(async ({ where }) => {
    return Array.from(tripMembers.values()).filter(
      m => (!where?.tripId || m.tripId === where.tripId) && (!where?.userId || m.userId === where.userId)
    );
  });

  prisma.tripMember.deleteMany = jest.fn(async ({ where }) => {
    let count = 0;
    for (const [id, m] of tripMembers.entries()) {
      if (where?.tripId && m.tripId === where.tripId) {
        tripMembers.delete(id);
        count++;
      }
    }
    return { count };
  });

  // ── prisma.place ───────────────────────────────────────────────────────────
  prisma.place.deleteMany = jest.fn(async () => ({ count: 0 }));

  // ── prisma.expense & expenseSplit ──────────────────────────────────────────
  prisma.expense.findMany = jest.fn(async () => Array.from(expenses.values()));
  prisma.expense.deleteMany = jest.fn(async () => ({ count: 0 }));
  prisma.expenseSplit.deleteMany = jest.fn(async () => ({ count: 0 }));

  // ── prisma.activity ────────────────────────────────────────────────────────
  prisma.activity.create = jest.fn(async ({ data }) => {
    const act = {
      id: `act-${crypto.randomUUID()}`,
      tripId: data.tripId,
      userId: data.userId,
      action: data.action,
      detail: data.detail || '',
      createdAt: new Date()
    };
    activities.set(act.id, act);
    return { ...act };
  });
  prisma.activity.deleteMany = jest.fn(async () => ({ count: 0 }));

  // ── prisma.otp ─────────────────────────────────────────────────────────────
  prisma.otp.create = jest.fn(async ({ data }) => {
    const newOtp = {
      id: data.id || `otp-${crypto.randomUUID()}`,
      email: (data.email || '').toLowerCase(),
      hash: data.hash,
      purpose: data.purpose,
      expiresAt: new Date(data.expiresAt),
      attempts: data.attempts || 0,
      createdAt: new Date()
    };
    otps.set(newOtp.id, newOtp);
    return { ...newOtp };
  });

  prisma.otp.upsert = jest.fn(async ({ where, update, create }) => {
    const email = (where?.email_purpose?.email || create.email).toLowerCase();
    const purpose = where?.email_purpose?.purpose || create.purpose;

    let existing = Array.from(otps.values()).find(
      o => o.email.toLowerCase() === email && o.purpose === purpose
    );

    if (existing) {
      Object.assign(existing, update);
      return { ...existing };
    }

    const newOtp = {
      id: `otp-${crypto.randomUUID()}`,
      email,
      hash: create.hash,
      purpose,
      expiresAt: new Date(create.expiresAt),
      attempts: create.attempts || 0,
      createdAt: new Date()
    };
    otps.set(newOtp.id, newOtp);
    return { ...newOtp };
  });

  prisma.otp.findFirst = jest.fn(async ({ where }) => {
    const list = Array.from(otps.values());
    return list.find(o => {
      if (where.email && o.email.toLowerCase() !== where.email.toLowerCase()) return false;
      if (where.purpose && o.purpose !== where.purpose) return false;
      return true;
    }) || null;
  });

  prisma.otp.updateMany = jest.fn(async ({ where, data }) => {
    let count = 0;
    for (const o of otps.values()) {
      const matchEmail = !where.email || o.email.toLowerCase() === where.email.toLowerCase();
      const matchPurpose = !where.purpose || o.purpose === where.purpose;
      if (matchEmail && matchPurpose) {
        if (data.attempts !== undefined) {
          if (data.attempts.increment) {
            o.attempts += data.attempts.increment;
          } else {
            o.attempts = data.attempts;
          }
        }
        if (data.createdAt) o.createdAt = new Date(data.createdAt);
        if (data.expiresAt) o.expiresAt = new Date(data.expiresAt);
        count++;
      }
    }
    return { count };
  });

  prisma.otp.update = jest.fn(async ({ where, data }) => {
    let o = otps.get(where.id);
    if (!o && where.email) {
      o = Array.from(otps.values()).find(x => x.email.toLowerCase() === where.email.toLowerCase());
    }
    if (o) {
      if (data.attempts !== undefined) {
        if (data.attempts.increment) {
          o.attempts += data.attempts.increment;
        } else {
          o.attempts = data.attempts;
        }
      }
      if (data.createdAt) o.createdAt = new Date(data.createdAt);
      if (data.expiresAt) o.expiresAt = new Date(data.expiresAt);
      return { ...o };
    }
    return null;
  });

  prisma.otp.deleteMany = jest.fn(async ({ where }) => {
    let count = 0;
    for (const [id, o] of otps.entries()) {
      let matches = true;
      if (where?.email && o.email.toLowerCase() !== where.email.toLowerCase()) matches = false;
      if (where?.purpose && o.purpose !== where.purpose) matches = false;
      if (where?.expiresAt?.lt && o.expiresAt >= where.expiresAt.lt) matches = false;
      if (matches) {
        otps.delete(id);
        count++;
      }
    }
    return { count };
  });

  prisma.otp.delete = jest.fn(async ({ where }) => {
    const id = where.id;
    if (id && otps.has(id)) {
      const o = otps.get(id);
      otps.delete(id);
      return o;
    }
    return null;
  });

  // ── Database Queries & Healthcheck ─────────────────────────────────────────
  prisma.$queryRaw = jest.fn(async () => [{ '?column?': 1 }]);
  prisma.$disconnect = jest.fn(async () => {});

  return {
    users,
    trips,
    tripMembers,
    places,
    expenses,
    otps,
    activities,
    reset
  };
}

module.exports = { setupPrismaMock };
