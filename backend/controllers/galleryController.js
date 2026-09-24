const crypto = require('crypto');
const mongoose = require('mongoose');
const { Gallery, GalleryItem, Project, Client } = require('../models');
const { uploadFile, deleteFile, getSignedUrl: generateSignedUrl } = require('../services/storageService');
const { notifyProjectTeamAndManagers } = require('../services/notificationService');

const allowedTypes = ['photo', 'video'];
const galleryStatuses = ['draft', 'active', 'completed', 'archived', 'ready'];
const accessStatuses = ['private', 'public'];
const portfolioCategories = ['photography', 'videography', 'weddings', 'portraits', 'events', 'fashion', 'commercial', 'portfolio'];

function roleFilter(user) {
  if (['superadmin', 'manager'].includes(user.role)) return {};
  return { $or: [{ assignedStaff: user._id }, { project: { $in: user.assignedProjectIds || [] } }] };
}

async function scopedFilter(user) {
  if (['superadmin', 'manager'].includes(user.role)) return {};
  const projects = await Project.find({ $or: [{ 'assignments.user': user._id, 'assignments.assignmentRole': user.role }, { assignedStaff: user._id }] }).distinct('_id');
  return { $or: [{ assignedStaff: user._id }, { project: { $in: projects } }] };
}

function publicGalleryFilter(tokenHash) {
  return { accessTokenHash: tokenHash, accessRevokedAt: null, accessStatus: { $in: ['private', 'public'] }, galleryStatus: { $in: ['active', 'completed', 'ready'] } };
}

function safeGallery(query) {
  return query.populate('client', 'fullName email phone').populate('project', 'title projectType type shootDate location status').select('-accessTokenHash');
}

function tokenPair() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}

async function galleryStats(galleryId) {
  const [total, photos, videos, selected, approved] = await Promise.all([
    GalleryItem.countDocuments({ gallery: galleryId }),
    GalleryItem.countDocuments({ gallery: galleryId, type: 'photo' }),
    GalleryItem.countDocuments({ gallery: galleryId, type: 'video' }),
    GalleryItem.countDocuments({ gallery: galleryId, selected: true }),
    GalleryItem.countDocuments({ gallery: galleryId, approved: true })
  ]);
  return { total, photos, videos, selected, approved };
}

