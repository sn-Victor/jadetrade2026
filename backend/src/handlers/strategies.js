const { query } = require('../db');

// Get all strategies
async function getStrategies(event, userId, userTier) {
  const result = await query('SELECT * FROM strategies WHERE is_active = true ORDER BY total_trades DESC');
  
  // Get user subscriptions
  const subs = await query('SELECT strategy_id FROM strategy_subscriptions WHERE user_id = $1 AND is_active = true', [userId]);
  const subscribedIds = subs.rows.map(s => s.strategy_id);
  
  const strategies = result.rows.map(s => ({
    ...s,
    isSubscribed: subscribedIds.includes(s.id),
    isLocked: (s.tier_required === 'pro' && userTier === 'free') || 
              (s.tier_required === 'enterprise' && userTier !== 'enterprise')
  }));
  
  return { statusCode: 200, body: { strategies } };
}

// Subscribe to a strategy
async function subscribeToStrategy(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const { strategyId, autoTrade = false, riskPercent = 1.0 } = body;
  
  if (!strategyId) {
    return { statusCode: 400, body: { error: 'Missing strategyId' } };
  }
  
  // Check if already subscribed
  const existing = await query(
    'SELECT * FROM strategy_subscriptions WHERE user_id = $1 AND strategy_id = $2',
    [userId, strategyId]
  );
  
  if (existing.rows.length > 0) {
    await query(
      'UPDATE strategy_subscriptions SET is_active = true, auto_trade = $1, risk_percent = $2 WHERE user_id = $3 AND strategy_id = $4',
      [autoTrade, riskPercent, userId, strategyId]
    );
  } else {
    await query(
      'INSERT INTO strategy_subscriptions (user_id, strategy_id, auto_trade, risk_percent) VALUES ($1, $2, $3, $4)',
      [userId, strategyId, autoTrade, riskPercent]
    );
  }
  
  return { statusCode: 200, body: { message: 'Subscribed to strategy' } };
}

// Unsubscribe from a strategy
async function unsubscribeFromStrategy(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const { strategyId } = body;
  
  await query('UPDATE strategy_subscriptions SET is_active = false WHERE user_id = $1 AND strategy_id = $2', 
    [userId, strategyId]);
  
  return { statusCode: 200, body: { message: 'Unsubscribed from strategy' } };
}

// Get user's strategy subscriptions
async function getSubscriptions(event, userId) {
  const result = await query(`
    SELECT ss.*, s.name, s.description, s.symbols, s.win_rate, s.avg_profit, s.total_trades
    FROM strategy_subscriptions ss
    JOIN strategies s ON ss.strategy_id = s.id
    WHERE ss.user_id = $1 AND ss.is_active = true
  `, [userId]);
  
  return { statusCode: 200, body: { subscriptions: result.rows } };
}

// TradingView Webhook Handler
async function handleTVWebhook(event) {
  const body = JSON.parse(event.body || '{}');
  const { token, symbol, action, price, stopLoss, takeProfit, message } = body;
  
  if (!token || !symbol || !action) {
    return { statusCode: 400, body: { error: 'Missing required fields' } };
  }
  
  // Find strategy by token
  const stratResult = await query('SELECT * FROM strategies WHERE webhook_token = $1 AND is_active = true', [token]);
  if (stratResult.rows.length === 0) {
    return { statusCode: 401, body: { error: 'Invalid webhook token' } };
  }
  const strategy = stratResult.rows[0];
  
  // Store the signal
  await query(`
    INSERT INTO tv_signals (strategy_id, symbol, action, price, stop_loss, take_profit, message)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [strategy.id, symbol, action, price, stopLoss, takeProfit, message]);
  
  // Get all users subscribed to this strategy with auto_trade enabled
  const subsResult = await query(`
    SELECT ss.*, da.balance FROM strategy_subscriptions ss
    JOIN demo_accounts da ON ss.user_id = da.user_id
    WHERE ss.strategy_id = $1 AND ss.is_active = true AND ss.auto_trade = true
  `, [strategy.id]);
  
  // Execute trades for each subscribed user
  const executions = [];
  for (const sub of subsResult.rows) {
    try {
      const riskAmount = parseFloat(sub.balance) * (parseFloat(sub.risk_percent) / 100);
      const priceValue = price || 0;
      const quantity = priceValue > 0 ? riskAmount / priceValue : 0;
      
      if (quantity > 0 && action !== 'close') {
        // Open position
        const posResult = await query(`
          INSERT INTO positions (user_id, symbol, side, quantity, entry_price, current_price, stop_loss, take_profit, strategy_id, is_demo)
          VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, true) RETURNING id
        `, [sub.user_id, symbol, action === 'buy' ? 'long' : 'short', quantity, priceValue, stopLoss, takeProfit, strategy.id]);
        
        // Deduct balance
        await query('UPDATE demo_accounts SET balance = balance - $1 WHERE user_id = $2', [riskAmount, sub.user_id]);
        
        executions.push({ userId: sub.user_id, positionId: posResult.rows[0].id, action: 'opened' });
      } else if (action === 'close') {
        // Close all positions for this strategy
        const openPos = await query(
          "SELECT * FROM positions WHERE user_id = $1 AND strategy_id = $2 AND status = 'open'", 
          [sub.user_id, strategy.id]
        );
        for (const pos of openPos.rows) {
          const entryValue = parseFloat(pos.quantity) * parseFloat(pos.entry_price);
          const exitValue = parseFloat(pos.quantity) * priceValue;
          let realizedPnl = pos.side === 'long' ? (exitValue - entryValue) : (entryValue - exitValue);
          
          await query("UPDATE positions SET status = 'closed', closed_at = NOW(), close_price = $1, realized_pnl = $2 WHERE id = $3",
            [priceValue, realizedPnl, pos.id]);
          await query('UPDATE demo_accounts SET balance = balance + $1 WHERE user_id = $2', 
            [entryValue + realizedPnl, sub.user_id]);
        }
        executions.push({ userId: sub.user_id, action: 'closed', count: openPos.rows.length });
      }
    } catch (err) {
      console.error('Trade execution error:', err);
    }
  }
  
  // Update strategy stats
  await query('UPDATE strategies SET total_trades = total_trades + 1 WHERE id = $1', [strategy.id]);
  
  // Mark signal as processed
  await query('UPDATE tv_signals SET processed = true WHERE strategy_id = $1 ORDER BY received_at DESC LIMIT 1', [strategy.id]);
  
  return { statusCode: 200, body: { success: true, executions, message: `Signal processed for ${executions.length} users` } };
}

// Get recent signals for a strategy
async function getSignals(event, userId) {
  const strategyId = event.queryStringParameters?.strategyId;
  let result;
  
  if (strategyId) {
    result = await query('SELECT * FROM tv_signals WHERE strategy_id = $1 ORDER BY received_at DESC LIMIT 50', [strategyId]);
  } else {
    // Get signals for all subscribed strategies
    result = await query(`
      SELECT ts.* FROM tv_signals ts
      JOIN strategy_subscriptions ss ON ts.strategy_id = ss.strategy_id
      WHERE ss.user_id = $1 AND ss.is_active = true
      ORDER BY ts.received_at DESC LIMIT 50
    `, [userId]);
  }
  
  return { statusCode: 200, body: { signals: result.rows } };
}

module.exports = { getStrategies, subscribeToStrategy, unsubscribeFromStrategy, getSubscriptions, handleTVWebhook, getSignals };