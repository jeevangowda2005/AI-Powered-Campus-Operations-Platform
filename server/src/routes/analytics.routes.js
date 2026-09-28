const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

const router = express.Router();

router.get('/student', authenticate, authorize('STUDENT'), analyticsController.getStudentAnalytics);
router.get('/staff', authenticate, authorize('STAFF', 'ADMIN'), analyticsController.getStaffAnalytics);
router.get('/admin', authenticate, authorize('ADMIN'), analyticsController.getAdminAnalytics);

module.exports = router;
