const { Server } = require('socket.io');
const config = require('./config/env');
const { prisma, formatUser } = require('./db');
const { verifyAuthToken } = require('./utils/verifyAuthToken');
const logger = require('./utils/logger');

let io;

const setupSocket = (server, corsOptions) => {
  io = new Server(server, {
    cors: corsOptions
  });

  // ─── Socket Authentication Middleware ───────────────────────────────────────
  // Uses the same token verification as REST middleware (Firebase ID token or local JWT)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.split(' ')[1]);

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const dbUser = await verifyAuthToken(token);
      socket.user = formatUser(dbUser);
      socket.userId = dbUser.id;
      socket.data = socket.data || {};
      socket.data.userId = dbUser.id;
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message || 'Invalid or expired token'}`));
    }
  });

  // ─── Socket Connection Handler ──────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const tripId = socket.handshake.query?.tripId;
    if (!tripId) {
      socket.emit('error', { message: 'tripId query parameter is required' });
      socket.disconnect(true);
      return;
    }

    try {
      // Verify user is owner or TripMember of tripId via Prisma
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          ownerId: true,
          members: {
            select: { userId: true }
          }
        }
      });

      if (!trip) {
        socket.emit('error', { message: 'Trip not found' });
        socket.disconnect(true);
        return;
      }

      const isOwner = trip.ownerId === socket.user.id;
      const isMember = trip.members.some(m => m.userId === socket.user.id);

      if (!isOwner && !isMember) {
        socket.emit('error', { message: 'Access denied: You are not a member of this trip' });
        socket.disconnect(true);
        return;
      }

      const roomName = `trip:${tripId}`;
      socket.join(roomName);

      if (!config.isProduction) {
        logger.debug(`Socket ${socket.id} joined room ${roomName} as ${socket.user.name}`);
      }

      // Notify other members in room using socket.user.id consistently
      socket.to(roomName).emit('user:joined', {
        userId: socket.user.id,
        name: socket.user.name,
        email: socket.user.email
      });

      // Handle disconnect cleanup
      socket.on('disconnect', (reason) => {
        if (!config.isProduction) {
          logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
        }
        socket.to(roomName).emit('user:left', {
          userId: socket.user.id
        });
        socket.leave(roomName);
      });
    } catch (err) {
      if (!config.isProduction) {
        logger.error({ err }, 'Socket trip membership verification error');
      }
      socket.emit('error', { message: 'Failed to verify trip membership' });
      socket.disconnect(true);
    }
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const removeUserFromTripRoom = async (tripId, userId) => {
  if (!io) return;
  const roomName = `trip:${tripId}`;
  try {
    const room = io.sockets.adapter?.rooms?.get(roomName);
    if (room) {
      for (const socketId of Array.from(room)) {
        const s = io.sockets.sockets.get(socketId);
        if (s && (s.userId === userId || s.user?.id === userId || s.data?.userId === userId)) {
          s.emit('trip:removed', { tripId, userId });
          s.leave(roomName);
        }
      }
    } else {
      const sockets = await io.in(roomName).fetchSockets();
      for (const s of sockets) {
        if (s.userId === userId || s.data?.userId === userId) {
          s.emit('trip:removed', { tripId, userId });
          s.leave(roomName);
        }
      }
    }
  } catch (err) {
    if (!config.isProduction) {
      logger.error({ err }, 'Error removing user socket from trip room');
    }
  }
};

const removeAllUsersFromTripRoom = async (tripId) => {
  if (!io) return;
  const roomName = `trip:${tripId}`;
  try {
    const room = io.sockets.adapter?.rooms?.get(roomName);
    if (room) {
      for (const socketId of Array.from(room)) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.emit('trip:removed', { tripId });
          s.leave(roomName);
        }
      }
    } else {
      const sockets = await io.in(roomName).fetchSockets();
      for (const s of sockets) {
        s.emit('trip:removed', { tripId });
        s.leave(roomName);
      }
    }
  } catch (err) {
    if (!config.isProduction) {
      logger.error({ err }, 'Error removing all sockets from trip room');
    }
  }
};

module.exports = { setupSocket, getIO, removeUserFromTripRoom, removeAllUsersFromTripRoom };
