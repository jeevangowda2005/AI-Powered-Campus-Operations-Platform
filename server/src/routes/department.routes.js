const express = require('express');
const { getDepartments } = require('../controllers/department.controller');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getDepartments);

module.exports = router;
