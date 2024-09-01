const mongoose = require('mongoose');
const { ApiEndpoint } = require('../models/apiModel');
const { SecurityGroup } = require('../models/securityGroup');

const jwtValidation = require('./rules/jwtValidation');
const apiRateLimiting = require('./rules/apiRateLimiting');
const inputValidation = require('./rules/inputValidation');
const xssChecks = require('./rules/xssChecks');
const caching = require('./rules/caching');
const sqlInjectionCheck = require('./rules/sqlInjectionChecks');
const allowListIP = require('./rules/allowListIP');
const {apiLogger} = require('./rules/apiLogger');

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
    if (!apiEndpoint) {
      return next();
    }

    // Find all security groups that include this API
    const securityGroups = await SecurityGroup.find({
      apis: apiEndpoint._id
    }).populate({
      path: 'rules',
      model: 'rules'
    });

    // Collect unique rules
    const uniqueRules = new Set();
    securityGroups.forEach(group => {
      group.rules.forEach(rule => {
        if (rule && rule.implementation) {
          uniqueRules.add(rule.implementation);
        } else {
          console.log('Warning: Invalid rule object encountered');
        }
      });
    });

    // console.log(uniqueRules);

    for (const ruleName of uniqueRules) {
      if (ruleImplementations[ruleName]) {
        try {
          await ruleImplementations[ruleName](req, res, () => {});
          console.log(`executing ${ruleName}`);
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