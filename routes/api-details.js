const express = require('express');
const router = express.Router();
const { ApiCall, ApiEndpoint } = require('../models/apiModel');
const mongoose = require('mongoose');
const { SecurityGroup } = require('../models/securityGroup');

// Helper function to get date 24 hours ago
const get24HoursAgo = () => {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date;
};

async function getApiUsagePerMinute(apiId) {
  const twentyFourHoursAgo = get24HoursAgo();
  
  return await ApiCall.aggregate([
    {
      $match: { 
        endpoint: new mongoose.Types.ObjectId(apiId),
        timestamp: { $gte: twentyFourHoursAgo } 
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$timestamp" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { 
      $project: { 
        timestamp: "$_id", 
        count: 1, 
        _id: 0 
      } 
    }
  ]);
}


// 2. Error Rate Over Time
async function getErrorRateOverTime(apiId) {
  const twentyFourHoursAgo = get24HoursAgo();
  return await ApiCall.aggregate([
    { $match: { 
      endpoint: new mongoose.Types.ObjectId(apiId),
      timestamp: { $gte: twentyFourHoursAgo } 
    }},
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$timestamp" } },
        errorCount: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
        totalCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        timestamp: "$_id",
        errorRate: { $multiply: [{ $divide: ["$errorCount", "$totalCount"] }, 100] },
        _id: 0
      }
    }
  ]);
}

// 3. Average Response Time Over Time
async function getAvgResponseTimeOverTime(apiId) {
  const twentyFourHoursAgo = get24HoursAgo();
  return await ApiCall.aggregate([
    { $match: { 
      endpoint: new mongoose.Types.ObjectId(apiId),
      timestamp: { $gte: twentyFourHoursAgo } 
    }},
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } },
        avgResponseTime: { $avg: "$responseTime" }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { timestamp: "$_id", avgResponseTime: 1, _id: 0 } }
  ]);
}

// 4. Response Code Breakdown
async function getResponseCodeBreakdown(apiId) {
  return await ApiCall.aggregate([
    { $match: { endpoint: new mongoose.Types.ObjectId(apiId) } },
    {
      $group: {
        _id: "$statusCode",
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$count" },
        statusCodes: { $push: { statusCode: "$_id", count: "$count" } }
      }
    },
    {
      $project: {
        _id: 0,
        statusCodes: {
          $map: {
            input: "$statusCodes",
            as: "sc",
            in: {
              statusCode: "$$sc.statusCode",
              count: "$$sc.count",
              percentage: {
                $multiply: [{ $divide: ["$$sc.count", "$total"] }, 100]
              }
            }
          }
        }
      }
    }
  ]);
}

async function getApiDetails(apiId) {
  try {
    // Fetch the API endpoint details
    const apiEndpoint = await ApiEndpoint.findById(apiId);
    if (!apiEndpoint) {
      throw new Error('API endpoint not found');
    }

    // Fetch API calls for this endpoint
    const apiCalls = await ApiCall.find({ endpoint: apiId });

    // Calculate average response time
    const totalResponseTime = apiCalls.reduce((sum, call) => sum + (call.responseTime || 0), 0);
    const avgResponseTime = apiCalls.length > 0 ? totalResponseTime / apiCalls.length : 0;

    // Calculate error rate
    const errorCalls = apiCalls.filter(call => call.error);
    const errorRate = apiCalls.length > 0 ? (errorCalls.length / apiCalls.length) * 100 : 0;

    // Calculate total number of hits
    const totalHits = apiCalls.length;

    return {
      apiName: apiEndpoint.path.split('/').pop(), // Assuming the last part of the path is the API name
      version: apiEndpoint.version,
      baseUrl: apiEndpoint.base_url,
      description: apiEndpoint.description,
      queryParameters: apiEndpoint.query_parameters,
      requestMethod: apiEndpoint.request_methods,
      requestHeader: apiEndpoint.request_header,
      requestBody: apiEndpoint.request_body,
      responseStructure: apiEndpoint.response_structure,
      averageResponseTime: avgResponseTime.toFixed(2) + ' ms',
      rateLimit: apiEndpoint.rate_limit_pm,
      numberOfHits: totalHits,
      errorRate: errorRate.toFixed(2) + '%',
      lastUpdated: apiEndpoint.last_updated,
      releaseDate: apiEndpoint.release_date,
      sensitiveDataIndicator: apiEndpoint.sensitive_data.length > 0,
      sensitiveData: apiEndpoint.sensitive_data,
      protectionAgainst: apiEndpoint.protection_against,
      requestMethods: apiEndpoint.request_methods,
      securityGroup: apiEndpoint.security_groups,
      allowSecuredIpOnly: apiEndpoint.allow_secured_ip_only,
      whiteList: apiEndpoint.whitelist,
      blackList: apiEndpoint.blacklist,
    };
  } catch (error) {
    console.error('Error fetching API details:', error);
    throw error;
  }
}

