const { ContactInquiry } = require('../models');
const { notifyManagers } = require('../services/notificationService');

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createInquiry(req, res, next) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const message = String(req.body.message || '').trim();
  if (!name || !email || !message) return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  try {
    const inquiry = await ContactInquiry.create({ name, email, message });
    await notifyManagers({ type: 'contact_inquiry', title: 'New contact inquiry', message: `${name} sent a contact inquiry.`, relatedType: 'contact', relatedId: inquiry._id, eventKey: `contact_inquiry:${inquiry._id}` });
    res.status(201).json({ success: true, message: 'Your message has been sent successfully.' });
  } catch (error) { next(error); }
}

async function listInquiries(req, res, next) {
  try { res.json({ success: true, data: await ContactInquiry.find().sort({ createdAt: -1 }).limit(200).lean() }); } catch (error) { next(error); }
}

async function updateInquiry(req, res, next) {
  if (!['new', 'read', 'archived'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Inquiry status is invalid.' });
  try {
    const inquiry = await ContactInquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    res.json({ success: true, data: inquiry });
  } catch (error) { next(error); }
}

module.exports = { createInquiry, listInquiries, updateInquiry };
