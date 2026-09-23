const express = require('express');
const controller = require('../controllers/bookingController');
const projectController = require('../controllers/projectController');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');

const router = express.Router();
router.use(databaseGuard);
router.get('/', requireAuth, requirePermission('bookings:view'), controller.listBookings);
router.get('/:id', requireAuth, requirePermission('bookings:view'), controller.getBooking);
router.post('/', controller.createBooking);
router.post('/:id/create-project', requireAuth, requirePermission('projects:manage'), projectController.createFromBooking);
router.put('/:id', requireAuth, requirePermission('bookings:manage'), controller.updateBooking);
router.delete('/:id', requireAuth, requirePermission('bookings:manage'), controller.deleteBooking);

module.exports = router;
