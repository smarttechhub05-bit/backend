const mongoose = require('mongoose');

const portfolioCategories = ['photography', 'videography', 'weddings', 'portraits', 'events', 'fashion', 'commercial', 'portfolio'];

const galleryItemSchema = new mongoose.Schema({
  gallery: { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  type: { type: String, enum: ['photo', 'video'], required: true },
  category: { type: String, enum: portfolioCategories, default: 'portfolio', trim: true },
  fileUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  altText: { type: String, default: '', trim: true },
  selected: { type: Boolean, default: false },
  approved: { type: Boolean, default: false },
  downloadable: { type: Boolean, default: false },
  storageProvider: { type: String, default: 'local-development' },
  objectKey: { type: String, default: '', trim: true },
  storageKey: { type: String, default: '', trim: true },
  mimeType: { type: String, default: '', trim: true },
  sizeBytes: { type: Number, min: 0, default: 0 },
  editedFileUrl: { type: String, default: '' },
  editedThumbnailUrl: { type: String, default: '' },
  approvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
