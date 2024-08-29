const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApiEndpointSchema = new Schema({
  path: { type: String, required: true },
  description: { type: String },
  query_parameters: [{ type: String }],
  path_parameters: [{ type: String }],
  request_header: [{type: String}],
  request_body: { type: Schema.Types.Mixed },
  response_structure: { type: Schema.Types.Mixed },
  allow_secured_ip_only: {type: Boolean, default:false }, 
  whitelist: [{ type: String }],
  blacklist: [{ type: String }],
  sensitive_data: [{ type: String }],
  resourse_heavy: { type: Boolean, default: false },
  version: { type: String, default: "v 1.0" }, 
  is_new: {type: Boolean, default: true}, 
  base_url: { type: String, required: true },
  authentication_type: { type: String },  
  rate_limit: { type: String },  
  request_methods: { type: String },
  response_codes: [{ type: Number }],  
  response_time: { type: Number },
  release_date: { type: Date, default: Date.now },
  last_updated: { type: Date, default: Date.now },
  protection_against: [{ type: String }],
  hitsByStatusCode: {
    type: Map,
    of: Number,
    default: {}
  }
});


const apiCallSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  endpoint: String,
  responseTime: Number,
  statusCode: Number,
  error: { type: Boolean, default: false },
  errorMessage: String
});

const ApiCall = mongoose.model('ApiCall', apiCallSchema);
const ApiEndpoint = mongoose.model('ApiEndpoint', ApiEndpointSchema);

module.exports = {
  ApiCall,
  ApiEndpoint,
};