const mongoose = require('mongoose');
const { ApiEndpoint } = require('../models/apiModel');
const { SecurityGroup } = require('../models/securityGroup');
const jwtValidation = require('./jwtValidation');
const apiRateLimiting = require('./apiRateLimiting');
const inputValidation = require('./inputValidation');
const xssChecks = require('./xssChecks');
const caching = require('./caching');
const sqlInjectionCheck = require('./sqlInjectionChecks');
const allowListIP = require('./allowListIP');
const apiLogger = require('./apiLogger');

// Create a mapping of rule names to their implementations
const ruleImplementations = {
  jwtValidation,
  apiRateLimiting,
  inputValidation,
  xssChecks,
  caching,
  sqlInjectionCheck,
  allowListIP,
  apiLogger
};

const securityMiddleware = async (req, res, next) => {
  try {
    const apiEndpoint = await ApiEndpoint.findOne({ path: req.originalUrl, request_methods: req.method });

    if (!apiEndpoint || !apiEndpoint.security_groups) {
      console.log('No security groups found for this endpoint');
      return next();
    }

    const securityGroups = await SecurityGroup.find({
      name: { $in: apiEndpoint.security_groups }
    }).populate('rules');

    console.log(securityGroups);

    const uniqueRules = new Set();
    securityGroups.forEach(group => {
      group.rules.forEach(rule => {
        uniqueRules.add(rule.implementation);
      });
    });

    console.log(uniqueRules);

    for (const ruleName of uniqueRules) {
      if (ruleImplementations[ruleName]) {
        try {
          await ruleImplementations[ruleName](req, res, () => {});
          console.log(`${ruleImplementations[ruleName]} applied`)
        } catch (error) {
          console.error(`Error executing rule ${ruleName}:`, error);
        }
      } else {
        console.warn(`Implementation for rule ${ruleName} not found`);
        console.warn();
      }
    }

    next();
  } catch (error) {
    console.error('Error in security middleware:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = securityMiddleware;