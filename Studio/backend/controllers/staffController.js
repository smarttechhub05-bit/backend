const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const roles = ['superadmin', 'manager', 'photographer', 'videographer', 'editor'];

function validateStaff(body, partial = false) {
  if (!partial && (!body.name || !String(body.name).trim())) return 'Name is required.';
  if (!partial && (!body.email || !String(body.email).trim())) return 'Email is required.';
  if (!partial && (!body.password || String(body.password).length < 8)) return 'Password must be at least 8 characters.';
  if (body.role !== undefined && !roles.includes(body.role)) return 'Role is invalid.';
  return null;
}

async function listStaff(req, res, next) {
  try {
    const staff = await User.find().select('name email role profileImage active createdAt updatedAt').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
}

async function createStaff(req, res, next) {
  const validationError = validateStaff(req.body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  try {
    const email = String(req.body.email).trim().toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ success: false, message: 'A staff account with that email already exists.' });
    const password = await bcrypt.hash(String(req.body.password), 12);
    const user = await User.create({ name: req.body.name, email, password, role: req.body.role || 'editor', profileImage: req.body.profileImage || '', active: req.body.active !== false });
    res.status(201).json({ success: true, message: 'Staff account created successfully.', data: await User.findById(user._id).select('name email role profileImage active createdAt updatedAt') });
  } catch (error) { next(error); }
}

async function updateStaff(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid staff ID.' });
  const validationError = validateStaff(req.body, true);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  try {
    const target = await User.findById(req.params.id).select('+password');
    if (!target) return res.status(404).json({ success: false, message: 'Staff account not found.' });
    const nextRole = req.body.role || target.role;
    const nextActive = req.body.active === undefined ? target.active : Boolean(req.body.active);
    const affectsSuperadmin = target.role === 'superadmin' && (nextRole !== 'superadmin' || !nextActive);
    if (affectsSuperadmin) {
      const activeSuperadmins = await User.countDocuments({ role: 'superadmin', active: true });
      if (activeSuperadmins <= 1) return res.status(400).json({ success: false, message: 'The last active Super Admin cannot be disabled or demoted.' });
    }
    const updates = {};
    ['name', 'profileImage'].forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.password) updates.password = await bcrypt.hash(String(req.body.password), 12);
    if (updates.email && await User.exists({ email: updates.email, _id: { $ne: target._id } })) return res.status(409).json({ success: false, message: 'A staff account with that email already exists.' });
    await User.findByIdAndUpdate(target._id, updates, { runValidators: true });
    res.json({ success: true, message: 'Staff account updated successfully.', data: await User.findById(target._id).select('name email role profileImage active createdAt updatedAt') });
  } catch (error) { next(error); }
}

async function deactivateStaff(req, res, next) {
  req.body = { active: false };
  return updateStaff(req, res, next);
}

module.exports = { listStaff, createStaff, updateStaff, deactivateStaff };
