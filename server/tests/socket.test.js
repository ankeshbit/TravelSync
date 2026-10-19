const http = require('http');
const express = require('express');
const { io: Client } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { setupSocket } = require('../socket');
const { verifyAuthToken } = require('../utils/verifyAuthToken');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

setupPrismaMock();

jest.setTimeout(30000);

// Mock Firebase token verification
jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'firebase-valid-token') {
      return {
        uid: 'fb-user-1',
        email: 'socketuser@example.com',
        name: 'Socket User',
        email_verified: true
      };
    }
    if (token === 'firebase-member-token') {
      return {
        uid: 'fb-user-member',
        email: 'member@example.com',
        name: 'Member User',
        email_verified: true
      };
    }
    if (token === 'firebase-nonmember-token') {
      return {
        uid: 'fb-user-2',
        email: 'outsider@example.com',
        name: 'Outsider User',
        email_verified: true
      };
    }
    throw new Error('Invalid Firebase token');
  }),
  getAdminApp: jest.fn()
}));

describe('Socket and Auth Token Hardening Tests', () => {
  let server;
  let ioServer;
  let port;
  let ownerUser;
  let memberUser;
  let _outsiderUser;
  let testTrip;
  let validToken;
  let memberToken;
  let outsiderToken;
  let jwtToken;

  beforeAll(async () => {
    // Upsert test users in DB
    ownerUser = await prisma.user.upsert({
      where: { email: 'socketuser@example.com' },
      update: { firebaseUid: 'fb-user-1' },
      create: {
        name: 'Socket User',
        email: 'socketuser@example.com',
        firebaseUid: 'fb-user-1',
        password: ''
      }
    });

    memberUser = await prisma.user.upsert({
      where: { email: 'member@example.com' },
      update: { firebaseUid: 'fb-user-member' },
      create: {
        name: 'Member User',
        email: 'member@example.com',
        firebaseUid: 'fb-user-member',
        password: ''
      }
    });

    _outsiderUser = await prisma.user.upsert({
      where: { email: 'outsider@example.com' },
      update: { firebaseUid: 'fb-user-2' },
      create: {
        name: 'Outsider User',
        email: 'outsider@example.com',
        firebaseUid: 'fb-user-2',
        password: ''
      }
    });

    // Create a trip owned by ownerUser with memberUser
    testTrip = await prisma.trip.create({
      data: {
        name: 'Socket Test Trip',
        destination: 'Kyoto, Japan',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-10'),
        ownerId: ownerUser.id,
        members: {
          create: [{ userId: ownerUser.id }, { userId: memberUser.id }]
        }
      }
    });

    validToken = 'firebase-valid-token';
    memberToken = 'firebase-member-token';
    outsiderToken = 'firebase-nonmember-token';
    jwtToken = jwt.sign({ userId: ownerUser.id }, 'test-secret-at-least-32-chars-long');

    // Setup HTTP and Socket.IO server on dynamic port
    const app = express();
    server = http.createServer(app);
    ioServer = setupSocket(server, { origin: '*' });

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (ioServer) ioServer.close();
    if (server) await new Promise((res) => server.close(res));
    // Clean up test trip
    if (testTrip?.id) {
      await prisma.trip.delete({ where: { id: testTrip.id } }).catch(() => {});
    }
  });

  describe('1. verifyAuthToken utility', () => {
    it('accepts Firebase ID token and resolves user', async () => {
      const user = await verifyAuthToken(validToken);
      expect(user).toBeDefined();
      expect(user.id).toBe(ownerUser.id);
    });

    it('rejects local JWT token since local fallback is removed', async () => {
      await expect(verifyAuthToken(jwtToken)).rejects.toMatchObject({
        statusCode: 401
      });
    });

    it('rejects missing or empty token with 401', async () => {
      await expect(verifyAuthToken('')).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining('No token provided')
      });
    });

    it('rejects invalid token with 401', async () => {
      await expect(verifyAuthToken('completely-bogus-token')).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining('Invalid or expired token')
      });
    });
  });

  describe('2. Socket Connection & Authentication', () => {
    it('rejects socket connection with no token provided', (done) => {
      const client = Client(`http://localhost:${port}`, {
        auth: {},
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('No token provided');
        client.close();
        done();
      });
    });

    it('rejects socket connection with invalid token', (done) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token-xyz' },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Invalid or expired token');
        client.close();
        done();
      });
    });

    it('disconnects and emits error if tripId query param is missing', (done) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
        reconnection: false
      });

      client.on('error', (data) => {
        expect(data.message).toContain('tripId query parameter is required');
        client.close();
        done();
      });
    });

    it('disconnects and emits error if user is not a member of tripId', (done) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: outsiderToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client.on('error', (data) => {
        expect(data.message).toContain('Access denied');
        client.close();
        done();
      });
    });

    it('successfully connects when user is trip owner/member and receives user:joined', (done) => {
      const client1 = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client1.on('connect', () => {
        // Now connect client2 for same trip
        const client2 = Client(`http://localhost:${port}`, {
          auth: { token: validToken },
          query: { tripId: testTrip.id },
          transports: ['websocket'],
          reconnection: false
        });

        client1.on('user:joined', (userPayload) => {
          expect(userPayload.userId).toBe(ownerUser.id);
          expect(userPayload.email).toBe(ownerUser.email);
          client1.close();
          client2.close();
          done();
        });
      });
    });
  });

  describe('3. Disconnect cleanup and no client-relay', () => {
    it('does NOT relay client-sent events (no client->server relay)', (done) => {
      const client1 = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client1.on('connect', () => {
        const client2 = Client(`http://localhost:${port}`, {
          auth: { token: validToken },
          query: { tripId: testTrip.id },
          transports: ['websocket'],
          reconnection: false
        });

        client2.on('connect', () => {
          const fakeListener = jest.fn();
          client2.on('place:added', fakeListener);

          // Client1 tries to blindly emit place:added directly to the socket
          client1.emit('place:added', { fake: 'data' });

          // Wait 300ms to ensure client2 never received the relay
          setTimeout(() => {
            expect(fakeListener).not.toHaveBeenCalled();
            client1.close();
            client2.close();
            done();
          }, 300);
        });
      });
    });

    it('emits user:left with socket.user.id on disconnect cleanup', (done) => {
      const client1 = Client(`http://localhost:${port}`, {
        auth: { token: memberToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      client1.on('connect', () => {
        const client2 = Client(`http://localhost:${port}`, {
          auth: { token: validToken },
          query: { tripId: testTrip.id },
          transports: ['websocket'],
          reconnection: false
        });

        // Wait until client2 has actually joined the room on the server
        client1.on('user:joined', () => {
          client1.on('user:left', (data) => {
            expect(data.userId).toBe(ownerUser.id);
            client1.close();
            done();
          });

          // Disconnect client2 after joining
          client2.disconnect();
        });
      });
    });

    it('emits trip:removed and removes socket when user is removed from trip', async () => {
      const { removeUserFromTripRoom } = require('../socket');
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      await new Promise((resolve) => {
        client.on('connect', resolve);
      });

      const removedPromise = new Promise((resolve) => {
        client.on('trip:removed', resolve);
      });

      await removeUserFromTripRoom(testTrip.id, ownerUser.id);
      const data = await removedPromise;
      expect(data.tripId).toBe(testTrip.id);
      client.close();
    });

    it('does NOT emit trip:removed when removeAllUsersFromTripRoom is called with silent: true', async () => {
      const { removeAllUsersFromTripRoom } = require('../socket');
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        query: { tripId: testTrip.id },
        transports: ['websocket'],
        reconnection: false
      });

      await new Promise((resolve) => {
        client.on('connect', resolve);
      });

      let receivedRemoved = false;
      client.on('trip:removed', () => {
        receivedRemoved = true;
      });

      await removeAllUsersFromTripRoom(testTrip.id, { silent: true });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(receivedRemoved).toBe(false);
      client.close();
    });
  });
});
