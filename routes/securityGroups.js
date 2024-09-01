const express = require('express');
const router = express.Router();
const { SecurityGroup, Rule } = require('../models/securityGroup');
const { ApiEndpoint } = require('../models/apiModel');

// Function to create a security group
async function createSecurityGroup(name, description, apiIds, ruleIds) {
  try {
    const newGroup = new SecurityGroup({
      name,
      description,
      apis: apiIds,
      rules: ruleIds
    });

    await newGroup.save();

    // Update APIs to include this security group
    await ApiEndpoint.updateMany(
      { _id: { $in: apiIds } },
      { $addToSet: { security_groups: newGroup._id } }
    );

    // Update Rules to include these APIs
    await Rule.updateMany(
      { _id: { $in: ruleIds } },
      { $addToSet: { apis: { $each: apiIds } } }
    );

    return newGroup;
  } catch (error) {
    console.error('Error creating security group:', error);
    throw error;
  }
}

// Function to add an API to a security group
async function addApiToSecurityGroup(securityGroupId, apiId) {
  try {
    const [securityGroup, api] = await Promise.all([
      SecurityGroup.findById(securityGroupId),
      ApiEndpoint.findById(apiId)
    ]);

    if (!securityGroup || !api) {
      throw new Error('Security group or API not found');
    }

    securityGroup.apis.addToSet(apiId);
    api.security_groups.addToSet(securityGroup._id);

    // Update all rules in this security group to include this API
    await Rule.updateMany(
      { _id: { $in: securityGroup.rules } },
      { $addToSet: { apis: apiId } }
    );

    await Promise.all([securityGroup.save(), api.save()]);

    return securityGroup;
  } catch (error) {
    console.error('Error adding API to security group:', error);
    throw error;
  }
}

// Function to add a rule to a security group
async function addRuleToSecurityGroup(securityGroupId, ruleId) {
  try {
    const [securityGroup, rule] = await Promise.all([
      SecurityGroup.findById(securityGroupId),
      Rule.findById(ruleId)
    ]);

    if (!securityGroup || !rule) {
      throw new Error('Security group or Rule not found');
    }

    securityGroup.rules.addToSet(ruleId);
    rule.apis.push(...securityGroup.apis);

    await Promise.all([securityGroup.save(), rule.save()]);

    return securityGroup;
  } catch (error) {
    console.error('Error adding rule to security group:', error);
    throw error;
  }
}

// Function to remove an API from a security group
async function removeApiFromSecurityGroup(securityGroupId, apiId) {
  try {
    const [securityGroup, api] = await Promise.all([
      SecurityGroup.findById(securityGroupId),
      ApiEndpoint.findById(apiId)
    ]);

    if (!securityGroup || !api) {
      throw new Error('Security group or API not found');
    }

    securityGroup.apis.pull(apiId);
    api.security_groups.pull(securityGroup.name);

    // Remove this API from all rules in this security group
    await Rule.updateMany(
      { _id: { $in: securityGroup.rules } },
      { $pull: { apis: apiId } }
    );

    await Promise.all([securityGroup.save(), api.save()]);

    return securityGroup;
  } catch (error) {
    console.error('Error removing API from security group:', error);
    throw error;
  }
}

// Function to remove a rule from a security group
async function removeRuleFromSecurityGroup(securityGroupId, ruleId) {
  try {
    const securityGroup = await SecurityGroup.findById(securityGroupId);

    if (!securityGroup) {
      throw new Error('Security group not found');
    }

    securityGroup.rules.pull(ruleId);
    await securityGroup.save();

    return securityGroup;
  } catch (error) {
    console.error('Error removing rule from security group:', error);
    throw error;
  }
}

// GET request to return all security groups with their description and ID
router.get('/securitygroups', async (req, res) => {
  try {
    const securityGroups = await SecurityGroup.find({})
    .populate({
      path: 'rules',
      select: 'name _id'
    }).populate({
      path: 'apis',
      select: '_id path request_methods'
    });

    const apiList = await ApiEndpoint.find({}, 'path request_methods');
    const ruleList = await Rule.find({}, 'name');

    res.status(200).json({
      apiList,
      ruleList,
      securityGroups
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching security groups' });
  }
});

// Route to create a new security group
router.post('/create-group', async (req, res) => {
  try {
    const { name, description, apis, rules } = req.body;
    const newGroup = await createSecurityGroup(name, description, apis, rules);
    res.status(201).json(newGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to add an API to a security group
router.post('/security-group/:groupId/api', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { apiId } = req.body;
    const updatedGroup = await addApiToSecurityGroup(groupId, apiId);
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to add a rule to a security group
router.post('/security-group/:groupId/rule', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { ruleId } = req.body;
    const updatedGroup = await addRuleToSecurityGroup(groupId, ruleId);
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to remove an API from a security group
router.delete('/security-group/:groupId/api/:apiId', async (req, res) => {
  try {
    const { groupId, apiId } = req.params;
    const updatedGroup = await removeApiFromSecurityGroup(groupId, apiId);
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to remove a rule from a security group
router.delete('/security-group/:groupId/rule/:ruleId', async (req, res) => {
  try {
    const { groupId, ruleId } = req.params;
    const updatedGroup = await removeRuleFromSecurityGroup(groupId, ruleId);
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;