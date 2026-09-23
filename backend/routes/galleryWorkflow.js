const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const controller = require('../controllers/galleryWorkflowController');

const router = express.Router();
router.use(databaseGuard);
router.post('/:token/items/:itemId/select', controller.selectItem);
router.post('/:token/items/:itemId/unselect', controller.unselectItem);
router.post('/:token/submit-selection', controller.submitSelection);
router.post('/:token/items/:itemId/revisions', controller.requestRevision);
router.post('/:token/items/:itemId/approve', controller.approveItem);
router.get('/:token/items/:itemId/download', controller.downloadItem);

module.exports = router;
