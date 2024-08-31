const { ApiEndpoint, ApiCall } = require('../models/apiModel');
const mongoose = require('mongoose');

const rateLimitMiddleware = async (req, res, next) => {
  const path = req.path;
  const apiEndpoint = await ApiEndpoint.findOne({ path });

  if (!apiEndpoint) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  if (!apiEndpoint.rate_limit_pm) {
    return next();
  }

  const limitCount = apiEndpoint.rate_limit_pm;
  const timeFrame = 60 * 1000; // 1 minute in milliseconds

  const now = new Date();
  const windowStart = new Date(now.getTime() - timeFrame);

  const callCount = await ApiCall.countDocuments({
    endpoint: apiEndpoint._id,
    timestamp: { $gte: windowStart }
  });

  if (callCount >= limitCount) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  // Create a new API call record
  await ApiCall.create({
    endpoint: apiEndpoint._id,
    timestamp: now
  });

  next();
};

module.exports = rateLimitMiddleware;