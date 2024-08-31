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
        let endpoint = await ApiEndpoint.findOne({ path: fullPath, request_methods: method });

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

module.exports = apiLoggerMiddleware;



// const { ApiEndpoint, ApiCall } = require('../models/apiModel');
// const mongoose = require('mongoose');

// const ApiCall = mongoose.model('ApiCall');
// const ApiEndpoint = mongoose.model('ApiEndpoint');

// const apiLoggerMiddleware = async (req, res, next) => {
//   const startTime = Date.now();

//   // Capture the original end function
//   const originalEnd = res.end;

//   // Override the end function
//   res.end = function (chunk, encoding) {
//     // Calculate response time
//     const responseTime = Date.now() - startTime;

//     // Restore the original end function
//     res.end = originalEnd;

//     // Call the original end function
//     res.end(chunk, encoding);

//     // Log the API call
//     logApiCall(req, res, responseTime);
//   };

//   next();
// };

// async function logApiCall(req, res, responseTime) {
//   const { method, baseUrl, path } = req;
//   const fullPath = baseUrl + path;
//   const statusCode = res.statusCode;

//   try {
//     // Only proceed if the status code is not 404
//     if (statusCode !== 404) {
//       let endpoint = await ApiEndpoint.findOne({
//         path: fullPath,
//         request_methods: method
//       });

//       if (endpoint) {
//         // Update hits by status code for existing endpoint
//         const statusCodeStr = statusCode.toString();
//         endpoint.hitsByStatusCode.set(statusCodeStr, (endpoint.hitsByStatusCode.get(statusCodeStr) || 0) + 1);
        
//         // Add any new response codes
//         if (!endpoint.response_codes.includes(statusCode)) {
//           endpoint.response_codes.push(statusCode);
//         }

//         await endpoint.save();
//       } else {
//         // Create new endpoint
//         endpoint = new ApiEndpoint({
//           path: fullPath,
//           base_url: req.get('host'),
//           request_methods: method,
//           description: 'Automatically created by logger',
//           query_parameters: Object.keys(req.query),
//           path_parameters: req.params ? Object.keys(req.params) : [],
//           request_header: Object.keys(req.headers),
//           request_body: req.body ? Object.keys(req.body) : [],
//           response_structure: res.locals.responseBody ? Object.keys(res.locals.responseBody) : [],
//           version: "v1.0",
//           is_new: true,
//           release_date: new Date(),
//           last_updated: new Date()
//         });

//         await endpoint.save();
//         console.log(`Unregistered API call: ${method} ${fullPath} - ${statusCode}`);
//       }

//       // Log the API call
//       const apiCall = await ApiCall.create({
//         endpoint: endpoint._id,  // Use the ObjectId reference
//         responseTime,
//         statusCode,
//         error: statusCode >= 400,
//         errorMessage: statusCode >= 400 ? res.locals.errorMessage : undefined
//       });

//       console.log(`Logged API call: ${method} ${fullPath} - ${statusCode} - ${responseTime}ms`);
//     } else {
//       console.log(`404 Not Found: ${method} ${fullPath}`);
//     }
//   } catch (error) {
//     console.error('Error in API logger middleware:', error);
//   }
// }

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