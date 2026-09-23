const rolePermissions = {
  superadmin: new Set(['dashboard:view', 'analytics:view', 'website:manage', 'services:manage', 'packages:manage', 'bookings:view', 'bookings:manage', 'clients:view', 'clients:manage', 'staff:view', 'staff:manage', 'projects:view', 'projects:manage', 'projects:assign', 'galleries:view', 'galleries:manage', 'settings:manage', 'payments:view']),
  manager: new Set(['dashboard:view', 'analytics:view', 'website:manage', 'services:manage', 'packages:manage', 'bookings:view', 'bookings:manage', 'clients:view', 'clients:manage', 'staff:view', 'projects:view', 'projects:manage', 'projects:assign', 'galleries:view', 'galleries:manage', 'payments:view']),
  photographer: new Set(['dashboard:view', 'assigned:read', 'assigned:update', 'bookings:view', 'clients:view', 'galleries:view']),
  videographer: new Set(['dashboard:view', 'assigned:read', 'assigned:update', 'bookings:view', 'clients:view', 'galleries:view']),
  editor: new Set(['dashboard:view', 'assigned:read', 'assigned:update', 'bookings:view', 'clients:view', 'galleries:view', 'galleries:manage'])
};

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = rolePermissions[req.user?.role];
    if (!permissions || !permissions.has(permission)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

function getRolePermissions(role) {
  return [...(rolePermissions[role] || [])];
}

module.exports = { requireRole, requirePermission, getRolePermissions, rolePermissions };
