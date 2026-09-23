const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/analyticsController');

const router = express.Router();
const eventWindows = new Map();
function publicEventGuard(req, res, next) {
  const key = `${req.ip}:${String(req.body?.sessionId || '').slice(0, 80)}`;
  const now = Date.now();
  const previous = eventWindows.get(key) || [];
  const recent = previous.filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 120) return res.status(429).json({ success: false, message: 'Analytics limit reached. Please try again later.' });
  recent.push(now); eventWindows.set(key, recent); next();
}
router.post('/events', databaseGuard, express.json(), publicEventGuard, controller.collectEvent);
router.get('/overview', databaseGuard, requireAuth, requirePermission('analytics:view'), controller.overview);

module.exports = router;
