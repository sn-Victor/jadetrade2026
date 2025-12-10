const users = require('./handlers/users');
const bots = require('./handlers/bots');
const portfolios = require('./handlers/portfolios');
const stripe = require('./handlers/stripe');
const logs = require('./handlers/logs');
const trading = require('./handlers/trading');
const strategies = require('./handlers/strategies');
const exchangeKeys = require('./handlers/exchange-keys');
const { getUserFromToken } = require('./auth');
const { getOrCreateUser } = require('./user-service');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

function response(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  let path = event.rawPath || event.path || '';
  path = path.replace(/^\/[^\/]+/, '');
  if (!path.startsWith('/')) path = '/' + path;

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const body = event.body ? JSON.parse(event.body) : {};
  const queryParams = event.queryStringParameters || {};

  console.log('Path:', path, 'Method:', method);

  try {
    // Public endpoints (no auth)
    if (path === '/api/logs' && method === 'POST') {
      const result = await logs.storeLogs(body);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/prices' && method === 'GET') {
      const result = await trading.getPrices(event);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/tv-webhook' && method === 'POST') {
      const result = await strategies.handleTVWebhook(event);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/stripe/webhook' && method === 'POST') {
      return await stripe.handleWebhook(event);
    }

    // Get user from auth token for protected endpoints
    // Now uses the centralized user service for reliable user resolution
    let userId = null;  // Internal user ID (stable, never changes)
    let userTier = 'free';
    let dbUser = null;
    try {
      const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const cognitoUser = await getUserFromToken(authHeader);
        // Get or create user (handles Cognito pool migrations automatically)
        dbUser = await getOrCreateUser(cognitoUser);
        userId = dbUser.id;  // Use internal ID, not Cognito ID
        userTier = dbUser.subscription_tier || 'free';
      }
    } catch (authErr) {
      console.log('Auth error (may be okay for some endpoints):', authErr.message);
    }

    // Logs (auth optional for GET)
    if (path === '/api/logs' && method === 'GET') {
      const result = await logs.getLogs(queryParams);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/logs' && method === 'DELETE') {
      const result = await logs.clearOldLogs();
      return response(result.statusCode, result.body);
    }

    // User endpoints
    if (path === '/api/user' && method === 'GET') return await users.getProfile(event);
    if (path === '/api/user' && method === 'PUT') return await users.updateProfile(event);

    // Trading endpoints (require auth)
    if (!userId && path.startsWith('/api/trading')) {
      return response(401, { error: 'Authentication required' });
    }
    if (path === '/api/trading/balance' && method === 'GET') {
      const result = await trading.getBalance(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/positions' && method === 'GET') {
      const result = await trading.getPositions(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/positions' && method === 'POST') {
      const result = await trading.openPosition(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/positions/close' && method === 'POST') {
      const result = await trading.closePosition(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/history' && method === 'GET') {
      const result = await trading.getTradeHistory(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/trades' && method === 'GET') {
      const result = await trading.getTrades(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/trading/reset' && method === 'POST') {
      const result = await trading.resetDemoAccount(event, userId);
      return response(result.statusCode, result.body);
    }

    // Strategy endpoints
    if (path === '/api/strategies' && method === 'GET') {
      const result = await strategies.getStrategies(event, userId, userTier);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/strategies/subscribe' && method === 'POST') {
      if (!userId) return response(401, { error: 'Authentication required' });
      const result = await strategies.subscribeToStrategy(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/strategies/unsubscribe' && method === 'POST') {
      if (!userId) return response(401, { error: 'Authentication required' });
      const result = await strategies.unsubscribeFromStrategy(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/strategies/subscriptions' && method === 'GET') {
      if (!userId) return response(401, { error: 'Authentication required' });
      const result = await strategies.getSubscriptions(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/strategies/signals' && method === 'GET') {
      const result = await strategies.getSignals(event, userId);
      return response(result.statusCode, result.body);
    }

    // Bots (legacy, keeping for backward compat)
    if (path === '/api/bots' && method === 'GET') return await bots.getBots(event);
    if (path === '/api/bots/subscriptions' && method === 'GET') return await bots.getUserBotSubscriptions(event);
    if (path === '/api/bots/subscribe' && method === 'POST') return await bots.subscribeToBot(event);
    if (path === '/api/bots/unsubscribe' && method === 'POST') return await bots.unsubscribeFromBot(event);

    // Portfolios
    if (path === '/api/portfolios' && method === 'GET') return await portfolios.getPortfolios(event);
    if (path.startsWith('/api/portfolios/') && path.endsWith('/positions') && method === 'GET') {
      event.pathParameters = { portfolioId: path.split('/')[3] };
      return await portfolios.getPositions(event);
    }
    if (path.startsWith('/api/portfolios/') && path.endsWith('/history') && method === 'GET') {
      event.pathParameters = { portfolioId: path.split('/')[3] };
      return await portfolios.getTradeHistory(event);
    }

    // Stripe
    if (path === '/api/stripe/checkout' && method === 'POST') return await stripe.createCheckoutSession(event);
    if (path === '/api/stripe/portal' && method === 'POST') return await stripe.createPortalSession(event);
    if (path === '/api/payments' && method === 'GET') return await stripe.getPaymentHistory(event);

    // Exchange API Keys
    if (path === '/api/exchange-keys' && method === 'GET') {
      if (!userId) return response(401, { error: 'Authentication required' });
      const result = await exchangeKeys.getExchangeKeys(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path === '/api/exchange-keys' && method === 'POST') {
      if (!userId) return response(401, { error: 'Authentication required' });
      const result = await exchangeKeys.addExchangeKey(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path.match(/^\/api\/exchange-keys\/[^\/]+$/) && method === 'DELETE') {
      if (!userId) return response(401, { error: 'Authentication required' });
      event.pathParameters = { keyId: path.split('/')[3] };
      const result = await exchangeKeys.deleteExchangeKey(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path.match(/^\/api\/exchange-keys\/[^\/]+$/) && method === 'PUT') {
      if (!userId) return response(401, { error: 'Authentication required' });
      event.pathParameters = { keyId: path.split('/')[3] };
      const result = await exchangeKeys.updateExchangeKey(event, userId);
      return response(result.statusCode, result.body);
    }
    if (path.match(/^\/api\/exchange-keys\/[^\/]+\/validate$/) && method === 'POST') {
      if (!userId) return response(401, { error: 'Authentication required' });
      event.pathParameters = { keyId: path.split('/')[3] };
      const result = await exchangeKeys.validateExchangeKey(event, userId);
      return response(result.statusCode, result.body);
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Not found', path }) };
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};