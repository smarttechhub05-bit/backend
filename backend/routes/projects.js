const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/authorization');
const controller = require('../controllers/projectController');
const galleryController = require('../controllers/galleryController');

const router = express.Router();
router.use(databaseGuard, requireAuth);
router.get('/', controller.listProjects);
router.get('/calendar/events', controller.listCalendar);
router.get('/:id', controller.getProject);
router.post('/:id/create-gallery', requirePermission('galleries:manage'), galleryController.createGalleryFromProject);
router.post('/', requirePermission('projects:manage'), controller.createProject);
router.put('/:id', requirePermission('projects:manage'), controller.updateProject);
router.delete('/:id', requirePermission('projects:manage'), controller.cancelProject);
router.put('/:id/assignments', requirePermission('projects:assign'), controller.updateAssignments);

module.exports = router;
