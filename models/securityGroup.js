const mongoose = require('mongoose');
const { ApiEndpoint } = require('./apiModel');  // Ensure the correct import name

// Define the Rule schema
const RuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  implementation: {
    type: String,
    required: true,
    trim: true
  }
});

// Define the SecurityGroup schema
const SecurityGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  apis: [ApiEndpoint.schema],  // Use the correctly named schema reference
  rules: [RuleSchema]
}, { timestamps: true });

const Rule = mongoose.model('rules', RuleSchema);
const SecurityGroup = mongoose.model('securitygroups', SecurityGroupSchema);

module.exports = { 
    Rule, 
    SecurityGroup
};
