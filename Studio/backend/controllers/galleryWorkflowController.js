const crypto = require('crypto');
const mongoose = require('mongoose');
const { Gallery, GalleryItem, RevisionRequest, Package } = require('../models');
const { notifyProjectTeamAndManagers } = require('../services/notificationService');

function hashToken(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }

async function getAuthorizedGallery(token) {
  return Gallery.findOne({ accessTokenHash: hashToken(token), accessRevokedAt: null, galleryStatus: { $in: ['active', 'completed', 'ready'] } }).populate({ path: 'project', populate: { path: 'booking', populate: { path: 'package', select: 'selectionLimit name' } } });
}

async function getSelectionLimit(gallery) {
  return gallery.project?.booking?.package?.selectionLimit ?? null;
}

async function selectItem(req, res, next) {
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    if (!['open', 'revision-requested'].includes(gallery.selectionStatus)) return res.status(409).json({ success: false, message: 'This selection is no longer open for changes.' });
    const item = await GalleryItem.findOne({ _id: req.params.itemId, gallery: gallery._id });
    if (!item) return res.status(404).json({ success: false, message: 'Media not found in this gallery.' });
    const limit = await getSelectionLimit(gallery);
    const selectedCount = await GalleryItem.countDocuments({ gallery: gallery._id, selected: true });
    if (!item.selected && limit !== null && selectedCount >= limit) return res.status(409).json({ success: false, message: `Your package allows ${limit} selected photos. Please remove one selection before selecting another.` });
    const wasSelected = item.selected;
    item.selected = true;
    await item.save();
    res.json({ success: true, data: { selected: true, selectedCount: selectedCount + (wasSelected ? 0 : 1), selectionLimit: limit } });
  } catch (error) { next(error); }
}

async function unselectItem(req, res, next) {
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    const item = await GalleryItem.findOneAndUpdate({ _id: req.params.itemId, gallery: gallery._id }, { selected: false }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Media not found in this gallery.' });
    res.json({ success: true, data: { selected: false, selectedCount: await GalleryItem.countDocuments({ gallery: gallery._id, selected: true }), selectionLimit: await getSelectionLimit(gallery) } });
  } catch (error) { next(error); }
}

async function submitSelection(req, res, next) {
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    if (gallery.selectionStatus !== 'open' && gallery.selectionStatus !== 'revision-requested') return res.status(409).json({ success: false, message: 'This selection is no longer open for changes.' });
    const limit = await getSelectionLimit(gallery);
    const selectedCount = await GalleryItem.countDocuments({ gallery: gallery._id, selected: true });
    if (limit !== null && selectedCount > limit) return res.status(409).json({ success: false, message: `Your package allows ${limit} selected photos.` });
    gallery.selectionStatus = 'submitted';
    gallery.selectionSubmittedAt = new Date();
    await gallery.save();
    await notifyProjectTeamAndManagers(gallery.project?._id, { type: 'selection_submitted', title: 'Client selection submitted', message: `A client submitted ${selectedCount} selected photo${selectedCount === 1 ? '' : 's'} for ${gallery.project?.title || gallery.title}.`, relatedType: 'gallery', relatedId: gallery._id, eventKey: `selection_submitted:${gallery._id}:${gallery.selectionSubmittedAt}` });
    res.json({ success: true, message: 'Selection submitted to the studio.', data: { selectedCount, selectionLimit: limit, selectionStatus: gallery.selectionStatus, submittedAt: gallery.selectionSubmittedAt } });
  } catch (error) { next(error); }
}

async function requestRevision(req, res, next) {
  if (!req.body.message?.trim()) return res.status(400).json({ success: false, message: 'Revision message is required.' });
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    const item = await GalleryItem.findOne({ _id: req.params.itemId, gallery: gallery._id });
    if (!item) return res.status(404).json({ success: false, message: 'Media not found in this gallery.' });
    const revision = await RevisionRequest.create({ gallery: gallery._id, galleryItem: item._id, client: gallery.client._id, message: req.body.message.trim() });
    await Gallery.findByIdAndUpdate(gallery._id, { selectionStatus: 'revision-requested' });
    await notifyProjectTeamAndManagers(gallery.project?._id, { type: 'revision_requested', title: 'Client requested a revision', message: `A client requested a revision for ${gallery.project?.title || gallery.title}.`, relatedType: 'revision', relatedId: revision._id, eventKey: `revision_requested:${revision._id}` });
    res.status(201).json({ success: true, message: 'Revision request recorded.', data: revision });
  } catch (error) { next(error); }
}

async function approveItem(req, res, next) {
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    const item = await GalleryItem.findOneAndUpdate({ _id: req.params.itemId, gallery: gallery._id, editedFileUrl: { $ne: '' } }, { approved: true, approvedAt: new Date() }, { new: true });
    if (!item) return res.status(400).json({ success: false, message: 'Only media with an edited version can be approved.' });
    await notifyProjectTeamAndManagers(gallery.project?._id, { type: 'gallery_approved', title: 'Final media approved', message: `A client approved final media for ${gallery.project?.title || gallery.title}.`, relatedType: 'gallery', relatedId: gallery._id, eventKey: `gallery_approved:${gallery._id}:${item._id}:${item.approvedAt}` });
    res.json({ success: true, message: 'Media approved.', data: item });
  } catch (error) { next(error); }
}

async function downloadItem(req, res, next) {
  try {
    const gallery = await getAuthorizedGallery(req.params.token);
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    const item = await GalleryItem.findOne({ _id: req.params.itemId, gallery: gallery._id, downloadable: true }).select('editedFileUrl fileUrl');
    if (!item) return res.status(404).json({ success: false, message: 'This media is not available for download.' });
    res.redirect(item.editedFileUrl || item.fileUrl);
  } catch (error) { next(error); }
}

async function listRevisions(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gallery ID.' });
  try { res.json({ success: true, data: await RevisionRequest.find({ gallery: req.params.id }).populate('galleryItem', 'title fileUrl editedFileUrl').populate('client', 'fullName').populate('assignedEditor', 'name role').sort({ createdAt: -1 }) }); } catch (error) { next(error); }
}

async function updateRevision(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid revision ID.' });
  if (!['open', 'in-progress', 'completed', 'cancelled'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Revision status is invalid.' });
  try {
    const updates = { status: req.body.status };
    if (req.body.assignedEditor) updates.assignedEditor = req.body.assignedEditor;
    if (req.body.status === 'completed') updates.completedAt = new Date();
    const revision = await RevisionRequest.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!revision) return res.status(404).json({ success: false, message: 'Revision request not found.' });
    res.json({ success: true, message: 'Revision request updated.', data: revision });
  } catch (error) { next(error); }
}

module.exports = { selectItem, unselectItem, submitSelection, requestRevision, approveItem, downloadItem, listRevisions, updateRevision };
