const mongoose = require('mongoose');
const { Booking, Client, Service, Package, Project } = require('../models');
const { notifyManagers } = require('../services/notificationService');

const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'];

function isValidDate(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function validateBookingInput(body, partial = false) {
  const errors = [];
  if (!partial && (!body.fullName || !String(body.fullName).trim())) errors.push('Full name is required');
  if (!partial && (!body.email && !body.phone)) errors.push('Email or phone is required');
  if (!partial && !body.service) errors.push('Service is required');
  if (!partial && !body.preferredDate) errors.push('Preferred date is required');
  if (body.preferredDate !== undefined && !isValidDate(body.preferredDate)) errors.push('Preferred date is invalid');
  if (body.status !== undefined && !validStatuses.includes(body.status)) errors.push('Booking status is invalid');
  return errors;
}

async function validateReferences(serviceId, packageId, activeOnly = false) {
  if (!mongoose.isValidObjectId(serviceId)) return { error: 'Invalid service ID' };
  const service = await Service.findOne({ _id: serviceId, ...(activeOnly ? { active: true } : {}) });
  if (!service) return { error: 'Service not found' };
  if (packageId) {
    if (!mongoose.isValidObjectId(packageId)) return { error: 'Invalid package ID' };
    const packageItem = await Package.findOne({ _id: packageId, service: serviceId, ...(activeOnly ? { active: true } : {}) });
    if (!packageItem) return { error: 'Package not found for this service' };
    return { service, package: packageItem };
  }
  return { service, package: null };
}

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

function normalizePhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/[^\d+]/g, '');
  if (!digits) return '';
  return digits.replace(/^00/, '+').replace(/\s+/g, '');
}

async function findOrCreateClient({ fullName, email, phone }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const filters = [];
  if (normalizedEmail) filters.push({ email: normalizedEmail });
  if (normalizedPhone) filters.push({ phone: normalizedPhone }, { phone: normalizedPhone.replace(/\+/g, '') }, { phone: normalizedPhone.replace(/\D/g, '') });
  if (!filters.length) {
    const newClient = await Client.create({ fullName: fullName.trim(), email: normalizedEmail, phone: normalizedPhone, status: 'active' });
    return newClient;
  }
  let client = await Client.findOne({ $or: filters });
  if (client) {
    client.fullName = fullName.trim();
    if (normalizedEmail) client.email = normalizedEmail;
    if (normalizedPhone) client.phone = normalizedPhone;
    if (!client.status) client.status = 'active';
    await client.save();
    return client;
  }
  return Client.create({ fullName: fullName.trim(), email: normalizedEmail, phone: normalizedPhone, status: 'active' });
}

const bookingPopulate = [
  { path: 'client', select: 'fullName phone email' },
  { path: 'service', select: 'name category price' },
  { path: 'package', select: 'name price' }
];

async function bookingAccessFilter(user) {
  if (['superadmin', 'manager'].includes(user.role)) return {};
  const projects = await Project.find({ $or: [{ 'assignments.user': user._id, 'assignments.assignmentRole': user.role }, { assignedStaff: user._id }] }).distinct('_id');
  return { $or: [{ assignedStaff: user._id }, { project: { $in: projects } }] };
}

async function createBooking(req, res, next) {
  const errors = validateBookingInput(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  try {
    const references = await validateReferences(req.body.service, req.body.package, true);
    if (references.error) return res.status(references.error.includes('not found') ? 404 : 400).json({ success: false, message: references.error });
    const client = await findOrCreateClient(req.body);
    const booking = await Booking.create({
      client: client._id,
      service: req.body.service,
      package: req.body.package || null,
      serviceSnapshot: { name: references.service.name, price: references.service.price, duration: references.service.duration },
      packageSnapshot: references.package ? { name: references.package.name, price: references.package.price, duration: references.package.duration } : undefined,
      preferredDate: new Date(req.body.preferredDate),
      preferredTime: req.body.preferredTime || '',
      eventType: req.body.eventType || '',
      message: req.body.message || '',
      status: 'pending'
    });
    const populated = await Booking.findById(booking._id).populate(bookingPopulate);
    await notifyManagers({ type: 'booking_created', title: 'New booking request', message: `${client.fullName} submitted a booking request for ${populated.service?.name || 'a studio service'}.`, relatedType: 'booking', relatedId: booking._id, eventKey: `booking_created:${booking._id}` });
    res.status(201).json({ success: true, message: 'Booking request submitted successfully', data: populated });
  } catch (error) { next(error); }
}

async function listBookings(req, res, next) {
  try {
    const bookings = await Booking.find(await bookingAccessFilter(req.user)).populate(bookingPopulate).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) { next(error); }
}

async function getBooking(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid booking ID' });
  try {
    const booking = await Booking.findOne({ _id: req.params.id, ...(await bookingAccessFilter(req.user)) }).populate(bookingPopulate);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) { next(error); }
}

async function updateBooking(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid booking ID' });
  const errors = validateBookingInput(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  try {
    const updates = {};
    ['service', 'package', 'preferredDate', 'preferredTime', 'eventType', 'message', 'status', 'notes'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    delete updates.fullName;
    delete updates.email;
    delete updates.phone;
    if (updates.preferredDate) updates.preferredDate = new Date(updates.preferredDate);
    if (updates.service || updates.package) {
      const existing = await Booking.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });
      const referenceError = await validateReferences(updates.service || existing.service, updates.package === undefined ? existing.package : updates.package);
      if (referenceError) return res.status(referenceError.message.includes('not found') ? 404 : 400).json({ success: false, message: referenceError.message });
    }
    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate(bookingPopulate);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (updates.status && updates.status !== existingBooking.status) {
      const type = `booking_${updates.status}`;
      const labels = { confirmed: 'confirmed', rescheduled: 'rescheduled', cancelled: 'cancelled', completed: 'completed', pending: 'returned to pending' };
      await notifyManagers({ type, title: 'Booking status updated', message: `Booking for ${booking.service?.name || 'a studio service'} was ${labels[updates.status] || updates.status}.`, relatedType: 'booking', relatedId: booking._id, eventKey: `${type}:${booking._id}:${booking.updatedAt}` });
    }
    res.json({ success: true, message: 'Booking updated successfully', data: booking });
  } catch (error) { next(error); }
}

async function deleteBooking(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid booking ID' });
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) { next(error); }
}

module.exports = { createBooking, listBookings, getBooking, updateBooking, deleteBooking };
