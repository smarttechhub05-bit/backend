const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { getRolePermissions } = require('../middleware/authorization');

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000
};

function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, permissions: getRolePermissions(user.role), profileImage: user.profileImage || '' };
}

async function login(req, res, next) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ success: false, message: 'Authentication is not configured securely.' });
  try {
    const user = await User.findOne({ email }).select('+password');
    const valid = user && user.active && await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie('auth_token', token, cookieOptions);
    res.json({ success: true, message: 'Login successful.', user: safeUser(user) });
  } catch (error) { next(error); }
}

function me(req, res) {
  res.json({ success: true, user: safeUser(req.user) });
}

function logout(req, res) {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true, message: 'Logged out successfully.' });
}

module.exports = { login, me, logout };
