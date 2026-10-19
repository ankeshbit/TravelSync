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
    let currentRoom = null;

    // Register disconnect handler BEFORE any await in the connection handler
    socket.on('disconnect', async (reason) => {
      if (!config.isProduction) {
        logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
      }
      if (currentRoom) {
        socket.leave(currentRoom);
        try {
          const remainingSockets = await io.in(currentRoom).fetchSockets();
          const userStillPresent = remainingSockets.some(
            s => s.userId === socket.userId || s.data?.userId === socket.userId || s.user?.id === socket.userId
          );
          if (!userStillPresent) {
            io.to(currentRoom).emit('user:left', {
              userId: socket.user ? socket.user.id : socket.userId
            });
          }
        } catch (discErr) {
          if (!config.isProduction) {
            logger.error({ err: discErr }, 'Error during socket disconnect cleanup');
          }
        }
      }
    });

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
      currentRoom = roomName;
      socket.join(roomName);

      if (!config.isProduction) {
        logger.debug(`Socket ${socket.id} joined room ${roomName} as ${socket.user.name}`);
      }

      // Build current online list and send presence:list to the connected socket
      const socketsInRoom = await io.in(roomName).fetchSockets();
      const onlineMap = new Map();
      for (const s of socketsInRoom) {
        const u = s.user || (s.data && s.data.user);
        const uid = s.userId || (s.data && s.data.userId) || (u && u.id);
        if (uid) {
          onlineMap.set(uid, {
            userId: uid,
            id: uid,
            name: u?.name || 'Member',
            email: u?.email || '',
            picture: u?.picture || ''
          });
        }
      }

      socket.emit('presence:list', Array.from(onlineMap.values()));

      // Notify other members in room using socket.user.id consistently
      socket.to(roomName).emit('user:joined', {
        userId: socket.user.id,
        id: socket.user.id,
        name: socket.user.name,
        email: socket.user.email,
        picture: socket.user.picture || ''
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

const removeAllUsersFromTripRoom = async (tripId, options = {}) => {
  if (!io) return;
  const roomName = `trip:${tripId}`;
  try {
    const room = io.sockets.adapter?.rooms?.get(roomName);
    if (room) {
      for (const socketId of Array.from(room)) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          if (!options.silent) {
            s.emit('trip:removed', { tripId });
          }
          s.leave(roomName);
        }
      }
    } else {
      const sockets = await io.in(roomName).fetchSockets();
      for (const s of sockets) {
        if (!options.silent) {
          s.emit('trip:removed', { tripId });
        }
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
