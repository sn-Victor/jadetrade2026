const { query } = require('../db');
const { getUserFromToken } = require('../auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.getPortfolios = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const result = await query('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at', [user.id]);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.getPositions = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const portfolioId = event.pathParameters?.portfolioId;
    const portfolioCheck = await query('SELECT id FROM portfolios WHERE id = $1 AND user_id = $2', [portfolioId, user.id]);
    if (portfolioCheck.rows.length === 0) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Portfolio not found' }) };
    }
    const result = await query(
      'SELECT p.*, tb.name as bot_name FROM positions p LEFT JOIN trading_bots tb ON p.bot_id = tb.id WHERE p.portfolio_id = $1 ORDER BY p.opened_at DESC',
      [portfolioId]
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.getTradeHistory = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const portfolioId = event.pathParameters?.portfolioId;
    const portfolioCheck = await query('SELECT id FROM portfolios WHERE id = $1 AND user_id = $2', [portfolioId, user.id]);
    if (portfolioCheck.rows.length === 0) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Portfolio not found' }) };
    }
    const result = await query(
      'SELECT th.*, tb.name as bot_name FROM trade_history th LEFT JOIN trading_bots tb ON th.bot_id = tb.id WHERE th.portfolio_id = $1 ORDER BY th.closed_at DESC LIMIT 100',
      [portfolioId]
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};