const multer = require('multer');

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const maxImageBytes = 15 * 1024 * 1024;
const maxVideoBytes = 250 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxVideoBytes },
  fileFilter: (req, file, callback) => {
    if (!imageTypes.has(file.mimetype) && !videoTypes.has(file.mimetype)) return callback(new Error('Unsupported media type. Use JPG, PNG, WebP, MP4, WebM, or MOV.'));
    callback(null, true);
  }
});

function validateMediaSize(req, res, next) {
  if (!req.file) return next();
  const image = imageTypes.has(req.file.mimetype);
  if (image && req.file.size > maxImageBytes) return res.status(400).json({ success: false, message: 'Images must be 15 MB or smaller.' });
  if (!image && req.file.size > maxVideoBytes) return res.status(400).json({ success: false, message: 'Videos must be 250 MB or smaller.' });
  next();
}

module.exports = { upload, validateMediaSize, maxImageBytes, maxVideoBytes };
