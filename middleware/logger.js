const { ApiEndpoint, ApiCall } = require('../models/apiModel');  // Adjust the path as needed

const apiLoggerMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const method = req.method;
  const fullPath = req.originalUrl;
  const baseUrl = req.get('host');

  // Capture the original end function
  const originalEnd = res.end;

  // Override the end function
  res.end = function (chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Restore original end function
    res.end = originalEnd;

    // Call the original end function
    res.end(chunk, encoding);

    // Perform logging after response has been sent
    (async () => {
      try {
        // Find the API endpoint
        let endpoint = await ApiEndpoint.findOne({
          path: { $regex: new RegExp('^' + fullPath.replace(/\/[^\/]+/g, '/[^/]+')) },
          request_methods: method
        });
      
        if (endpoint) {
          const statusCode = res.statusCode;
          endpoint.hitsByStatusCode.set(statusCode.toString(), (endpoint.hitsByStatusCode.get(statusCode.toString()) || 0) + 1);
          await endpoint.save();
        } else if (res.statusCode < 400) {  // Only create new API for successful responses
          // Create a new API endpoint
          endpoint = new ApiEndpoint({
            path: fullPath,
            base_url: baseUrl,
            request_methods: method,
            description: 'Automatically created by logger',
            query_parameters: Object.keys(req.query),
            path_parameters: req.params ? Object.keys(req.params) : [],
            request_header: Object.keys(req.headers),
            request_body: req.body ? Object.keys(req.body) : [],
            response_structure: res.locals.responseBody ? Object.keys(res.locals.responseBody) : [],
            version: "v1.0",
            is_new: true,
            release_date: new Date(),
            last_updated: new Date()
          });

          console.log("new api created: ", endpoint.path);
          await endpoint.save();
        }

        // Create and save API call log
        if (endpoint) {
          const apiCall = new ApiCall({
            endpoint: endpoint._id,
            responseTime: responseTime,
            statusCode: res.statusCode,
            error: res.statusCode >= 400,
            errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined
          });
          await apiCall.save();
        }
      } catch (error) {
        console.error('Error in API logger middleware:', error);
      }
    })();
  };

  next();
};


const requestLogger = (req, res, next) => {
  const startTime = new Date();
  
  res.on('finish', () => {
    const endTime = new Date();
    const requestTime = endTime - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${requestTime}ms`);
  });

  next();
};

module.exports = {
  requestLogger, 
  apiLoggerMiddleware
};