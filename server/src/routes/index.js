const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const testRoutes = require('./test.routes');
const requestRoutes = require('./request.routes');
const departmentRoutes = require('./department.routes');
const aiRoutes = require('./ai.routes');
const analyticsRoutes = require('./analytics.routes');

const router = express.Router();

// Mount API routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/test', testRoutes);
router.use('/requests', requestRoutes);
router.use('/departments', departmentRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;

