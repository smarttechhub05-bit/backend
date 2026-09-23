const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

function hasStrongPassword(password) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z\d]/.test(password);
}

function setupSecretMatches(request) {
  const configuredSecret = process.env.ADMIN_SETUP_SECRET;
  const authorization = String(request.get('authorization') || '');
  const providedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!configuredSecret || !providedSecret) return false;
  const configured = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  return configured.length === provided.length && crypto.timingSafeEqual(configured, provided);
}

async function setupAdmin(req, res, next) {
  if (!setupSecretMatches(req)) return res.status(401).json({ success: false, message: 'Invalid setup credentials.' });
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'A valid email is required.' });
  if (!hasStrongPassword(password)) return res.status(400).json({ success: false, message: 'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.' });
  try {
    if (await User.exists({ role: 'superadmin' })) return res.status(409).json({ success: false, message: 'An administrator already exists.' });
    if (await User.exists({ email })) return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'superadmin', active: true });
    return res.status(201).json({ success: true, message: 'Administrator created successfully.', user: safeUser(user) });
  } catch (error) { return next(error); }
}

function me(req, res) {
  res.json({ success: true, user: safeUser(req.user) });
}

function logout(req, res) {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true, message: 'Logged out successfully.' });
}

module.exports = { login, setupAdmin, me, logout };