async function listGalleries(req, res, next) {
  try {
    const galleries = await safeGallery(Gallery.find(await scopedFilter(req.user)).sort({ createdAt: -1 }));
    const data = await Promise.all(galleries.map(async (gallery) => ({ ...gallery.toObject(), mediaStats: await galleryStats(gallery._id) })));
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

async function getGallery(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gallery ID.' });
  try {
    const gallery = await safeGallery(Gallery.findOne({ _id: req.params.id, ...(await scopedFilter(req.user)) }));
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
    const items = await GalleryItem.find({ gallery: gallery._id }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 200)).lean();
    res.json({ success: true, data: { ...gallery.toObject(), items, mediaStats: await galleryStats(gallery._id) } });
  } catch (error) { next(error); }
}

async function createGallery(req, res, next) {
  const { client, project, title } = req.body;
  if (!mongoose.isValidObjectId(client) || !mongoose.isValidObjectId(project) || !title?.trim()) return res.status(400).json({ success: false, message: 'Client, project, and title are required.' });
  try {
    const projectRecord = await Project.findById(project).select('client title projectType type');
    if (!projectRecord || String(projectRecord.client) !== String(client)) return res.status(400).json({ success: false, message: 'Project and client relationship is invalid.' });
    if (await Gallery.exists({ project })) return res.status(409).json({ success: false, message: 'This project already has a gallery.' });
    const pair = tokenPair();
    const gallery = await Gallery.create({ client, project, title: title.trim(), description: req.body.description || '', accessStatus: 'private', galleryStatus: 'draft', accessTokenHash: pair.hash, assignedStaff: projectRecord.assignedStaff || [] });
    await notifyProjectTeamAndManagers(project, { type: 'gallery_created', title: 'Client gallery created', message: `A client gallery was created for ${projectRecord.title}.`, relatedType: 'gallery', relatedId: gallery._id, eventKey: `gallery_created:${gallery._id}` });
    res.status(201).json({ success: true, message: 'Gallery created successfully.', accessToken: pair.token, data: await safeGallery(Gallery.findById(gallery._id)) });
  } catch (error) { next(error); }
}

async function createGalleryFromProject(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID.' });
  try {
    const project = await Project.findById(req.params.id).select('client title assignedStaff assignments');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    const existing = await Gallery.findOne({ project: project._id });
    if (existing) return res.status(409).json({ success: false, message: 'This project already has a gallery.', data: await safeGallery(Gallery.findById(existing._id)) });
    const pair = tokenPair();
    const assignedStaff = project.assignedStaff?.length ? project.assignedStaff : (project.assignments || []).map((assignment) => assignment.user);
    const gallery = await Gallery.create({ client: project.client, project: project._id, title: req.body.title || `${project.title} Gallery`, description: req.body.description || '', accessTokenHash: pair.hash, assignedStaff });
    await notifyProjectTeamAndManagers(project._id, { type: 'gallery_created', title: 'Client gallery created', message: `A client gallery was created for ${project.title}.`, relatedType: 'gallery', relatedId: gallery._id, eventKey: `gallery_created:${gallery._id}` });
    res.status(201).json({ success: true, message: 'Gallery created from project successfully.', accessToken: pair.token, data: await safeGallery(Gallery.findById(gallery._id)) });
  } catch (error) { next(error); }
}

async function updateGallery(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gallery ID.' });
  if (req.body.galleryStatus && !galleryStatuses.includes(req.body.galleryStatus)) return res.status(400).json({ success: false, message: 'Gallery status is invalid.' });
  if (req.body.accessStatus && !accessStatuses.includes(req.body.accessStatus)) return res.status(400).json({ success: false, message: 'Access status is invalid.' });
  try {
    const gallery = await Gallery.findOneAndUpdate({ _id: req.params.id, ...(await scopedFilter(req.user)) }, { $set: { title: req.body.title, description: req.body.description, coverImage: req.body.coverImage, galleryStatus: req.body.galleryStatus, accessStatus: req.body.accessStatus, accessRevokedAt: req.body.accessRevokedAt || null } }, { new: true, runValidators: true });
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
    res.json({ success: true, message: 'Gallery updated successfully.', data: await safeGallery(Gallery.findById(gallery._id)) });
  } catch (error) { next(error); }
}

async function archiveGallery(req, res, next) {
  req.body = { galleryStatus: 'archived' };
  return updateGallery(req, res, next);
}

async function deleteGallery(req, res, next) {
  return archiveGallery(req, res, next);
}

async function addMedia(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gallery ID.' });
  if (!req.file) return res.status(400).json({ success: false, message: 'A supported photo or video file is required.' });
  try {
    const gallery = await Gallery.findOne({ _id: req.params.id, ...(await scopedFilter(req.user)) });
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
    const requestedCategory = String(req.body.category || '').toLowerCase();
    const category = portfolioCategories.includes(requestedCategory) ? requestedCategory : 'portfolio';
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'photo';
    const stored = await uploadFile(req.file, { prefix: 'gallery', contentType: req.file.mimetype });
    const caption = req.body.caption || req.body.description || '';
    const item = await GalleryItem.create({
      gallery: gallery._id,
      type,
      category,
      fileUrl: stored.signedUrl || stored.url,
      thumbnailUrl: type === 'photo' ? (stored.signedUrl || stored.url) : '',
      title: req.body.title || req.file.originalname,
      description: caption || req.body.description || '',
      altText: req.body.altText || caption || '',
      storageProvider: stored.provider,
      objectKey: stored.objectKey || stored.key,
      storageKey: stored.objectKey || stored.key,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size
    });
    res.status(201).json({ success: true, message: 'Media added successfully.', data: item });
  } catch (error) { next(error); }
}

async function listMedia(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid gallery ID.' });
  try {
    const gallery = await Gallery.findOne({ _id: req.params.id, ...(await scopedFilter(req.user)) });
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
    res.json({ success: true, data: await GalleryItem.find({ gallery: gallery._id }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 200)) });
  } catch (error) { next(error); }
}

