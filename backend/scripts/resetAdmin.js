const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { User } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true });

const prompt = (rl, question) => new Promise((resolve) => rl.question(question, resolve));

async function resetAdmin() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  const database = await connectDatabase();
  if (database.status !== 'connected') throw new Error('MongoDB connection is unavailable.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await prompt(rl, 'Existing admin email: ')).trim().toLowerCase();
    const password = await prompt(rl, 'New admin password: ');
    if (!email || password.length < 8) throw new Error('Email and a password of at least 8 characters are required.');
    const user = await User.findOne({ email }).select('+password');
    if (!user) throw new Error('No account exists with that email. Use npm run create-admin instead.');
    user.password = await bcrypt.hash(password, 12);
    user.role = 'superadmin';
    user.active = true;
    await user.save();
    console.log('Admin password reset successfully.');
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

resetAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});