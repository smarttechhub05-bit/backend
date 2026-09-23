const express = require('express');
const controller = require('../controllers/serviceController');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');

function requireAdminRead(req, res, next) {
	return req.query.admin === 'true' ? requireAuth(req, res, next) : next();
}

const router = express.Router();
router.use(databaseGuard);
router.get('/', requireAdminRead, controller.listServices);
router.get('/:id', requireAuth, controller.getService);
router.post('/', requireAuth, requirePermission('services:manage'), controller.createService);
router.put('/:id', requireAuth, requirePermission('services:manage'), controller.updateService);
router.delete('/:id', requireAuth, requirePermission('services:manage'), controller.deleteService);

module.exports = router;
