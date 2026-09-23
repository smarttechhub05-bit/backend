const mongoose = require('mongoose');

const revisionRequestSchema = new mongoose.Schema({
  gallery: { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  galleryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'GalleryItem', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'cancelled'], default: 'open' },
  assignedEditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('RevisionRequest', revisionRequestSchema);
