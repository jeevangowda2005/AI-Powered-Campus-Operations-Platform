const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { initSocketServer } = require('./socket/socket.server');

const PORT = config.port || 5000;
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Campus Operations Server running on port ${PORT}`);
  console.log(`📡 Health Check endpoint: http://localhost:${PORT}/api/health`);
  console.log(`⚡ Socket.IO real-time server ready.`);
});
