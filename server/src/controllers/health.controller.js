/**
 * Health Check Controller
 * Handles backend health check requests
 */
const { isRedisConnected } = require('../config/redis');

const getHealthStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Campus Operations API is running',
    services: {
      database: 'connected',
      redis: isRedisConnected() ? 'connected' : 'unavailable',
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealthStatus,
};
