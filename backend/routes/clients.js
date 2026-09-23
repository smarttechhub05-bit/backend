const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/clientController');

const router = express.Router();
router.use(databaseGuard, requireAuth);
router.get('/', requirePermission('clients:view'), controller.listClients);
router.get('/:id/history', requirePermission('clients:view'), controller.getClientHistory);
router.get('/:id/bookings', requirePermission('clients:view'), controller.getClientBookings);
router.get('/:id/projects', requirePermission('clients:view'), controller.getClientProjects);
router.get('/:id/galleries', requirePermission('clients:view'), controller.getClientGalleries);
router.get('/:id/revisions', requirePermission('clients:view'), controller.getClientRevisions);
router.get('/:id', requirePermission('clients:view'), controller.getClient);
router.put('/:id', requirePermission('clients:manage'), controller.updateClient);
router.patch('/:id/status', requirePermission('clients:manage'), controller.patchClientStatus);

module.exports = router;