// Route to get stats for a specific API
router.get('/api-stats', async (req, res) => {
  try {
    const apiId = req.query.apiId;

    const apiEd = await ApiEndpoint.findById(apiId);

    // Validate apiId
    if (!mongoose.Types.ObjectId.isValid(apiId) && !apiEd) {
      return res.status(400).json({ error: 'Invalid API ID' });
    }

    const [apiDetails, apiUsage, errorRate, avgResponseTime, responseCodeBreakdown] = await Promise.all([
      getApiDetails(apiId),
      getApiUsagePerMinute(apiId),
      getErrorRateOverTime(apiId),
      getAvgResponseTimeOverTime(apiId),
      getResponseCodeBreakdown(apiId)
    ]);

    res.json({
      apiDetails,
      apiUsage,
      errorRate,
      avgResponseTime,
      responseCodeBreakdown: responseCodeBreakdown[0]?.statusCodes || []
    });
  } catch (error) {
    console.error('Error fetching API stats:', error);
    res.status(500).json({ error: 'An error occurred while fetching API stats' });
  }
});


// Add to whitelist
router.post('/api-endpoint/:id/whitelist', async (req, res) => {
  try {
    const { id } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    const apiEndpoint = await ApiEndpoint.findById(id);
    if (!apiEndpoint) {
      return res.status(404).json({ error: 'API Endpoint not found' });
    }

    if (apiEndpoint.whitelist.includes(ip)) {
      return res.status(400).json({ error: 'IP already in whitelist' });
    }

    apiEndpoint.whitelist.push(ip);
    await apiEndpoint.save();

    res.status(200).json({ message: 'IP added to whitelist', whitelist: apiEndpoint.whitelist });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Remove from whitelist
router.delete('/api-endpoint/:id/whitelist', async (req, res) => {
  try {
    const { id } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    const apiEndpoint = await ApiEndpoint.findById(id);
    if (!apiEndpoint) {
      return res.status(404).json({ error: 'API Endpoint not found' });
    }

    const index = apiEndpoint.whitelist.indexOf(ip);
    if (index === -1) {
      return res.status(400).json({ error: 'IP not found in whitelist' });
    }

    apiEndpoint.whitelist.splice(index, 1);
    await apiEndpoint.save();

    res.status(200).json({ message: 'IP removed from whitelist', whitelist: apiEndpoint.whitelist });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Add to blacklist
router.post('/api-endpoint/:id/blacklist', async (req, res) => {
  try {
    const { id } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    const apiEndpoint = await ApiEndpoint.findById(id);
    if (!apiEndpoint) {
      return res.status(404).json({ error: 'API Endpoint not found' });
    }

    if (apiEndpoint.blacklist.includes(ip)) {
      return res.status(400).json({ error: 'IP already in blacklist' });
    }

    apiEndpoint.blacklist.push(ip);
    await apiEndpoint.save();

    res.status(200).json({ message: 'IP added to blacklist', blacklist: apiEndpoint.blacklist });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Remove from blacklist
router.delete('/api-endpoint/:id/blacklist', async (req, res) => {
  try {
    const { id } = req.params;
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    const apiEndpoint = await ApiEndpoint.findById(id);
    if (!apiEndpoint) {
      return res.status(404).json({ error: 'API Endpoint not found' });
    }

    const index = apiEndpoint.blacklist.indexOf(ip);
    if (index === -1) {
      return res.status(400).json({ error: 'IP not found in blacklist' });
    }

    apiEndpoint.blacklist.splice(index, 1);
    await apiEndpoint.save();

    res.status(200).json({ message: 'IP removed from blacklist', blacklist: apiEndpoint.blacklist });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


module.exports = router;