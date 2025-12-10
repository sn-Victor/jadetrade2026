const { query } = require('../db');
const https = require('https');

// Hardcoded fallback prices (updated regularly)
const FALLBACK_PRICES = {
  'BTCUSDT': { symbol: 'BTCUSDT', price: 97500, change24h: 1250, changePercent24h: 1.3, volume24h: 45000000000, marketCap: 1920000000000, name: 'Bitcoin', image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  'ETHUSDT': { symbol: 'ETHUSDT', price: 3650, change24h: 85, changePercent24h: 2.4, volume24h: 22000000000, marketCap: 440000000000, name: 'Ethereum', image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  'SOLUSDT': { symbol: 'SOLUSDT', price: 225, change24h: 8.5, changePercent24h: 3.9, volume24h: 4500000000, marketCap: 108000000000, name: 'Solana', image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  'BNBUSDT': { symbol: 'BNBUSDT', price: 710, change24h: 15, changePercent24h: 2.2, volume24h: 2100000000, marketCap: 105000000000, name: 'BNB', image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  'XRPUSDT': { symbol: 'XRPUSDT', price: 2.45, change24h: 0.12, changePercent24h: 5.1, volume24h: 8500000000, marketCap: 140000000000, name: 'XRP', image: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  'ADAUSDT': { symbol: 'ADAUSDT', price: 1.12, change24h: 0.08, changePercent24h: 7.7, volume24h: 1800000000, marketCap: 40000000000, name: 'Cardano', image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png' },
  'DOGEUSDT': { symbol: 'DOGEUSDT', price: 0.42, change24h: 0.02, changePercent24h: 5.0, volume24h: 3200000000, marketCap: 62000000000, name: 'Dogecoin', image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png' },
  'MATICUSDT': { symbol: 'MATICUSDT', price: 0.58, change24h: 0.03, changePercent24h: 5.5, volume24h: 450000000, marketCap: 5800000000, name: 'Polygon', image: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png' }
};

// Fetch live prices from CoinGecko
async function fetchLivePrices() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.coingecko.com',
      path: '/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,polygon&order=market_cap_desc&sparkline=false&price_change_percentage=24h',
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'JadeTrade/1.0' }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.log('CoinGecko returned status:', res.statusCode);
            reject(new Error('API returned ' + res.statusCode));
            return;
          }
          const coins = JSON.parse(data);
          if (!Array.isArray(coins)) {
            reject(new Error('Invalid response format'));
            return;
          }
          const prices = {};
          coins.forEach(coin => {
            const symbol = coin.symbol.toUpperCase() + 'USDT';
            prices[symbol] = {
              symbol,
              price: coin.current_price,
              change24h: coin.price_change_24h,
              changePercent24h: coin.price_change_percentage_24h,
              volume24h: coin.total_volume,
              marketCap: coin.market_cap,
              image: coin.image,
              name: coin.name
            };
          });
          resolve(prices);
        } catch (e) {
          console.error('Parse error:', e.message);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Get live prices
async function getPrices(event) {
  try {
    // Try to get fresh prices
    const prices = await fetchLivePrices();
    // Cache prices in DB
    for (const [symbol, data] of Object.entries(prices)) {
      await query(`
        INSERT INTO price_cache (symbol, price, price_change_24h, price_change_percent_24h, volume_24h, market_cap, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          price = $2, price_change_24h = $3, price_change_percent_24h = $4,
          volume_24h = $5, market_cap = $6, updated_at = NOW()
      `, [symbol, data.price, data.change24h, data.changePercent24h, data.volume24h, data.marketCap]);
    }
    return { statusCode: 200, body: { prices: Object.values(prices) } };
  } catch (error) {
    console.error('Error fetching prices:', error.message);
    // Try cached prices from DB first
    try {
      const cached = await query('SELECT * FROM price_cache WHERE updated_at > NOW() - INTERVAL \'1 hour\'');
      if (cached.rows.length > 0) {
        const prices = cached.rows.map(row => ({
          symbol: row.symbol,
          price: parseFloat(row.price),
          change24h: parseFloat(row.price_change_24h) || 0,
          changePercent24h: parseFloat(row.price_change_percent_24h) || 0,
          volume24h: parseFloat(row.volume_24h) || 0,
          marketCap: parseFloat(row.market_cap) || 0,
          name: row.symbol.replace('USDT', ''),
          image: FALLBACK_PRICES[row.symbol]?.image
        }));
        return { statusCode: 200, body: { prices, cached: true } };
      }
    } catch (dbErr) {
      console.error('DB cache error:', dbErr.message);
    }
    // Use fallback prices
    return { statusCode: 200, body: { prices: Object.values(FALLBACK_PRICES), fallback: true } };
  }
}

// Get or create demo account
async function getDemoAccount(userId) {
  let result = await query('SELECT * FROM demo_accounts WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) {
    result = await query(
      'INSERT INTO demo_accounts (user_id, balance, initial_balance) VALUES ($1, 100000, 100000) RETURNING *',
      [userId]
    );
  }
  return result.rows[0];
}

// Get demo account balance
async function getBalance(event, userId) {
  try {
    const account = await getDemoAccount(userId);
    // Calculate positions value
    const positionsResult = await query(`
      SELECT p.*, pc.price as current_price
      FROM positions p
      LEFT JOIN price_cache pc ON p.symbol = pc.symbol
      WHERE p.user_id = $1 AND p.status = 'open'
    `, [userId]);
    
    let positionsValue = 0;
    let unrealizedPnl = 0;
    for (const pos of positionsResult.rows) {
      const currentPrice = parseFloat(pos.current_price) || parseFloat(pos.entry_price);
      const entryValue = parseFloat(pos.quantity) * parseFloat(pos.entry_price);
      const currentValue = parseFloat(pos.quantity) * currentPrice;
      const pnl = pos.side === 'long' 
        ? (currentValue - entryValue) * parseFloat(pos.leverage)
        : (entryValue - currentValue) * parseFloat(pos.leverage);
      positionsValue += currentValue;
      unrealizedPnl += pnl;
    }

    const balance = parseFloat(account.balance);
    const initialBalance = parseFloat(account.initial_balance);
    const totalValue = balance + positionsValue + unrealizedPnl;
    const pnl = totalValue - initialBalance;
    const pnlPercent = (pnl / initialBalance) * 100;

    return {
      statusCode: 200,
      body: { balance, initialBalance, positionsValue, totalValue, pnl, pnlPercent }
    };
  } catch (error) {
    console.error('Error getting balance:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Get open positions
async function getPositions(event, userId) {
  try {
    const result = await query(`
      SELECT p.*, pc.price as current_price
      FROM positions p
      LEFT JOIN price_cache pc ON p.symbol = pc.symbol
      WHERE p.user_id = $1 AND p.status = 'open'
      ORDER BY p.opened_at DESC
    `, [userId]);
    
    const positions = result.rows.map(pos => {
      const currentPrice = parseFloat(pos.current_price) || parseFloat(pos.entry_price);
      const entryValue = parseFloat(pos.quantity) * parseFloat(pos.entry_price);
      const currentValue = parseFloat(pos.quantity) * currentPrice;
      const unrealizedPnl = pos.side === 'long'
        ? (currentValue - entryValue) * parseFloat(pos.leverage)
        : (entryValue - currentValue) * parseFloat(pos.leverage);
      const unrealizedPnlPercent = (unrealizedPnl / entryValue) * 100;
      
      return { ...pos, current_price: currentPrice, unrealized_pnl: unrealizedPnl, unrealized_pnl_percent: unrealizedPnlPercent };
    });
    
    return { statusCode: 200, body: { positions } };
  } catch (error) {
    console.error('Error getting positions:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Open a new position
async function openPosition(event, userId) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { symbol, side, quantity, leverage = 1, stopLoss, takeProfit, strategyId } = body;
    
    // Get current price
    const priceResult = await query('SELECT price FROM price_cache WHERE symbol = $1', [symbol]);
    let entryPrice = priceResult.rows[0]?.price;
    if (!entryPrice) {
      entryPrice = FALLBACK_PRICES[symbol]?.price;
    }
    if (!entryPrice) {
      return { statusCode: 400, body: { error: 'Could not get price for ' + symbol } };
    }

    // Check balance
    const account = await getDemoAccount(userId);
    const cost = quantity * entryPrice;
    if (cost > parseFloat(account.balance)) {
      return { statusCode: 400, body: { error: 'Insufficient balance' } };
    }

    // Deduct from balance
    await query('UPDATE demo_accounts SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2', [cost, userId]);

    // Create position
    const result = await query(`
      INSERT INTO positions (user_id, symbol, side, quantity, entry_price, leverage, stop_loss, take_profit, strategy_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [userId, symbol, side, quantity, entryPrice, leverage, stopLoss || null, takeProfit || null, strategyId || null]);

    return { statusCode: 200, body: { position: result.rows[0] } };
  } catch (error) {
    console.error('Error opening position:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Close a position
async function closePosition(event, userId) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { positionId } = body;
    
    // Get position
    const posResult = await query('SELECT * FROM positions WHERE id = $1 AND user_id = $2 AND status = $3', [positionId, userId, 'open']);
    if (posResult.rows.length === 0) {
      return { statusCode: 404, body: { error: 'Position not found' } };
    }
    const position = posResult.rows[0];
    
    // Get current price
    const priceResult = await query('SELECT price FROM price_cache WHERE symbol = $1', [position.symbol]);
    let closePrice = parseFloat(priceResult.rows[0]?.price);
    if (!closePrice) {
      closePrice = FALLBACK_PRICES[position.symbol]?.price || parseFloat(position.entry_price);
    }

    // Calculate P&L
    const quantity = parseFloat(position.quantity);
    const entryPrice = parseFloat(position.entry_price);
    const leverage = parseFloat(position.leverage);
    const entryValue = quantity * entryPrice;
    const closeValue = quantity * closePrice;
    const realizedPnl = position.side === 'long'
      ? (closeValue - entryValue) * leverage
      : (entryValue - closeValue) * leverage;

    // Update position
    await query(`
      UPDATE positions SET status = 'closed', close_price = $1, realized_pnl = $2, closed_at = NOW()
      WHERE id = $3
    `, [closePrice, realizedPnl, positionId]);

    // Return funds + P&L to balance
    const returnAmount = entryValue + realizedPnl;
    await query('UPDATE demo_accounts SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2', [returnAmount, userId]);

    return { statusCode: 200, body: { realizedPnl, closePrice } };
  } catch (error) {
    console.error('Error closing position:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Get trade history (closed positions)
async function getTradeHistory(event, userId) {
  try {
    const result = await query(`
      SELECT * FROM positions
      WHERE user_id = $1 AND status = 'closed'
      ORDER BY closed_at DESC
      LIMIT 50
    `, [userId]);
    return { statusCode: 200, body: { trades: result.rows } };
  } catch (error) {
    console.error('Error getting trade history:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Get all trades
async function getTrades(event, userId) {
  try {
    const result = await query(`
      SELECT * FROM positions WHERE user_id = $1 ORDER BY opened_at DESC LIMIT 100
    `, [userId]);
    return { statusCode: 200, body: { trades: result.rows } };
  } catch (error) {
    console.error('Error getting trades:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

// Reset demo account
async function resetDemoAccount(event, userId) {
  try {
    // Close all open positions
    await query("UPDATE positions SET status = 'closed', closed_at = NOW() WHERE user_id = $1 AND status = 'open'", [userId]);
    // Reset balance
    await query('UPDATE demo_accounts SET balance = 100000, initial_balance = 100000, updated_at = NOW() WHERE user_id = $1', [userId]);
    return { statusCode: 200, body: { message: 'Demo account reset to $100,000' } };
  } catch (error) {
    console.error('Error resetting demo:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
}

module.exports = {
  getPrices,
  getBalance,
  getPositions,
  openPosition,
  closePosition,
  getTradeHistory,
  getTrades,
  resetDemoAccount
};