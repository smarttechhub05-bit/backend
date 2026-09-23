const express = require('express');
const controller = require('../controllers/packageController');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');

function requireAdminRead(req, res, next) {
	if (req.query.admin !== 'true') return next();
	return requireAuth(req, res, () => requirePermission('packages:manage')(req, res, next));
}

const router = express.Router();
router.use(databaseGuard);
router.get('/', requireAdminRead, controller.listPackages);
router.get('/:id', requireAuth, controller.getPackage);
router.post('/', requireAuth, requirePermission('packages:manage'), controller.createPackage);
router.put('/:id', requireAuth, requirePermission('packages:manage'), controller.updatePackage);
router.delete('/:id', requireAuth, requirePermission('packages:manage'), controller.deletePackage);

module.exports = router;
