const { ApiEndpoint } = require('../../models/apiModel');  // Adjust the path as needed

const inputValidation = async (req, res, next) => {
  const method = req.method;
  const fullPath = req.originalUrl.split('?')[0];  // Remove query string for matching

  try {
    // Find the registered API endpoint
    const endpoint = await ApiEndpoint.findOne({ path: fullPath, request_methods: method });

    if (!endpoint) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }

    // Validate query parameters
    const missingQueryParams = endpoint.query_parameters.filter(param => !(param in req.query));
    if (missingQueryParams.length > 0) {
      return res.status(400).json({ error: `Missing required query parameters: ${missingQueryParams.join(', ')}` });
    }

    // Validate headers
    const missingHeaders = endpoint.request_header.filter(header => !(header.toLowerCase() in req.headers));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ error: `Missing required headers: ${missingHeaders.join(', ')}` });
    }

    // Validate request body
    if (endpoint.request_body && endpoint.request_body.length > 0) {
      const missingBodyParams = endpoint.request_body.filter(param => !(param in req.body));
      if (missingBodyParams.length > 0) {
        return res.status(400).json({ error: `Missing required body parameters: ${missingBodyParams.join(', ')}` });
      }
    }

    // Validate path parameters
    if (endpoint.path_parameters && endpoint.path_parameters.length > 0) {
      const missingPathParams = endpoint.path_parameters.filter(param => !(param in req.params));
      if (missingPathParams.length > 0) {
        return res.status(400).json({ error: `Missing required path parameters: ${missingPathParams.join(', ')}` });
      }
    }

    // If all validations pass, proceed to the next middleware
    next();
  } catch (error) {
    console.error('Error in API validation middleware:', error);
    res.status(500).json({ error: 'Internal server error during API validation' });
  }
};

module.exports = inputValidation;