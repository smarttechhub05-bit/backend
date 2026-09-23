const express = require('express');
const controller = require('../controllers/authController');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(databaseGuard);
router.post('/login', controller.login);
router.post('/setup-admin', controller.setupAdmin);
router.get('/me', requireAuth, controller.me);
router.post('/logout', controller.logout);

module.exports = router;
