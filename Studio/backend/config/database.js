const mongoose = require('mongoose');

let databaseState = {
  status: 'not-configured',
  message: 'MONGODB_URI is not configured.',
  databaseName: null
};

async function connectDatabase() {
  const connectionString = process.env.MONGODB_URI;

  if (!connectionString) {
    databaseState = {
      status: 'not-configured',
      message: 'MONGODB_URI is not configured.',
      databaseName: null
    };
    console.warn('MongoDB is not configured. Set MONGODB_URI in .env to enable database features.');
    return databaseState;
  }

  try {
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 5000
    });
    databaseState = {
      status: 'connected',
      message: 'MongoDB connection is active.',
      databaseName: mongoose.connection.name
    };
    console.log(`MongoDB connected to database: ${mongoose.connection.name}`);
  } catch (error) {
    databaseState = {
      status: 'error',
      message: 'MongoDB connection failed. Check the server and MONGODB_URI.',
      databaseName: null
    };
    console.error(`MongoDB connection failed: ${error.message}`);
  }

  return databaseState;
}

function getDatabaseState() {
  return {
    ...databaseState,
    readyState: mongoose.connection.readyState
  };
}

module.exports = { connectDatabase, getDatabaseState };
