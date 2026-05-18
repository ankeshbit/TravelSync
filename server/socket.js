const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let io;

const setupSocket = (server, corsOptions) => {
  io = new Server(server, {
    cors: corsOptions
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
         return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const tripId = socket.handshake.query.tripId;
    if (tripId) {
      const roomName = `trip:${tripId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName} as ${socket.user.name}`);
      
      // Notify others in room
      socket.to(roomName).emit('user:joined', {
        userId: socket.user._id,
        name: socket.user.name,
        email: socket.user.email
      });

      // Handle re-broadcasting events
      const events = [
        'place:added', 
        'place:deleted', 
        'place:reordered', 
        'expense:added', 
        'expense:deleted', 
        'member:joined'
      ];

      events.forEach(eventName => {
        socket.on(eventName, (data) => {
          socket.to(roomName).emit(eventName, data);
        });
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        socket.to(roomName).emit('user:left', {
          userId: socket.user._id
        });
      });
    } else {
      socket.disconnect(); // Reject if no tripId
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

module.exports = { setupSocket, getIO };
