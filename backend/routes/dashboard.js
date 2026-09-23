const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/dashboardController');

const router = express.Router();
router.use(databaseGuard, requireAuth, requirePermission('dashboard:view'));
router.get('/stats', controller.getDashboardStats);
router.get('/recent-bookings', controller.getRecentBookings);

module.exports = router;
