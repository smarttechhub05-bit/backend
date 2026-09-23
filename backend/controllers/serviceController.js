const mongoose = require('mongoose');
const { Service } = require('../models');

const validCategories = ['Photography', 'Videography', 'Events', 'Portraits', 'Weddings', 'Commercial', 'Other'];

function validateServiceInput(body, partial = false) {
  const errors = [];
  if (!partial && (!body.name || !String(body.name).trim())) errors.push('Service name is required');
  if (body.price !== undefined && (body.price === '' || Number.isNaN(Number(body.price)) || Number(body.price) < 0)) errors.push('Price must be a valid non-negative number');
  if (body.category !== undefined && !validCategories.includes(body.category)) errors.push('Service category is invalid');
  return errors;
}

async function listServices(req, res, next) {
  try {
    const filter = req.query.includeInactive === 'true' || req.query.admin === 'true' ? {} : { active: true };
    const services = await Service.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) { next(error); }
}

async function getService(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid service ID' });
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, data: service });
  } catch (error) { next(error); }
}

async function createService(req, res, next) {
  const errors = validateServiceInput(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  try {
    const service = await Service.create({ ...req.body, price: req.body.price === undefined || req.body.price === '' ? 0 : Number(req.body.price) });
    res.status(201).json({ success: true, message: 'Service created successfully', data: service });
  } catch (error) { next(error); }
}

async function updateService(req, res, next) {
  const errors = validateServiceInput(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid service ID' });
  try {
    const updates = { ...req.body };
    if (updates.price !== undefined) updates.price = Number(updates.price);
    const service = await Service.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, message: 'Service updated successfully', data: service });
  } catch (error) { next(error); }
}

async function deleteService(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid service ID' });
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) { next(error); }
}

module.exports = { listServices, getService, createService, updateService, deleteService };
