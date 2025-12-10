/**
 * Local development server for the backend
 * Wraps the Lambda handler in an Express server
 */
require('dotenv').config();

const http = require('http');
const { handler } = require('./src/index');

const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  // Collect body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  req.on('end', async () => {
    // Build Lambda-like event object
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const queryParams = {};
    url.searchParams.forEach((value, key) => { queryParams[key] = value; });

    const event = {
      rawPath: url.pathname,
      path: url.pathname,
      httpMethod: req.method,
      requestContext: {
        http: { method: req.method }
      },
      headers: req.headers,
      queryStringParameters: Object.keys(queryParams).length ? queryParams : null,
      body: body || null
    };

    try {
      const response = await handler(event);
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      
      // Set response headers from Lambda response
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      res.statusCode = response.statusCode || 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(response.body || '');
    } catch (error) {
      console.error('Server error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Backend server running at http://localhost:${PORT}`);
  console.log(`📍 Cognito Region: ${process.env.COGNITO_REGION}`);
  console.log(`📍 Cognito Pool: ${process.env.COGNITO_USER_POOL_ID}`);
  console.log(`📍 Database: ${process.env.RDS_HOST}\n`);
});

