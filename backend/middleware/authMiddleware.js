const jwt = require('jsonwebtoken');
const { User } = require('../models');

function getToken(req) {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const header = req.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ success: false, message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('name email role profileImage active');
    if (!user || !user.active) return res.status(401).json({ success: false, message: 'Authentication required.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
}

module.exports = { requireAuth, getToken };
