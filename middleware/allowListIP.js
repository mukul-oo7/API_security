// allowListIP.js
const { ApiEndpoint } = require('../models/apiModel');

// Middleware to handle IP whitelisting and blacklisting
const allowListIP = async (req, res, next) => {
  try {
    const endpointPath = req.route.path; // Or however you get the current endpoint
    const apiEndpoint = await ApiEndpointSchema.findOne({ path: endpointPath });

    if (!apiEndpoint) {
      // If no matching endpoint is found, allow the request to proceed
      return next();
    }

    const clientIp = req.ip; // Get the client's IP address

    if (apiEndpoint.allow_secured_ip_only) {
      const isWhitelisted = apiEndpoint.whitelist.includes(clientIp);
      const isBlacklisted = apiEndpoint.blacklist.includes(clientIp);

      if (isBlacklisted) {
        return res.status(403).json({ message: 'Access denied: IP is blacklisted.' });
      }

      if (!isWhitelisted) {
        return res.status(403).json({ message: 'Access denied: IP is not whitelisted.' });
      }
    } else {
      // If `allow_secured_ip_only` is false, just block if blacklisted
      if (apiEndpoint.blacklist.includes(clientIp)) {
        return res.status(403).json({ message: 'Access denied: IP is blacklisted.' });
      }
    }

    // If passed all checks, proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error in IP middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = allowListIP;
