const { getDatabaseState } = require('../config/database');

function databaseGuard(req, res, next) {
  const database = getDatabaseState();
  if (database.status !== 'connected') {
    return res.status(503).json({
      success: false,
      message: 'Database is unavailable. Please try again later.'
    });
  }
  next();
}

module.exports = databaseGuard;
