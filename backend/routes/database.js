const express = require('express');
const { getDatabaseState } = require('../config/database');

const router = express.Router();

router.get('/test/database', async (req, res, next) => {
  const database = getDatabaseState();

  if (database.status !== 'connected') {
    return res.status(503).json({
      status: 'unavailable',
      message: 'Database test skipped because MongoDB is not connected.',
      database
    });
  }

  return res.json({
    status: 'ok',
    message: 'MongoDB connection is active.',
    database
  });
});

module.exports = router;