async function updateMedia(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.itemId)) return res.status(400).json({ success: false, message: 'Invalid media ID.' });
  try {
    const item = await GalleryItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Media not found.' });
    if (!(await Gallery.findOne({ _id: item.gallery, ...(await scopedFilter(req.user)) }))) return res.status(404).json({ success: false, message: 'Media not found.' });
    const updates = {};
    ['title', 'description', 'selected', 'approved', 'downloadable', 'editedFileUrl', 'editedThumbnailUrl'].forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    const updated = await GalleryItem.findByIdAndUpdate(item._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: 'Media updated successfully.', data: updated });
  } catch (error) { next(error); }
}

async function deleteMedia(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.itemId)) return res.status(400).json({ success: false, message: 'Invalid media ID.' });
  try {
    const item = await GalleryItem.findById(req.params.itemId);
    if (!item || !(await Gallery.findOne({ _id: item.gallery, ...(await scopedFilter(req.user)) }))) return res.status(404).json({ success: false, message: 'Media not found.' });
    const deleted = await deleteFile(item.objectKey || item.storageKey);
    if (!deleted && item.storageProvider === 'cloudflare-r2') return res.status(502).json({ success: false, message: 'The media file could not be removed from storage.' });
    await GalleryItem.findByIdAndDelete(item._id);
    res.json({ success: true, message: 'Media reference deleted successfully.' });
  } catch (error) { next(error); }
}

async function getMediaSignedUrl(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.itemId)) {
    return res.status(400).json({ success: false, message: 'Invalid gallery or media ID.' });
  }
  try {
    const gallery = await Gallery.findOne({ _id: req.params.id, ...(await scopedFilter(req.user)) });
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
    const item = await GalleryItem.findOne({ _id: req.params.itemId, gallery: gallery._id });
    if (!item) return res.status(404).json({ success: false, message: 'Media not found.' });
    const key = item.objectKey || item.storageKey;
    if (!key) return res.status(400).json({ success: false, message: 'This media item does not have a stored object key.' });
    const signedUrl = await generateSignedUrl(key);
    return res.json({ success: true, data: { url: signedUrl, objectKey: key, expiresIn: Number(process.env.R2_SIGNED_URL_TTL || 3600) } });
  } catch (error) { return next(error); }
}

async function publicGallery(req, res, next) {
  const tokenHash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
  try {
    const gallery = await Gallery.findOne(publicGalleryFilter(tokenHash)).populate('client', 'fullName').populate({ path: 'project', select: 'title projectType type shootDate location booking', populate: { path: 'booking', select: 'package', populate: { path: 'package', select: 'selectionLimit name' } } }).select('title description coverImage accessStatus galleryStatus selectionStatus selectionSubmittedAt client project createdAt updatedAt');
    if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found or access has expired.' });
    const items = await GalleryItem.find({ gallery: gallery._id }).select('type fileUrl thumbnailUrl editedFileUrl editedThumbnailUrl objectKey storageKey storageProvider title description selected approved approvedAt downloadable createdAt').sort({ createdAt: 1 }).limit(200).lean();
    const signedItems = await Promise.all(items.map(async (item) => {
      if (item.storageProvider !== 'cloudflare-r2') return item;
      const fileKey = item.objectKey || item.storageKey;
      const thumbnailKey = item.thumbnailUrl && item.thumbnailUrl !== item.fileUrl ? item.thumbnailUrl : fileKey;
      return {
        ...item,
        fileUrl: await generateSignedUrl(fileKey),
        thumbnailUrl: thumbnailKey ? await generateSignedUrl(thumbnailKey) : '',
        editedFileUrl: item.editedFileUrl || ''
      };
    }));
    const selectedCount = await GalleryItem.countDocuments({ gallery: gallery._id, selected: true });
    const selectionLimit = gallery.project?.booking?.package?.selectionLimit ?? null;
    res.json({ success: true, data: { ...gallery.toObject(), items: signedItems, selectionStatus: gallery.selectionStatus, selectionSubmittedAt: gallery.selectionSubmittedAt, selectionLimit, selectedCount, mediaStats: await galleryStats(gallery._id) } });
  } catch (error) { next(error); }
}

module.exports = { listGalleries, getGallery, createGallery, createGalleryFromProject, updateGallery, archiveGallery, deleteGallery, addMedia, listMedia, updateMedia, deleteMedia, getMediaSignedUrl, publicGallery };
