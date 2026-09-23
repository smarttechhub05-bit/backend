const mongoose = require('mongoose');
const { Notification } = require('../models');

function notificationFilter(user) { return { recipient: user._id }; }

async function listNotifications(req, res, next) {
  try {
    const filter = notificationFilter(req.user);
    if (req.query.unread === 'true') filter.read = false;
    if (req.query.type) filter.type = String(req.query.type);
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 100)).lean();
    res.json({ success: true, data: notifications });
  } catch (error) { next(error); }
}

async function unreadCount(req, res, next) {
  try { res.json({ success: true, data: { count: await Notification.countDocuments({ recipient: req.user._id, read: false }) } }); } catch (error) { next(error); }
}

async function markRead(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { read: true }, { new: true }).lean();
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, data: notification });
  } catch (error) { next(error); }
}

async function markAllRead(req, res, next) {
  try { const result = await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true }); res.json({ success: true, data: { updated: result.modifiedCount } }); } catch (error) { next(error); }
}

async function deleteNotification(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
  try { const result = await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id }); if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Notification not found.' }); res.json({ success: true, message: 'Notification deleted.' }); } catch (error) { next(error); }
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead, deleteNotification };
