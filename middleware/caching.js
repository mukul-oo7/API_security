const { ApiEndpoint } = require('../models/apiModel');
const NodeCache = require('node-cache');

// Create a new cache instance
const cache = new NodeCache({ stdTTL: 300 }); // Default TTL: 5 minutes

const caching = async (req, res, next) => {
  const path = req.path;
  const method = req.method;
  const apiEndpoint = await ApiEndpoint.findOne({ method, path });

  if (!apiEndpoint || !apiEndpoint.resourse_heavy) {
    return next();
  }

  const cacheKey = generateCacheKey(req);

  // Try to get the cached response
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    console.log("cached request detected");
    return res.status(200).json(cachedResponse);
  }

  console.log("cache missed");

  // If not in cache, modify res.json to cache the response before sending
  const originalJson = res.json;
  res.json = function (body) {
    cache.set(cacheKey, body);
    originalJson.call(this, body);
  };

  next();
};

function generateCacheKey(req) {
  // Generate a unique cache key based on the request
  const { method, path, query, body } = req;
  return `${method}:${path}:${JSON.stringify(query)}:${JSON.stringify(body)}`;
}

module.exports = caching;