const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/websiteController');
const { upload, validateMediaSize } = require('../middleware/mediaUpload');

const router = express.Router();
router.get('/public/content', databaseGuard, controller.getPublicContent);
router.use('/admin', databaseGuard, requireAuth, requirePermission('website:manage'));
router.get('/admin/settings', controller.getAdminSettings);
router.put('/admin/settings', controller.updateSettings);
router.get('/admin/testimonials', controller.listTestimonials);
router.post('/admin/testimonials', controller.createTestimonial);
router.put('/admin/testimonials/:id', controller.updateTestimonial);
router.delete('/admin/testimonials/:id', controller.deleteTestimonial);
router.get('/admin/promotions', controller.listPromotions);
router.post('/admin/promotions', controller.createPromotion);
router.put('/admin/promotions/:id', controller.updatePromotion);
router.delete('/admin/promotions/:id', controller.deletePromotion);
router.get('/admin/media', controller.listMedia);
router.post('/admin/media', upload.single('file'), validateMediaSize, controller.uploadMedia);
router.delete('/admin/media/:id', controller.deleteMedia);

module.exports = router;
