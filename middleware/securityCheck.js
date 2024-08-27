
const {RATE_LIMIT_WINDOW_MS, REQUEST_LIMIT} = require('../config/env');

const requestTimestamps = [];

const rateLimiter = (req, res, next) => {
  const now = Date.now();
  
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= REQUEST_LIMIT) {
    res.status(429).send('Too many requests. Please try again later.');
    return;
  }

  requestTimestamps.push(now);

  next();
};


const sqlInjectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,           // Detects SQL meta-characters like single quote, comment, etc.
    /(\b(SELECT|UPDATE|DELETE|INSERT|DROP|UNION|ALTER|CREATE|EXEC)\b)/i, // Detects SQL keywords
    /(\bOR\b.+\b=\b)/i,                         // Detects SQL OR expressions
    /(\bAND\b.+\b=\b)/i                         // Detects SQL AND expressions
];

const checkForSQLInjection = (req, res, next) => {
    const inputs = [req.body, req.query, req.params];
    console.log(req.body);
    console.log(req.query);
    console.log(req.params);


    // Iterate through all inputs (body, query, and params)
    for (const input of inputs) {
        if (typeof input === 'object') {
            for (const key in input) {
                const value = input[key];
                if (typeof value === 'string') {
                    for (const pattern of sqlInjectionPatterns) {
                        if (pattern.test(value)) {
                            console.warn(`Potential SQL injection attempt detected: ${value}`);
                            return res.status(400).send('Invalid input detected.');
                        }
                    }
                }
            }
        }
    }

    next();
};

function sqlInjectionDetector(req, res, next) {
  const sqlPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /--|#|\/\*/,
    /exec\s*\(/i,
    /xp_cmdshell/i,
    /information_schema/i,
    /benchmark\s*\(/i,
    /;.*;/,
    /\s*or\s+1\s*=\s*1/i,
    /'\s*or\s*'1'\s*=\s*'1/i,
    /"\s*or\s*"1"\s*=\s*"1/i,
    /'\s*or\s*1\s*=\s*1/i,
    /"\s*or\s*1\s*=\s*1/i,
    /sleep\s*\(/i,
    /waitfor\s+delay/i
  ];

  const checkForSqlInjection = (value) => {
    if (typeof value !== 'string') return false;
    return sqlPatterns.some(pattern => pattern.test(value));
  };

  const checkObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'object') {
        if (checkObject(obj[key])) return true;
      } else if (checkForSqlInjection(obj[key])) {
        return true;
      }
    }
    return false;
  };

  if (
    checkObject(req.params) ||
    checkObject(req.query) ||
    checkObject(req.body)
  ) {
    console.warn(`Potential SQL injection detected from ${req.ip}`);
    return res.status(403).json({ error: 'Potential SQL injection detected' });
  }

  next();
}

// Usage in your Express app
// app.use(sqlInjectionDetector);



module.exports = {
  rateLimiter,
  checkForSQLInjection,
  sqlInjectionDetector
};
