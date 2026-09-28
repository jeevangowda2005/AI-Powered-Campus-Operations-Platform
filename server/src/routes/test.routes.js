const express = require('express');
const { getStudentResource, getStaffResource, getAdminResource } = require('../controllers/test.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

const router = express.Router();

// Protected test routes
router.get('/student', authenticate, authorize('STUDENT', 'STAFF', 'ADMIN'), getStudentResource);
router.get('/staff', authenticate, authorize('STAFF', 'ADMIN'), getStaffResource);
router.get('/admin', authenticate, authorize('ADMIN'), getAdminResource);

module.exports = router;
