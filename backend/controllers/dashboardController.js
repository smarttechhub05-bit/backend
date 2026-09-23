const { Client, Booking, Service, Project, Gallery } = require('../models');

async function getDashboardStats(req, res, next) {
  try {
    const globalRole = ['superadmin', 'manager'].includes(req.user.role);
    const baseBookingFilter = { status: { $ne: 'cancelled' } };
    const upcomingProjectFilter = { status: { $in: ['scheduled', 'upcoming'] }, shootDate: { $gte: new Date() } };
    const pendingFilter = { status: 'pending' };
    const completedFilter = { status: 'completed' };
    let stats;
    if (globalRole) {
      stats = await Promise.all([
      Client.countDocuments(),
      Booking.countDocuments(),
      Project.countDocuments(upcomingProjectFilter),
      Booking.countDocuments(pendingFilter),
      Booking.countDocuments(completedFilter),
      Service.countDocuments({ active: true }),
      Project.countDocuments(),
      Gallery.countDocuments()
      ]);
    } else {
      const assignedProjects = await Project.find({ status: { $ne: 'cancelled' }, $or: [{ 'assignments.user': req.user._id, 'assignments.assignmentRole': req.user.role }, { assignedStaff: req.user._id }] }).select('_id client').lean();
      const projectIds = assignedProjects.map((project) => project._id);
      const clientIds = assignedProjects.map((project) => project.client);
      const [assignedGalleries] = await Promise.all([
        Gallery.countDocuments({ $or: [{ project: { $in: projectIds } }, { client: { $in: clientIds } }] })
      ]);
      stats = [new Set(clientIds.map((clientId) => String(clientId))).size, 0, assignedProjects.length, 0, 0, 0, assignedProjects.length, assignedGalleries];
    }

    const [totalClients, totalBookings, upcomingShoots, pendingBookings, completedBookings, activeServices, totalProjects, galleryProjects] = stats;
    res.json({ success: true, data: { totalClients, totalBookings, upcomingShoots, pendingBookings, completedBookings, activeServices, totalProjects, galleryProjects, scope: globalRole ? 'global' : 'assigned' } });
  } catch (error) { next(error); }
}

async function getRecentBookings(req, res, next) {
  try {
    const globalRole = ['superadmin', 'manager'].includes(req.user.role);
    if (!globalRole) return res.json({ success: true, data: [] });
    const bookings = await Booking.find().populate([
      { path: 'client', select: 'fullName' },
      { path: 'service', select: 'name' },
      { path: 'package', select: 'name' }
    ]).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: bookings });
  } catch (error) { next(error); }
}

module.exports = { getDashboardStats, getRecentBookings };
