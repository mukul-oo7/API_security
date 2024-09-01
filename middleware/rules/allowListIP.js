// allowListIP.js
const { ApiEndpoint } = require('../../models/apiModel');

// Middleware to handle IP whitelisting and blacklisting
const allowListIP = async (req, res, next) => {
  try {
    const apiEndpoint = await ApiEndpoint.findOne({ path: req.originalUrl, request_methods: req.method });

    if (!apiEndpoint) {
      // If no matching endpoint is found, allow the request to proceed
      return next();
    }

    const clientIp = req.ip; // Get the client's IP address
    const ipv4ClientIp = clientIp.includes(':') ? clientIp.split(':').pop() : clientIp;
    console.log(ipv4ClientIp);

    if (apiEndpoint.allow_secured_ip_only) {
      const isWhitelisted = apiEndpoint.whitelist.includes(ipv4ClientIp);
      const isBlacklisted = apiEndpoint.blacklist.includes(ipv4ClientIp);

      if (isBlacklisted) {
        return res.status(403).json({ message: 'Access denied: IP is blacklisted.' });
      }

      if (!isWhitelisted) {
        return res.status(403).json({ message: 'Access denied: IP is not whitelisted.' });
      }
    } else {
      // If `allow_secured_ip_only` is false, just block if blacklisted
      if (apiEndpoint.blacklist.includes(ipv4ClientIp)) {
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
