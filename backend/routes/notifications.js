const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(databaseGuard, requireAuth);
router.get('/', controller.listNotifications);
router.get('/unread-count', controller.unreadCount);
router.put('/:id/read', controller.markRead);
router.put('/read-all', controller.markAllRead);
router.delete('/:id', controller.deleteNotification);

module.exports = router;
