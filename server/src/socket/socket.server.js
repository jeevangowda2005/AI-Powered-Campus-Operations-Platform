'use strict';

const { Server } = require('socket.io');
const config = require('../config/env');
const { socketAuthMiddleware } = require('./socket.auth');
const { Redis } = require('ioredis');

let io = null;
let redisSubClient = null;

/**
 * Initialize Socket.IO server on top of HTTP server
 * @param {import('http').Server} httpServer 
 */
const initSocketServer = (httpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: [
        config.clientUrl || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:5174',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    path: '/socket.io',
  });

  // Apply JWT authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) return socket.disconnect(true);

    const userRoom = `user:${user.id}`;
    const roleRoom = `role:${user.role}`;

    socket.join(userRoom);
    socket.join(roleRoom);

    if (user.role === 'STAFF' && user.departmentId) {
      socket.join(`department:${user.departmentId}`);
    }

    console.log(`[Socket.IO] Client connected — socketId: ${socket.id}, userId: ${user.id}, role: ${user.role}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected — socketId: ${socket.id}, userId: ${user.id}, reason: ${reason}`);
    });
  });

  // Set up Redis Pub/Sub listener for worker events (e.g. background AI updates)
  setupRedisSubBridge();

  return io;
};

/**
 * Get active Socket.IO server instance
 */
const getIo = () => io;

/**
 * Setup Redis subscriber for cross-process event broadcasting (e.g. from Worker)
 */
const setupRedisSubBridge = () => {
  if (redisSubClient) return;

  try {
    redisSubClient = new Redis(config.redisUrl, {
      connectTimeout: 2000,
      lazyConnect: false,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        if (times > 3) return null; // Stop reconnecting cleanly if Redis down
        return Math.min(times * 200, 1000);
      },
    });

    redisSubClient.on('connect', () => {
      console.log('[Socket.IO Redis Bridge] Subscribed to Redis channel "socket-events".');
      redisSubClient.subscribe('socket-events', (err) => {
        if (err) console.warn('[Socket.IO Redis Bridge] Subscribe error:', err.message);
      });
    });

    redisSubClient.on('message', (channel, message) => {
      if (channel === 'socket-events') {
        try {
          const parsed = JSON.parse(message);
          const { handler, payload } = parsed;
          const socketHandlers = require('./socket.handlers');
          if (handler && typeof socketHandlers[handler] === 'function') {
            socketHandlers[handler](payload);
          }
        } catch (err) {
          console.warn('[Socket.IO Redis Bridge] Error processing message:', err.message);
        }
      }
    });

    redisSubClient.on('error', (err) => {
      console.warn('[Socket.IO Redis Bridge] Redis error (non-fatal):', err.message);
    });
  } catch (err) {
    console.warn('[Socket.IO Redis Bridge] Failed to initialize Redis subscriber (non-fatal):', err.message);
  }
};

/**
 * Broadcast helpers
 */
const emitToUser = (userId, event, payload) => {
  if (io && userId) {
    io.to(`user:${userId}`).emit(event, payload);
  }
};

const emitToRole = (role, event, payload) => {
  if (io && role) {
    io.to(`role:${role}`).emit(event, payload);
  }
};

const emitToDepartment = (departmentId, event, payload) => {
  if (io && departmentId) {
    io.to(`department:${departmentId}`).emit(event, payload);
  }
};

const emitToAdmins = (event, payload) => {
  emitToRole('ADMIN', event, payload);
};

module.exports = {
  initSocketServer,
  getIo,
  emitToUser,
  emitToRole,
  emitToDepartment,
  emitToAdmins,
};
