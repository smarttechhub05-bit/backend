const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { User } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true });

if (process.argv.includes('--help')) {
  console.log('Usage: npm run create-admin');
  console.log('Prompts for a name, email, and password to create one superadmin account.');
  process.exit(0);
}

const prompt = (rl, question) => new Promise((resolve) => rl.question(question, resolve));

async function createAdmin() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  const database = await connectDatabase();
  if (database.status !== 'connected') throw new Error('MongoDB connection is unavailable.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = (await prompt(rl, 'Admin name: ')).trim();
    const email = (await prompt(rl, 'Admin email: ')).trim().toLowerCase();
    const password = await prompt(rl, 'Admin password: ');
    if (!name || !email || password.length < 8) throw new Error('Name, email, and a password of at least 8 characters are required.');
    const existing = await User.findOne({ email });
    if (existing) throw new Error('An account with that email already exists.');
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ name, email, password: hashedPassword, role: 'superadmin', active: true });
    console.log('Super Admin created successfully.');
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
