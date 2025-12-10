const { Pool } = require('pg');
const pool = new Pool({
  host: 'nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com',
  database: 'nextrade',
  user: 'postgres',
  password: 'NexTrade2024Secure!',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_cache (
        symbol VARCHAR(20) PRIMARY KEY,
        price DECIMAL(18,8) NOT NULL,
        price_change_24h DECIMAL(18,8),
        price_change_percent_24h DECIMAL(10,4),
        volume_24h DECIMAL(24,2),
        market_cap DECIMAL(24,2),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('price_cache table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        balance DECIMAL(18,2) DEFAULT 100000,
        initial_balance DECIMAL(18,2) DEFAULT 100000,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('demo_accounts table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        quantity DECIMAL(18,8) NOT NULL,
        entry_price DECIMAL(18,8) NOT NULL,
        close_price DECIMAL(18,8),
        leverage INTEGER DEFAULT 1,
        stop_loss DECIMAL(18,8),
        take_profit DECIMAL(18,8),
        status VARCHAR(20) DEFAULT 'open',
        realized_pnl DECIMAL(18,2),
        opened_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP,
        strategy_id UUID
      )
    `);
    console.log('positions table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        tier_required VARCHAR(20) DEFAULT 'free',
        symbols TEXT[],
        win_rate DECIMAL(5,2),
        avg_profit DECIMAL(5,2),
        total_trades INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('strategies table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategy_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        strategy_id UUID NOT NULL REFERENCES strategies(id),
        auto_trade BOOLEAN DEFAULT false,
        risk_percent DECIMAL(5,2) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, strategy_id)
      )
    `);
    console.log('strategy_subscriptions table created');

    const existing = await pool.query('SELECT COUNT(*) FROM strategies');
    if (parseInt(existing.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO strategies (name, description, tier_required, symbols, win_rate, avg_profit, total_trades) VALUES
        ('Alpha Scalper', 'Fast scalping strategy for volatile markets', 'free', ARRAY['BTCUSDT','ETHUSDT'], 68.5, 1.2, 1245),
        ('Trend Master Pro', 'Trend following with pullback entries', 'pro', ARRAY['BTCUSDT','ETHUSDT','SOLUSDT'], 72.3, 2.8, 856),
        ('Swing Elite', 'Multi-timeframe swing trading', 'pro', ARRAY['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT'], 65.2, 4.5, 423),
        ('Quantum Edge', 'AI-powered market analysis', 'enterprise', ARRAY['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','ADAUSDT'], 78.9, 5.2, 1892)
      `);
      console.log('Sample strategies inserted');
    }

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

createTables();