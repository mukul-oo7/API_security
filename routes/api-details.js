const express = require('express');
const router = express.Router();
const { ApiCall, ApiEndpoint } = require('../models/apiModel');
const mongoose = require('mongoose');

// Helper function to get date 24 hours ago
const get24HoursAgo = () => {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date;
};

// 1. API Usage Over Time
async function getApiUsageOverTime(apiId) {
  const twentyFourHoursAgo = get24HoursAgo();
  return await ApiCall.aggregate([
    { $match: { 
      endpoint: new mongoose.Types.ObjectId(apiId),
      timestamp: { $gte: twentyFourHoursAgo } 
    }},
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { timestamp: "$_id", count: 1, _id: 0 } }
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

// Route to get stats for a specific API
router.get('/api-stats', async (req, res) => {
  try {
    const apiId = req.query.apiId;

    const apiEd = await ApiEndpoint.findById(apiId);

    // Validate apiId
    if (!mongoose.Types.ObjectId.isValid(apiId) && !apiEd) {
      return res.status(400).json({ error: 'Invalid API ID' });
    }

    const [apiUsage, errorRate, avgResponseTime, responseCodeBreakdown] = await Promise.all([
      getApiUsageOverTime(apiId),
      getErrorRateOverTime(apiId),
      getAvgResponseTimeOverTime(apiId),
      getResponseCodeBreakdown(apiId)
    ]);

    res.json({
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

module.exports = router;