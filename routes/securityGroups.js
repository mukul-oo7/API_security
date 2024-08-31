const express = require('express');
const router = express.Router();
const { SecurityGroup, Rule } = require('../models/securityGroup');
const { ApiEndpoint } = require('../models/apiModel');

// Function to create a security group
async function createSecurityGroup(name, description, apis, ruleIds) {
  try {
    const newGroup = new SecurityGroup({
      name,
      description,
      apis: [],
      rules: []
    });

    // Add APIs to the group
    for (let apiId of apis) {
      await addApiToSecurityGroup(newGroup, apiId);
    }

    // Add rules to the group
    for (let ruleId of ruleIds) {
      await addRuleToSecurityGroup(newGroup, ruleId);
    }

    await newGroup.save();
    return newGroup;
  } catch (error) {
    console.error('Error creating security group:', error);
    throw error;
  }
}

// Function to add an API to a security group
async function addApiToSecurityGroup(securityGroup, apiId) {
  try {
    const api = await ApiEndpoint.findById(apiId);
    if (!api) {
      throw new Error('API not found');
    }
    api.security_groups.push(securityGroup.name);
    securityGroup.apis.push(api);

    await api.save();
  } catch (error) {
    console.error('Error adding API to security group:', error);
    throw error;
  }
}

// Function to add a rule to a security group
async function addRuleToSecurityGroup(securityGroup, ruleId) {
  try {
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }
    securityGroup.rules.push(rule);
  } catch (error) {
    console.error('Error adding rule to security group:', error);
    throw error;
  }
}

// Function to remove an API from a security group
async function removeApiFromSecurityGroup(securityGroup, apiId) {
  try {
    securityGroup.apis = securityGroup.apis.filter(api => api._id.toString() !== apiId);
    await securityGroup.save();
  } catch (error) {
    console.error('Error removing API from security group:', error);
    throw error;
  }
}

// Function to remove a rule from a security group
async function removeRuleFromSecurityGroup(securityGroup, ruleId) {
  try {
    securityGroup.rules = securityGroup.rules.filter(rule => rule._id.toString() !== ruleId);
    await securityGroup.save();
  } catch (error) {
    console.error('Error removing rule from security group:', error);
    throw error;
  }
}

// GET request to return all security groups with their description and ID
router.get('/securitygroups', async (req, res) => {
  try {
      // Find all security groups, projecting only the _id and description fields
      const securityGroups = await SecurityGroup.find({}, 'description _id name apis rules');
      res.status(200).json(securityGroups);
  } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching security groups' });
  }
});


// Route to create a new security group
router.post('/create-group', async (req, res) => {
  try {
    const { name, description, apis, ruleIds } = req.body;
    const newGroup = await createSecurityGroup(name, description, apis, ruleIds);
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
    const group = await SecurityGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Security group not found' });
    }
    await addApiToSecurityGroup(group, apiId);
    await group.save();
    res.status(200).json(group);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to add a rule to a security group
router.post('/security-group/:groupId/rule', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { ruleId } = req.body;
    const group = await SecurityGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Security group not found' });
    }
    await addRuleToSecurityGroup(group, ruleId);
    await group.save();
    res.status(200).json(group);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to remove an API from a security group
router.delete('/security-group/:groupId/api/:apiId', async (req, res) => {
  try {
    const { groupId, apiId } = req.params;
    const group = await SecurityGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Security group not found' });
    }
    await removeApiFromSecurityGroup(group, apiId);
    res.status(200).json(group);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route to remove a rule from a security group
router.delete('/security-group/:groupId/rule/:ruleId', async (req, res) => {
  try {
    const { groupId, ruleId } = req.params;
    const group = await SecurityGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Security group not found' });
    }
    await removeRuleFromSecurityGroup(group, ruleId);
    res.status(200).json(group);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;