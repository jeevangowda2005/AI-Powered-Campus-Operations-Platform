const express = require('express');
const {
  create,
  getMyRequests,
  getStaffRequests,
  getAllRequests,
  getRequestById,
  updateStatus,
  assign,
} = require('../controllers/request.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

const router = express.Router();

// Student endpoints
router.post('/', authenticate, authorize('STUDENT'), create);
router.get('/my', authenticate, authorize('STUDENT'), getMyRequests);

// Staff endpoints
router.get('/staff', authenticate, authorize('STAFF', 'ADMIN'), getStaffRequests);

// Admin endpoints
router.get('/', authenticate, authorize('ADMIN'), getAllRequests);

// Shared protected endpoints
router.get('/:id', authenticate, authorize('STUDENT', 'STAFF', 'ADMIN'), getRequestById);
router.patch('/:id/status', authenticate, authorize('STAFF', 'ADMIN'), updateStatus);
router.patch('/:id/assign', authenticate, authorize('STAFF', 'ADMIN'), assign);

module.exports = router;
