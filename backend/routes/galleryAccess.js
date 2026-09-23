const express = require('express');
const databaseGuard = require('../middleware/databaseGuard');
const controller = require('../controllers/galleryController');

const router = express.Router();
router.use(databaseGuard);
router.get('/:token', controller.publicGallery);

module.exports = router;
