const express = require('express');
const controller = require('../controllers/contactController');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');

const router = express.Router();
router.post('/', databaseGuard, controller.createInquiry);
router.get('/', databaseGuard, requireAuth, requirePermission('bookings:view'), controller.listInquiries);
router.put('/:id', databaseGuard, requireAuth, requirePermission('bookings:manage'), controller.updateInquiry);

module.exports = router;
