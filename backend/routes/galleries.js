const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const { upload, validateMediaSize } = require('../middleware/mediaUpload');
const controller = require('../controllers/galleryController');

const router = express.Router();
router.use(databaseGuard, requireAuth);
router.get('/', requirePermission('galleries:view'), controller.listGalleries);
router.get('/:id', requirePermission('galleries:view'), controller.getGallery);
router.post('/', requirePermission('galleries:manage'), controller.createGallery);
router.put('/:id', requirePermission('galleries:manage'), controller.updateGallery);
router.delete('/:id', requirePermission('galleries:manage'), controller.deleteGallery);
router.post('/:id/media', requirePermission('galleries:manage'), upload.single('file'), validateMediaSize, controller.addMedia);
router.get('/:id/media', requirePermission('galleries:view'), controller.listMedia);
router.get('/:id/media/:itemId/secure-url', requirePermission('galleries:view'), controller.getMediaSignedUrl);
router.put('/:id/media/:itemId', requirePermission('galleries:manage'), controller.updateMedia);
router.delete('/:id/media/:itemId', requirePermission('galleries:manage'), controller.deleteMedia);

module.exports = router;
