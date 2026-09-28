const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a signed JWT token for a user
 * @param {Object} payload - User object payload { id, email, role }
 * @returns {string} Signed JWT
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

/**
 * Verify a JWT token
 * @param {string} token 
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

module.exports = {
  generateToken,
  verifyToken,
};
