const mongoose = require('mongoose');
const { Schema } = mongoose;  // Extract Schema from mongoose
const { ApiEndpoint } = require('./apiModel');  // Ensure the correct import name

// Define the Rule schema
const RuleSchema = new Schema({
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
  },
  apis: [{ type: Schema.Types.ObjectId, ref: 'apiendpoints' }]
});

// Define the SecurityGroup schema
const SecurityGroupSchema = new Schema({
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
  apis: [{type: Schema.Types.ObjectId, ref: 'apiendpoints'}],
  rules: [{type: Schema.Types.ObjectId, ref: 'rules'}]
}, { timestamps: true });

const Rule = mongoose.model('rules', RuleSchema);
const SecurityGroup = mongoose.model('securitygroups', SecurityGroupSchema);

module.exports = { 
    Rule, 
    SecurityGroup
};
