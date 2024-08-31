const express = require('express');
const router = express.Router();
const { ApiEndpoint, ApiCall } = require('../models/apiModel');
const { SecurityGroup } = require('../models/securityGroup');
const authMiddleware = require('../middleware/auth');

// async function getApiEndpoints() {
//   try {
//     // Fetch all API endpoints from the database
//     const apiEndpoints = await ApiEndpoint.find({}, {
//       base_url: 1,
//       path: 1,
//       version: 1,
//       request_methods: 1
//     });

//     // Create a Set to store unique API identifiers
//     const uniqueApis = new Set();

//     // Filter and format the API endpoints
//     const formattedEndpoints = apiEndpoints.reduce((acc, endpoint) => {
//       const apiIdentifier = `${endpoint.base_url}${endpoint.path}`;
      
//       if (!uniqueApis.has(apiIdentifier)) {
//         uniqueApis.add(apiIdentifier);
//         acc.push({
//           base_url: endpoint.base_url,
//           path: endpoint.path,
//           version: endpoint.version,
//           request_methods: endpoint.request_methods
//         });
//       }
      
//       return acc;
//     }, []);

//     return formattedEndpoints;
//   } catch (error) {
//     console.error('Error fetching API endpoints:', error);
//     throw error;
//   }
// }

async function getStatusCodeReport() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: twentyFourHoursAgo }
        }
      },
      {
        $group: {
          _id: "$statusCode",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          statusCode: "$_id",
          count: 1
        }
      },
      {
        $sort: { statusCode: 1 }
      }
    ];
    
    const result = await ApiCall.aggregate(pipeline);
    
    // Transform the result into a more suitable format for a pie chart
    const formattedResult = result.reduce((acc, item) => {
      acc[item.statusCode] = item.count;
      return acc;
    }, {});
    
    return formattedResult;
  } catch (error) {
    console.error('Error generating status code report:', error);
    throw error;
  }
}

// Function to calculate hit count for an API
async function getHitCount(apiId) {
  return await ApiCall.countDocuments({ endpoint: apiId });
}

// Function to calculate average response time for an API
async function getAvgResponseTime(apiId) {
  const result = await ApiCall.aggregate([
    { $match: { endpoint: apiId } },
    { $group: { _id: null, avgResponseTime: { $avg: "$responseTime" } } }
  ]);
  return result.length > 0 ? result[0].avgResponseTime : 0;
}

router.get('/api-hpm', authMiddleware, async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" },
            minute: { $minute: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1, "_id.hour": -1, "_id.minute": -1 }
      },
      {
        $project: {
          _id: 0,
          timestamp: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
              hour: "$_id.hour",
              minute: "$_id.minute"
            }
          },
          hitsPerMinute: "$count"
        }
      }
    ];

    const result = await ApiCall.aggregate(pipeline);

    res.json(result);
  } catch (error) {
    console.error('Error calculating API hits per minute:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Main route handler
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Get all API endpoints
    const apiEndpoints = await ApiEndpoint.find();

    // Calculate number of registered and new APIs
    const numberOfRegisteredApis = apiEndpoints.length;
    const numberOfNewApis = apiEndpoints.filter(api => api.is_new).length;

    // Get number of security groups
    const numberOfSecurityGroups = await SecurityGroup.countDocuments();

    // Calculate status code report
    // const statusCodeReport = {};
    // apiEndpoints.forEach(api => {
    //   api.hitsByStatusCode.forEach((count, statusCode) => {
    //     statusCodeReport[statusCode] = (statusCodeReport[statusCode] || 0) + count;
    //   });
    // });

    const statusCodeReport = await getStatusCodeReport();

    // Prepare detailed API list
    const apiList = await Promise.all(apiEndpoints.map(async api => ({
      method: api.request_methods,
      apiEndpoint: api.path,
      base_url: api.base_url,
      hit_count: await getHitCount(api._id),
      avg_response_time: await getAvgResponseTime(api._id),
      isNew: api.is_new,
      _id: api._id
    })));

    // Prepare final response
    const response = {
      number_of_registered_apis: numberOfRegisteredApis,
      number_of_new_apis: numberOfNewApis,
      number_of_security_groups: numberOfSecurityGroups,
      status_code_report: statusCodeReport,
      api_list: apiList
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /api-stats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get("/init", async (req, res) => {
  try {
    // Update all documents by setting rate_limit_pm to 20
    const endpoints = await ApiEndpoint.find({}, 'path _id');  	

    return res.status(200).send({endpoints});
  } catch (error) {
    console.error('Error updating rate limit for all endpoints:', error.message);
    
    return res.status(500).send({message: "internal server error"});
  }

});

module.exports = router;