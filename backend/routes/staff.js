const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/staffController');

const router = express.Router();
router.use(databaseGuard, requireAuth);
router.get('/', requirePermission('staff:view'), controller.listStaff);
router.post('/', requirePermission('staff:manage'), controller.createStaff);
router.put('/:id', requirePermission('staff:manage'), controller.updateStaff);
router.delete('/:id', requirePermission('staff:manage'), controller.deactivateStaff);

module.exports = router;
