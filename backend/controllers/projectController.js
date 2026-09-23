const mongoose = require('mongoose');
const { Project, User, Booking } = require('../models');
const { createNotifications } = require('../services/notificationService');

const assignmentRoles = ['photographer', 'videographer', 'editor'];
const projectStatuses = ['scheduled', 'upcoming', 'in-progress', 'editing', 'completed', 'delivered', 'cancelled'];

function accessFilter(user) {
  if (['superadmin', 'manager'].includes(user.role)) return {};
  return { $or: [{ 'assignments.user': user._id, 'assignments.assignmentRole': user.role }, { assignedStaff: user._id }] };
}

function validTime(value) { return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

function validateProjectInput(body, partial = false) {
  if (!partial && (!body.client || !mongoose.isValidObjectId(body.client))) return 'A valid client is required.';
  if (!partial && (!body.title || !String(body.title).trim())) return 'Project title is required.';
  if (!partial && !body.shootDate) return 'Shoot date is required.';
  if (body.shootDate !== undefined && Number.isNaN(new Date(body.shootDate).getTime())) return 'Shoot date is invalid.';
  if (body.startTime !== undefined && !validTime(body.startTime)) return 'Start time must use HH:MM format.';
  if (body.endTime !== undefined && !validTime(body.endTime)) return 'End time must use HH:MM format.';
  if (body.startTime && body.endTime && body.endTime <= body.startTime) return 'End time must be after start time.';
  if (body.status !== undefined && !projectStatuses.includes(body.status)) return 'Project status is invalid.';
  return null;
}

async function validateStaffAssignments(assignments) {
  if (!Array.isArray(assignments)) return { message: 'Assignments must be an array.' };
  const seenRoles = new Set();
  const result = [];
  for (const item of assignments) {
    if (!mongoose.isValidObjectId(item.user) || !assignmentRoles.includes(item.assignmentRole)) return { message: 'Each assignment needs a valid user and assignment role.' };
    if (seenRoles.has(item.assignmentRole)) return { message: `Only one ${item.assignmentRole} assignment is allowed.` };
    seenRoles.add(item.assignmentRole);
    const user = await User.findById(item.user).select('role active');
    if (!user || !user.active) return { message: 'Assigned staff must exist and be active.' };
    if (user.role !== item.assignmentRole) return { message: `${item.assignmentRole} assignments require a staff member with that role.` };
    result.push({ user: user._id, assignmentRole: item.assignmentRole });
  }
  return { assignments: result };
}

async function checkConflicts({ assignments, shootDate, startTime, endTime }, excludeId = null) {
  if (!startTime || !endTime || !assignments.length) return null;
  const dayStart = new Date(shootDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(shootDate); dayEnd.setHours(23, 59, 59, 999);
  const query = { _id: excludeId ? { $ne: excludeId } : { $exists: true }, shootDate: { $gte: dayStart, $lte: dayEnd }, status: { $ne: 'cancelled' }, 'assignments.user': { $in: assignments.map((item) => item.user) } };
  const existing = await Project.findOne(query).select('title startTime endTime').lean();
  if (!existing || !existing.startTime || !existing.endTime) return null;
  return startTime < existing.endTime && endTime > existing.startTime ? `Staff scheduling conflict with ${existing.title}.` : null;
}

const populateProject = (query) => query.populate('client', 'fullName phone email').populate('booking', 'preferredDate preferredTime status createdAt').populate('booking.service', 'name category').populate('booking.package', 'name price').populate('assignments.user', 'name email role active');

async function listProjects(req, res, next) {
  try { res.json({ success: true, data: await populateProject(Project.find(accessFilter(req.user)).sort({ shootDate: 1, createdAt: -1 })) }); } catch (error) { next(error); }
}

async function getProject(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID.' });
  try {
    const project = await populateProject(Project.findOne({ _id: req.params.id, ...accessFilter(req.user) }));
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (error) { next(error); }
}

async function createProject(req, res, next) {
  const validationError = validateProjectInput(req.body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  try {
    const assignmentsResult = await validateStaffAssignments(req.body.assignments || []);
    if (assignmentsResult.message) return res.status(400).json({ success: false, message: assignmentsResult.message });
    const conflict = await checkConflicts({ ...req.body, assignments: assignmentsResult.assignments });
    if (conflict) return res.status(409).json({ success: false, message: conflict });
    const project = await Project.create({ ...req.body, projectType: req.body.projectType || req.body.type || '', type: req.body.projectType || req.body.type || '', shootDate: new Date(req.body.shootDate), assignments: assignmentsResult.assignments, assignedStaff: assignmentsResult.assignments.map((item) => item.user), status: req.body.status || 'scheduled' });
    res.status(201).json({ success: true, message: 'Project created successfully.', data: await populateProject(Project.findById(project._id)) });
  } catch (error) { next(error); }
}

async function updateProject(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID.' });
  const validationError = validateProjectInput(req.body, true);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  try {
    const existing = await Project.findOne({ _id: req.params.id, ...accessFilter(req.user) });
    if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });
    const updates = { ...req.body };
    if (updates.projectType !== undefined) updates.type = updates.projectType;
    if (updates.type !== undefined && updates.projectType === undefined) updates.projectType = updates.type;
    if (updates.shootDate) updates.shootDate = new Date(updates.shootDate);
    if (updates.assignments !== undefined) {
      const assignmentsResult = await validateStaffAssignments(updates.assignments);
      if (assignmentsResult.message) return res.status(400).json({ success: false, message: assignmentsResult.message });
      updates.assignments = assignmentsResult.assignments;
      updates.assignedStaff = assignmentsResult.assignments.map((item) => item.user);
    }
    const conflict = await checkConflicts({ shootDate: updates.shootDate || existing.shootDate, startTime: updates.startTime || existing.startTime, endTime: updates.endTime || existing.endTime, assignments: updates.assignments || existing.assignments }, existing._id);
    if (conflict) return res.status(409).json({ success: false, message: conflict });
    const project = await Project.findByIdAndUpdate(existing._id, updates, { new: true, runValidators: true });
    if (updates.assignments !== undefined) {
      const previousUsers = new Set((existing.assignments || []).map((assignment) => String(assignment.user)));
      const newAssignments = updates.assignments.filter((assignment) => !previousUsers.has(String(assignment.user)));
      await createNotifications({ recipients: newAssignments.map((assignment) => assignment.user), type: 'project_assigned', title: 'New project assigned', message: `You have been assigned to ${project.title}.`, relatedType: 'project', relatedId: project._id, eventKey: `project_assigned:${project._id}:${project.updatedAt}` });
    }
    res.json({ success: true, message: 'Project updated successfully.', data: await populateProject(Project.findById(project._id)) });
  } catch (error) { next(error); }
}

async function cancelProject(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID.' });
  try {
    const project = await Project.findOneAndUpdate({ _id: req.params.id, ...accessFilter(req.user) }, { status: 'cancelled' }, { new: true, runValidators: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, message: 'Project cancelled successfully.', data: project });
  } catch (error) { next(error); }
}

async function updateAssignments(req, res, next) { return updateProject({ ...req, body: { assignments: req.body.assignments } }, res, next); }

async function createFromBooking(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid booking ID.' });
  try {
    const booking = await Booking.findById(req.params.id).populate('client').populate('service', 'name category').populate('package', 'name');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.project) return res.status(409).json({ success: false, message: 'This booking already has a project.', data: await populateProject(Project.findById(booking.project)) });
    if (booking.status !== 'confirmed') return res.status(400).json({ success: false, message: 'Only confirmed bookings can become projects.' });
    const existing = await Project.findOne({ booking: booking._id });
    if (existing) return res.status(409).json({ success: false, message: 'This booking already has a project.', data: existing });
    const project = await Project.create({ client: booking.client._id, booking: booking._id, title: `${booking.service?.name || 'Studio'} project`, projectType: booking.eventType || booking.service?.category || '', type: booking.eventType || booking.service?.category || '', description: booking.message || '', shootDate: booking.preferredDate, startTime: booking.preferredTime || '', status: 'scheduled' });
    booking.project = project._id;
    await booking.save();
    res.status(201).json({ success: true, message: 'Project created from booking successfully.', data: await populateProject(Project.findById(project._id)) });
  } catch (error) { next(error); }
}

async function listCalendar(req, res, next) {
  try {
    const filter = { ...accessFilter(req.user), status: { $ne: 'cancelled' }, shootDate: { $gte: new Date(req.query.from || '2000-01-01'), $lte: new Date(req.query.to || '2100-01-01') } };
    const projects = await Project.find(filter).populate('client', 'fullName').populate('assignments.user', 'name role').sort({ shootDate: 1, startTime: 1 });
    res.json({ success: true, data: projects });
  } catch (error) { next(error); }
}

module.exports = { listProjects, getProject, createProject, updateProject, cancelProject, updateAssignments, createFromBooking, listCalendar };
