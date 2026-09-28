const express = require('express');
const { classify, suggestPriority, getSimilar, generateResolution } = require('../controllers/ai.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

const router = express.Router();

router.post('/classify/:requestId', authenticate, classify);
router.post('/suggest-priority/:requestId', authenticate, suggestPriority);
router.get('/similar/:requestId', authenticate, getSimilar);
router.post('/resolution/:requestId', authenticate, authorize('STAFF', 'ADMIN'), generateResolution);

module.exports = router;
