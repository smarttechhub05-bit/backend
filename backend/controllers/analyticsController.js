const mongoose = require('mongoose');
const { AnalyticsEvent, Booking, Client, Project, Gallery, GalleryItem, RevisionRequest } = require('../models');

const studioTimeZone = 'Africa/Douala';
const eventTypes = new Set(['page_view', 'portfolio_view', 'service_view', 'booking_started', 'booking_submitted', 'whatsapp_click', 'phone_click', 'gallery_view']);
const deviceTypes = new Set(['mobile', 'desktop', 'tablet', 'other']);
const maxDays = 366;

function clean(value, max) { return String(value || '').trim().slice(0, max); }
function getRange(query) {
  const now = new Date();
  const requested = clean(query.range || 'last30', 20);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: studioTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).reduce((result, part) => { result[part.type] = part.value; return result; }, {});
  const localToday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 60 * 60 * 1000);
  let start = new Date(localToday);
  let end = new Date(localToday.getTime() + 24 * 60 * 60 * 1000);
  if (requested === 'today') { /* defaults are today */ }
  else if (requested === 'last7') start = new Date(localToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  else if (requested === 'last30') start = new Date(localToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  else if (requested === 'thisMonth') start = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1) - 60 * 60 * 1000);
  else if (requested === 'lastMonth') { start = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1) - 60 * 60 * 1000); end = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1) - 60 * 60 * 1000); }
  else if (query.start && query.end) { const customStart = new Date(query.start); const customEnd = new Date(query.end); if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) { start = customStart; end = new Date(customEnd.getTime() + 24 * 60 * 60 * 1000); } }
  if (end <= start || end.getTime() - start.getTime() > maxDays * 24 * 60 * 60 * 1000) return getRange({ range: 'last30' });
  return { start, end, label: requested };
}

function eventMatch(range) { return { createdAt: { $gte: range.start, $lt: range.end } }; }

