import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

// Determine socket URL based on environment or fallback
const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

/**
 * Connect to Socket.IO server with JWT authentication
 * Reuses existing socket if already connected with same token.
 */
export const connectSocket = (token) => {
  if (!token) return null;

  if (socket && currentToken === token && socket.connected) {
    return socket;
  }

  // Disconnect prior socket if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: { token },
    path: '/socket.io',
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[Socket Client] Connected to Socket.IO server — socketId:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket Client] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket Client] Disconnected:', reason);
  });

  return socket;
};

/**
 * Disconnect socket (e.g. on user logout)
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
    console.log('[Socket Client] Socket disconnected on logout.');
  }
};

/**
 * Get current socket instance
 */
export const getSocket = () => socket;
