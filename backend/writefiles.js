const fs = require('fs');

// bots.js
const botsContent = `const { query } = require('../db');
const { getUserFromToken } = require('../auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.getBots = async (event) => {
  try {
    const result = await query('SELECT * FROM trading_bots WHERE is_active = true ORDER BY name');
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.getUserBotSubscriptions = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const result = await query(
      'SELECT ubs.*, tb.name, tb.description, tb.strategy_type, tb.min_tier, tb.monthly_return_avg, tb.win_rate, tb.max_drawdown FROM user_bot_subscriptions ubs JOIN trading_bots tb ON ubs.bot_id = tb.id WHERE ubs.user_id = $1 AND ubs.is_active = true',
      [user.id]
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.subscribeToBot = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const { botId } = JSON.parse(event.body);
    const userResult = await query('SELECT subscription_tier FROM users WHERE id = $1', [user.id]);
    const userTier = userResult.rows[0]?.subscription_tier || 'free';
    const botResult = await query('SELECT min_tier FROM trading_bots WHERE id = $1', [botId]);
    if (botResult.rows.length === 0) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Bot not found' }) };
    }
    const tierOrder = { free: 0, pro: 1, enterprise: 2 };
    if (tierOrder[userTier] < tierOrder[botResult.rows[0].min_tier]) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Upgrade your subscription' }) };
    }
    const result = await query(
      'INSERT INTO user_bot_subscriptions (user_id, bot_id) VALUES ($1, $2) ON CONFLICT (user_id, bot_id) DO UPDATE SET is_active = true, started_at = now() RETURNING *',
      [user.id, botId]
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows[0]) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.unsubscribeFromBot = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const { botId } = JSON.parse(event.body);
    await query('UPDATE user_bot_subscriptions SET is_active = false WHERE user_id = $1 AND bot_id = $2', [user.id, botId]);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};`;

fs.writeFileSync('src/handlers/bots.js', botsContent);
console.log('bots.js written');