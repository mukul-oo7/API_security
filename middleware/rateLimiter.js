const express = require('express');
const redis = require('redis');
const { promisify } = require('util');

// Create Redis client
const redisClient = redis.createClient();
const incrAsync = promisify(redisClient.incr).bind(redisClient);
const expireAsync = promisify(redisClient.expire).bind(redisClient);

// Configuration
const WINDOW_SIZE_IN_SECONDS = 60;
const RATE_LIMITS = {
  // role: { endpoint: limit }
  default: { default: 100 },
  user: { 
    default: 200,
    '/api/sensitive': 50
  },
  admin: { 
    default: 1000,
    '/api/sensitive': 200
  }
};

const RESOURCE_SENSITIVITY = {
  '/api/public': 1,
  '/api/user': 2,
  '/api/sensitive': 3
};

const dynamicRateLimiter = async (req, res, next) => {
  const userId = req.user ? req.user.id : 'anonymous';
  const userRole = req.user ? req.user.role : 'default';
  const endpoint = req.path;
  const sensitivity = RESOURCE_SENSITIVITY[endpoint] || 1;

  const key = `ratelimit:${userId}:${endpoint}`;

  try {

    const roleLimit = RATE_LIMITS[userRole] || RATE_LIMITS.default;
    let limit = roleLimit[endpoint] || roleLimit.default;
    limit = Math.floor(limit / sensitivity);
    const count = await incrAsync(key);

    if (count === 1) {
      await expireAsync(key, WINDOW_SIZE_IN_SECONDS);
    }

    if (count > limit) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: WINDOW_SIZE_IN_SECONDS
      });
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    next(error);
  }
};

module.exports = dynamicRateLimiter;