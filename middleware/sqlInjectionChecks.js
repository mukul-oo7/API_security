const url = require('url');
const querystring = require('querystring');

const sqlInjectionMiddleware = (req, res, next) => {
  // List of SQL keywords and characters to check for
  const sqlPatterns = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 
    '--', '/*', '*/', ';', '=', '\'', '"', '`'
  ];

  // Function to check a value for SQL injection patterns
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => 
        value.toUpperCase().includes(pattern)
      );
    }
    return false;
  };

  // Check query parameters
  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);
  for (let key in queryParams) {
    if (checkValue(queryParams[key])) {
      return res.status(403).json({ error: 'Potential SQL injection detected in query parameters' });
    }
  }

  // Check body parameters
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    let bodyParams;
    try {
      bodyParams = querystring.parse(body);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    for (let key in bodyParams) {
      if (checkValue(bodyParams[key])) {
        return res.status(403).json({ error: 'Potential SQL injection detected in body' });
      }
    }

    // If no injection detected, proceed to the next middleware
    next();
  });
};

module.exports = sqlInjectionMiddleware;