const fs = require('fs');

const indexContent = `const users = require('./handlers/users');
const bots = require('./handlers/bots');
const portfolios = require('./handlers/portfolios');
const stripe = require('./handlers/stripe');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  let path = event.rawPath || event.path || '';
  path = path.replace(/^\\/[^\\/]+/, '');
  if (!path.startsWith('/')) path = '/' + path;
  
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  
  console.log('Path:', path, 'Method:', method);
  
  try {
    if (path === '/api/user' && method === 'GET') return await users.getProfile(event);
    if (path === '/api/user' && method === 'PUT') return await users.updateProfile(event);
    
    if (path === '/api/bots' && method === 'GET') return await bots.getBots(event);
    if (path === '/api/bots/subscriptions' && method === 'GET') return await bots.getUserBotSubscriptions(event);
    if (path === '/api/bots/subscribe' && method === 'POST') return await bots.subscribeToBot(event);
    if (path === '/api/bots/unsubscribe' && method === 'POST') return await bots.unsubscribeFromBot(event);
    
    if (path === '/api/portfolios' && method === 'GET') return await portfolios.getPortfolios(event);
    if (path.startsWith('/api/portfolios/') && path.endsWith('/positions') && method === 'GET') {
      event.pathParameters = { portfolioId: path.split('/')[3] };
      return await portfolios.getPositions(event);
    }
    if (path.startsWith('/api/portfolios/') && path.endsWith('/history') && method === 'GET') {
      event.pathParameters = { portfolioId: path.split('/')[3] };
      return await portfolios.getTradeHistory(event);
    }
    
    if (path === '/api/stripe/checkout' && method === 'POST') return await stripe.createCheckoutSession(event);
    if (path === '/api/stripe/portal' && method === 'POST') return await stripe.createPortalSession(event);
    if (path === '/api/payments' && method === 'GET') return await stripe.getPaymentHistory(event);
    if (path === '/api/stripe/webhook' && method === 'POST') return await stripe.handleWebhook(event);
    
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Not found', path: path }) };
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};`;

fs.writeFileSync('src/index.js', indexContent);
console.log('index.js written');