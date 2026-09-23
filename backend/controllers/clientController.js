const mongoose = require('mongoose');
const { Client, Project, Booking, Gallery, GalleryItem, RevisionRequest } = require('../models');

function buildClientAccessFilter(user) {
  if (['superadmin', 'manager'].includes(user.role)) return {};
  return { _id: { $in: [] } };
}

async function getAccessibleClientIds(user) {
  if (['superadmin', 'manager'].includes(user.role)) return null;
  const projects = await Project.find({ $or: [{ 'assignments.user': user._id, 'assignments.assignmentRole': user.role }, { assignedStaff: user._id }] }).distinct('client');
  return projects;
}

function normalizeClientQuery(query) {
  const cleaned = String(query || '').trim();
  return cleaned ? cleaned.toLowerCase() : '';
}

async function decorateClientSummary(client) {
  const [bookingCount, projectCount, activeProject, lastActivity] = await Promise.all([
    Booking.countDocuments({ client: client._id }),
    Project.countDocuments({ client: client._id }),
    Project.findOne({ client: client._id, status: { $nin: ['cancelled'] } }).sort({ updatedAt: -1, shootDate: -1 }).select('title status shootDate updatedAt').lean(),
    Booking.findOne({ client: client._id }).sort({ updatedAt: -1, createdAt: -1 }).select('updatedAt createdAt').lean()
  ]);
  const projectDoc = activeProject || await Project.findOne({ client: client._id }).sort({ updatedAt: -1, shootDate: -1 }).select('title status shootDate updatedAt').lean();
  const latest = [client.updatedAt, client.createdAt, lastActivity?.updatedAt, lastActivity?.createdAt, projectDoc?.updatedAt].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
  return {
    ...client,
    bookingCount,
    projectCount,
    activeProject: activeProject?.title || projectDoc?.title || 'None',
    activeProjectStatus: activeProject?.status || projectDoc?.status || 'No active project',
    lastActivity: latest ? new Date(latest).toISOString() : null,
    status: client.status || 'active'
  };
}

async function listClients(req, res, next) {
  try {
    const filteredIds = await getAccessibleClientIds(req.user);
    const filter = filteredIds ? { _id: { $in: filteredIds } } : {};
    const clients = await Client.find(filter).sort({ createdAt: -1 }).lean();
    const data = await Promise.all(clients.map((client) => decorateClientSummary(client)));
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

async function getClient(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const client = await Client.findById(req.params.id).lean();
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
    res.json({ success: true, data: await decorateClientSummary(client) });
  } catch (error) { next(error); }
}

async function updateClient(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
    const payload = { ...req.body };
    if (payload.fullName) client.fullName = String(payload.fullName).trim();
    if (payload.phone !== undefined) client.phone = String(payload.phone || '').trim();
    if (payload.email !== undefined) client.email = normalizeClientQuery(payload.email) || '';
    if (payload.address !== undefined) client.address = String(payload.address || '').trim();
    if (payload.notes !== undefined) client.notes = String(payload.notes || '').trim();
    if (payload.status !== undefined) client.status = ['active', 'inactive'].includes(payload.status) ? payload.status : client.status;
    await client.save();
    res.json({ success: true, message: 'Client updated successfully.', data: await decorateClientSummary(client.toObject()) });
  } catch (error) { next(error); }
}

async function patchClientStatus(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  const status = req.body.status;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Client status is invalid.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const client = await Client.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
    res.json({ success: true, message: 'Client status updated.', data: client });
  } catch (error) { next(error); }
}

async function getClientHistory(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const client = await Client.findById(req.params.id).lean();
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
    const [bookings, projects, galleries, revisions] = await Promise.all([
      Booking.find({ client: client._id }).populate([{ path: 'service', select: 'name' }, { path: 'package', select: 'name' }]).sort({ createdAt: -1 }).lean(),
      Project.find({ client: client._id }).populate([{ path: 'booking', select: 'preferredDate status' }, { path: 'assignments.user', select: 'name role' }]).sort({ shootDate: -1, createdAt: -1 }).lean(),
      Gallery.find({ client: client._id }).populate([{ path: 'project', select: 'title' }]).sort({ createdAt: -1 }).lean(),
      RevisionRequest.find({ client: client._id }).populate([{ path: 'gallery', select: 'title' }, { path: 'galleryItem', select: 'title' }]).sort({ createdAt: -1 }).lean()
    ]);
    const timeline = [];
    bookings.forEach((booking) => timeline.push({ date: booking.createdAt, label: `${booking.status} booking`, detail: `${booking.service?.name || 'Service'} · ${booking.eventType || 'Event'}` }));
    projects.forEach((project) => timeline.push({ date: project.createdAt, label: `Project created`, detail: `${project.title} · ${project.status}` }));
    galleries.forEach((gallery) => timeline.push({ date: gallery.createdAt, label: `Gallery created`, detail: `${gallery.title} · ${gallery.galleryStatus}` }));
    revisions.forEach((revision) => timeline.push({ date: revision.createdAt, label: `Revision requested`, detail: `${revision.message}` }));
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: { client, bookings, projects, galleries, revisions, timeline } });
  } catch (error) { next(error); }
}

async function getClientBookings(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const bookings = await Booking.find({ client: req.params.id }).populate([{ path: 'service', select: 'name' }, { path: 'package', select: 'name' }]).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: bookings });
  } catch (error) { next(error); }
}

async function getClientProjects(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const projects = await Project.find({ client: req.params.id }).populate([{ path: 'assignments.user', select: 'name role' }, { path: 'booking', select: 'preferredDate status' }]).sort({ shootDate: -1 }).lean();
    res.json({ success: true, data: projects });
  } catch (error) { next(error); }
}

async function getClientGalleries(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const galleries = await Gallery.find({ client: req.params.id }).populate([{ path: 'project', select: 'title' }]).sort({ createdAt: -1 }).lean();
    const mapped = await Promise.all(galleries.map(async (gallery) => ({ ...gallery, mediaCount: await GalleryItem.countDocuments({ gallery: gallery._id }) })));
    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
}

async function getClientRevisions(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID.' });
  try {
    const accessIds = await getAccessibleClientIds(req.user);
    if (accessIds && !accessIds.some((id) => String(id) === String(req.params.id))) return res.status(403).json({ success: false, message: 'You do not have access to this client.' });
    const revisions = await RevisionRequest.find({ client: req.params.id }).populate([{ path: 'gallery', select: 'title' }, { path: 'galleryItem', select: 'title' }]).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: revisions });
  } catch (error) { next(error); }
}

module.exports = { listClients, getClient, updateClient, patchClientStatus, getClientHistory, getClientBookings, getClientProjects, getClientGalleries, getClientRevisions };
