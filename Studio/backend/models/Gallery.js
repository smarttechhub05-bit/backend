const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  assignedStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  accessStatus: { type: String, enum: ['private', 'public'], default: 'private' },
  galleryStatus: { type: String, enum: ['draft', 'active', 'completed', 'archived', 'ready'], default: 'draft' },
  accessTokenHash: { type: String, select: false, default: '' },
  accessRevokedAt: { type: Date, default: null }
  ,selectionStatus: { type: String, enum: ['open', 'submitted', 'under-review', 'approved', 'revision-requested', 'completed'], default: 'open' }
  ,selectionSubmittedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
