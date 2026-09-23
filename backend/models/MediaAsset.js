const mongoose = require('mongoose');

const portfolioCategories = ['photography', 'videography', 'weddings', 'portraits', 'events', 'fashion', 'commercial', 'portfolio'];

const mediaAssetSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  altText: { type: String, default: '', trim: true, maxlength: 250 },
  url: { type: String, required: true, trim: true, maxlength: 500 },
  objectKey: { type: String, default: '', trim: true },
  storageKey: { type: String, default: '', trim: true },
  storageProvider: { type: String, default: 'local-development', trim: true },
  mimeType: { type: String, default: '', trim: true },
  sizeBytes: { type: Number, min: 0, default: 0 },
  usage: { type: String, enum: ['general', 'hero', 'about', 'portfolio', 'promotion', 'testimonial'], default: 'general' },
  category: { type: String, enum: portfolioCategories, default: 'portfolio', trim: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('MediaAsset', mediaAssetSchema);