async function websiteAnalytics(range) {
  const match = eventMatch(range);
  const [events, pages, services, devices, sources, sessions] = await Promise.all([
    AnalyticsEvent.countDocuments(match),
    AnalyticsEvent.aggregate([{ $match: match }, { $group: { _id: '$page', views: { $sum: 1 } } }, { $sort: { views: -1 } }, { $limit: 20 }]),
    AnalyticsEvent.aggregate([{ $match: { ...match, eventType: 'service_view' } }, { $group: { _id: '$service', views: { $sum: 1 } } }, { $sort: { views: -1 } }, { $limit: 20 }]),
    AnalyticsEvent.aggregate([{ $match: match }, { $group: { _id: '$deviceType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AnalyticsEvent.aggregate([{ $match: match }, { $group: { _id: '$referrer', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    AnalyticsEvent.distinct('sessionId', match)
  ]);
  const count = async (eventType) => AnalyticsEvent.countDocuments({ ...match, eventType });
  const [pageViews, bookingStarted, bookingSubmitted, whatsappClicks, phoneClicks, portfolioViews, serviceViews, bookingPageViews] = await Promise.all([count('page_view'), count('booking_started'), count('booking_submitted'), count('whatsapp_click'), count('phone_click'), count('portfolio_view'), count('service_view'), AnalyticsEvent.countDocuments({ ...match, eventType: 'page_view', page: { $in: ['/booking.html', '/booking'] } })]);
  const uniqueSessions = sessions.filter(Boolean).length;
  const returningSessions = await AnalyticsEvent.aggregate([{ $match: match }, { $group: { _id: '$sessionId', visits: { $sum: 1 } } }, { $match: { visits: { $gt: 1 } } }, { $count: 'count' }]);
  const serviceIds = services.map((item) => item._id).filter((id) => mongoose.isValidObjectId(id));
  const serviceNames = await require('../models').Service.find({ _id: { $in: serviceIds } }).select('name').lean();
  const names = new Map(serviceNames.map((service) => [String(service._id), service.name]));
  return { totals: { visitors: uniqueSessions, newVisitors: Math.max(0, uniqueSessions - (returningSessions[0]?.count || 0)), returningVisitors: returningSessions[0]?.count || 0, pageViews, bookingPageViews, bookingStarted, bookingSubmitted, whatsappClicks, phoneClicks, portfolioViews, serviceViews }, pages: pages.map((item) => ({ page: item._id || 'Unknown', views: item.views })), servicesViewed: services.map((item) => ({ service: names.get(String(item._id)) || 'Unknown service', views: item.views })), devices: devices.map((item) => ({ device: item._id || 'other', count: item.count })), sources: sources.map((item) => ({ source: item._id || 'Direct', count: item.count })), events };
}

async function businessAnalytics(range) {
  const match = eventMatch(range);
  const [totalClients, totalBookings, pending, confirmed, completed, cancelled, totalProjects, activeProjects, completedProjects, totalGalleries, activeGalleries, completedGalleries, totalMedia, selectedGalleries, revisions, approvedMedia, bookingTrends, requestedServices, projectStatuses] = await Promise.all([
    Client.countDocuments(), Booking.countDocuments(match), Booking.countDocuments({ ...match, status: 'pending' }), Booking.countDocuments({ ...match, status: 'confirmed' }), Booking.countDocuments({ ...match, status: 'completed' }), Booking.countDocuments({ ...match, status: 'cancelled' }), Project.countDocuments(), Project.countDocuments({ status: { $nin: ['completed', 'delivered', 'cancelled'] } }), Project.countDocuments({ status: { $in: ['completed', 'delivered'] } }), Gallery.countDocuments(), Gallery.countDocuments({ galleryStatus: { $in: ['active', 'ready'] } }), Gallery.countDocuments({ galleryStatus: 'completed' }), GalleryItem.countDocuments(), Gallery.countDocuments({ selectionStatus: { $in: ['submitted', 'under-review', 'approved', 'completed'] } }), RevisionRequest.countDocuments(match), GalleryItem.countDocuments({ approved: true }), Booking.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: studioTimeZone } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]), Booking.aggregate([{ $match: match }, { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'service' } }, { $unwind: '$service' }, { $group: { _id: '$service.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }]), Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
  ]);
  const newClients = await Client.countDocuments({ createdAt: match.createdAt });
  const returningClients = await Booking.aggregate([{ $match: match }, { $group: { _id: '$client', bookings: { $sum: 1 } } }, { $match: { bookings: { $gt: 1 } } }, { $count: 'count' }]);
  return { totals: { totalClients, newClients, returningClients: returningClients[0]?.count || 0, clientsWithBookings: await Booking.distinct('client', match).then((items) => items.length), totalBookings, pendingBookings: pending, confirmedBookings: confirmed, completedBookings: completed, cancelledBookings: cancelled, totalProjects, activeProjects, completedProjects, totalGalleries, activeGalleries, completedGalleries, totalMedia, galleriesWithSelections: selectedGalleries, galleriesWithRevisions: revisions, galleriesApproved: approvedMedia }, bookingTrends, requestedServices: requestedServices.map((item) => ({ service: item._id, bookings: item.count })), projectStatuses: projectStatuses.map((item) => ({ status: item._id, count: item.count })) };
}

async function overview(req, res, next) { try { const range = getRange(req.query); const [website, business] = await Promise.all([websiteAnalytics(range), businessAnalytics(range)]); res.json({ success: true, data: { range: { start: range.start, end: range.end, label: range.label }, website, business } }); } catch (error) { next(error); } }

async function collectEvent(req, res, next) {
  const allowedPages = /^\/[a-zA-Z0-9_/?=&.-]{0,180}$/;
  const eventType = clean(req.body.eventType, 30);
  if (!eventTypes.has(eventType)) return res.status(400).json({ success: false, message: 'Analytics event type is invalid.' });
  const sessionId = clean(req.body.sessionId, 80).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sessionId || sessionId.length < 16) return res.status(400).json({ success: false, message: 'Analytics session is invalid.' });
  const page = clean(req.body.page, 180); if (page && !allowedPages.test(page)) return res.status(400).json({ success: false, message: 'Analytics page is invalid.' });
  try { await AnalyticsEvent.create({ eventType, page, service: mongoose.isValidObjectId(req.body.service) ? req.body.service : undefined, sessionId, deviceType: deviceTypes.has(req.body.deviceType) ? req.body.deviceType : 'other', referrer: clean(req.body.referrer, 180) }); res.status(202).json({ success: true }); } catch (error) { next(error); }
}

module.exports = { overview, collectEvent };
