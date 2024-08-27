const express = require('express');
const redis = require('redis');
const { promisify } = require('util');

// Create Redis client
const redisClient = redis.createClient();
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);

// Configuration
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60; // 15 minutes in seconds

const bruteForceProtection = async (req, res, next) => {
  const ip = req.ip;
  const key = `bruteforce:${ip}`;

  try {
    let attempts = await getAsync(key);
    attempts = attempts ? parseInt(attempts) : 0;
    if (attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({error: 'Too many attempts. Please try again later.'});
    }
    await setAsync(key, attempts+1, 'EX', LOCK_TIME);
    res.on('finish', async () => {
      if (res.statusCode === 200) {
        await setAsync(key, 0, 'EX', LOCK_TIME);
      }
    });
    next();
  }
  
  catch (error) {
    console.error('Brute force protection error:', error);
    next(error);
  }
};

module.exports = bruteForceProtection;



