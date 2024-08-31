const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const mongoose = require('mongoose');
const connectDb = require('./config/db');
const { apiLoggerMiddleware, requestLogger } = require('./middleware/logger');
const inputValidation = require('./middleware/inputValidation');
const sqlInjectionMiddleware = require('./middleware/sqlInjectionChecks');
const apiRateLimiting = require('./middleware/apiRateLimiting');
const cachingMiddleware = require('./middleware/cacheMiddleware');
const cors = require("cors");

const app = express();

connectDb();

require('./models/apiModel');
require('./models/User');
require('./models/securityGroup');

const TARGET = 'http://localhost:3000';

app.use(cors());

app.use(requestLogger);
app.use('/shield', express.json());
app.use('/shield', require('./routes/auth'));
app.use('/shield', require('./routes/api'));
app.use('/shield', require('./routes/api-details'));
app.use('/shield', require('./routes/securityGroups'));

const proxyMiddleware = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
});

// app.use('/', inputValidation);
// app.use('/', apiRateLimiting);
// app.use('/', cachingMiddleware);
// app.use('/', sqlInjectionMiddleware);
app.use('/', apiLoggerMiddleware);
app.use('/', proxyMiddleware);

const PROXY_PORT = 8080;
app.listen(PROXY_PORT, () => {
  console.log(`Proxy server listening on port ${PROXY_PORT}`);
});