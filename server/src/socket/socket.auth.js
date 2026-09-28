'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/db');

/**
 * Socket.IO authentication middleware using existing JWT verification.
 * Extracts token from handshake auth or Authorization header.
 * Attaches authenticated user profile to socket.user.
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || !decoded.id) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, departmentId: true },
    });

    if (!user) {
      return next(new Error('Authentication error: User no longer exists'));
    }

    // Attach authenticated user profile to socket
    socket.user = user;
    return next();
  } catch (err) {
    return next(new Error('Authentication error: ' + err.message));
  }
};

module.exports = { socketAuthMiddleware };
