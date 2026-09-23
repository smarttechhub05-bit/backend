const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/galleryWorkflowController');

const router = express.Router();
router.use(databaseGuard, requireAuth, requirePermission('galleries:manage'));
router.get('/gallery/:id', controller.listRevisions);
router.put('/:id', controller.updateRevision);

module.exports = router;
