const xss = require('xss-clean');

const xssMiddleware = (req, res, next) => {
  req.body = xss(req.body);
  req.query = xss(req.query);
  req.params = xss(req.params);
  
  next();
};

module.exports = xssMiddleware;