const { Notification, User, Project } = require('../models');

async function activeUsersByRoles(roles) {
  return User.find({ active: true, role: { $in: roles } }).select('_id').lean();
}

async function createNotifications({ recipients, type, title, message, relatedType, relatedId, eventKey }) {
  const uniqueRecipients = [...new Set(recipients.map((recipient) => String(recipient)).filter(Boolean))];
  if (!uniqueRecipients.length) return [];
  const documents = uniqueRecipients.map((recipient) => ({ recipient, type, title, message, relatedType: relatedType || '', relatedId: relatedId || null, eventKey: `${eventKey}:${recipient}` }));
  try { return await Notification.insertMany(documents, { ordered: false }); } catch (error) {
    if (error.code === 11000 || error.writeErrors?.some((item) => item.code === 11000)) return [];
    throw error;
  }
}

async function notifyManagers({ type, title, message, relatedType, relatedId, eventKey }) {
  const users = await activeUsersByRoles(['superadmin', 'manager']);
  return createNotifications({ recipients: users.map((user) => user._id), type, title, message, relatedType, relatedId, eventKey });
}

async function notifyProjectStaff(projectId, payload) {
  if (!projectId) return [];
  const project = await Project.findById(projectId).select('assignments assignedStaff').lean();
  if (!project) return [];
  const assigned = (project.assignments || []).map((assignment) => assignment.user).concat(project.assignedStaff || []);
  return createNotifications({ ...payload, recipients: assigned });
}

async function notifyProjectTeamAndManagers(projectId, payload) {
  const managers = await activeUsersByRoles(['superadmin', 'manager']);
  const projectNotifications = await notifyProjectStaff(projectId, payload);
  const managerNotifications = await createNotifications({ ...payload, recipients: managers.map((user) => user._id) });
  return [...projectNotifications, ...managerNotifications];
}

module.exports = { createNotifications, notifyManagers, notifyProjectStaff, notifyProjectTeamAndManagers, activeUsersByRoles };