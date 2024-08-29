const { ApiEndpoint, ApiCall } = require('../models/apiModel');

const logRegisteredApiCall = async (req, res, next) => {
  const startTime = Date.now();
  const fullPath = `${req.baseUrl}${req.path}`;

  res.on('finish', async () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // console.log(`${req.baseUrl}, ${req.path}`);

    // Check if the API endpoint is registered
    let registeredEndpoint = await ApiEndpoint.findOne({ path: fullPath });

    if (!registeredEndpoint) {
      // Create a new endpoint if it's not registered
      const newApiEndpoint = new ApiEndpoint({
        path: fullPath,
        description: 'Auto-generated endpoint',
        request_methods: [req.method],
        base_url: `${req.protocol}://${req.get('host')}/`,
      });

      try {
        registeredEndpoint = await newApiEndpoint.save();
        console.log(`New API endpoint registered: ${fullPath}`);
      } catch (error) {
        console.error(`Error registering new API endpoint: ${error.message}`);
      }
    }

    const apiCall = new ApiCall({
      endpoint: fullPath,
      responseTime,
      statusCode: res.statusCode,
      error: res.statusCode >= 400,
      errorMessage: res.statusCode >= 400 ? res.statusMessage : null
    });

    try {
      await apiCall.save();

      // Update hitsByStatusCode in ApiEndpoint
      await ApiEndpoint.findOneAndUpdate(
        { path: fullPath },
        { 
          $inc: { [`hitsByStatusCode.${res.statusCode}`]: 1 },
          $set: { last_updated: new Date() }
        }
      );
    } catch (error) {
      console.error(`Error logging API call: ${error.message}`);
    }
  });

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
  logRegisteredApiCall
}