const mongoose = require('mongoose');
const { Package, Service } = require('../models');

function validatePackageInput(body, partial = false) {
  const errors = [];
  if (!partial && (!body.name || !String(body.name).trim())) errors.push('Package name is required');
  if (!partial && !body.service) errors.push('Package service is required');
  if (body.price !== undefined && (body.price === '' || Number.isNaN(Number(body.price)) || Number(body.price) < 0)) errors.push('Price must be a valid non-negative number');
  if (body.features !== undefined && !Array.isArray(body.features)) errors.push('Features must be an array');
  return errors;
}

async function ensureService(serviceId) {
  if (!mongoose.isValidObjectId(serviceId)) return null;
  return Service.findById(serviceId);
}

async function listPackages(req, res, next) {
  try {
    const filter = req.query.includeInactive === 'true' || req.query.admin === 'true' ? {} : { active: true };
    const packages = await Package.find(filter).populate('service', 'name category').sort({ createdAt: -1 });
    res.json({ success: true, data: packages });
  } catch (error) { next(error); }
}

async function getPackage(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid package ID' });
  try {
    const packageItem = await Package.findById(req.params.id).populate('service', 'name category');
    if (!packageItem) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, data: packageItem });
  } catch (error) { next(error); }
}

async function createPackage(req, res, next) {
  const errors = validatePackageInput(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  if (!mongoose.isValidObjectId(req.body.service)) return res.status(400).json({ success: false, message: 'Invalid service ID' });
  try {
    if (!await ensureService(req.body.service)) return res.status(404).json({ success: false, message: 'Service not found' });
    const packageItem = await Package.create({ ...req.body, price: req.body.price === undefined || req.body.price === '' ? 0 : Number(req.body.price) });
    const populated = await packageItem.populate('service', 'name category');
    res.status(201).json({ success: true, message: 'Package created successfully', data: populated });
  } catch (error) { next(error); }
}

async function updatePackage(req, res, next) {
  const errors = validatePackageInput(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid package ID' });
  if (req.body.service && !mongoose.isValidObjectId(req.body.service)) return res.status(400).json({ success: false, message: 'Invalid service ID' });
  try {
    if (req.body.service && !await ensureService(req.body.service)) return res.status(404).json({ success: false, message: 'Service not found' });
    const updates = { ...req.body };
    if (updates.price !== undefined) updates.price = Number(updates.price);
    const packageItem = await Package.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('service', 'name category');
    if (!packageItem) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, message: 'Package updated successfully', data: packageItem });
  } catch (error) { next(error); }
}

async function deletePackage(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid package ID' });
  try {
    const packageItem = await Package.findByIdAndDelete(req.params.id);
    if (!packageItem) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error) { next(error); }
}

module.exports = { listPackages, getPackage, createPackage, updatePackage, deletePackage };
