const express = require('express');
const mongoose = require('mongoose');
const { Rule } = require('../models/securityGroup');
const { ApiEndpoint } = require('../models/apiModel');

const router = express.Router();

router.get('/rules', async (req, res) => {
  try {
    const rules = await Rule.find({}).select('name description implementation apis');

    const rulesWithApis = await Promise.all(
      rules.map(async (rule) => {
        const apiDetails = await ApiEndpoint.find({
          _id: { $in: rule.apis },
        }).select('_id request_method path');

        return {
          _id: rule._id,
          name: rule.name,
          description: rule.description,
          triggingFunction: rule.implementation,
          apis: apiDetails,
        };
      })
    );

    res.json(rulesWithApis);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error retrieving rules', error });
  }
});

module.exports = router;
