const { Pool } = require('pg');

const pool = new Pool({
  host: 'nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'nextrade',
  user: 'postgres',
  password: 'NexTrade2024Secure!',
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  try {
    // Drop and recreate for clean state
    await pool.query('DROP TABLE IF EXISTS tv_signals CASCADE');
    await pool.query('DROP TABLE IF EXISTS strategy_subscriptions CASCADE');
    await pool.query('DROP TABLE IF EXISTS strategies CASCADE');
    await pool.query('DROP TABLE IF EXISTS trades CASCADE');
    await pool.query('DROP TABLE IF EXISTS positions CASCADE');
    await pool.query('DROP TABLE IF EXISTS demo_accounts CASCADE');
    await pool.query('DROP TABLE IF EXISTS price_cache CASCADE');
    
    await pool.query(`CREATE TABLE demo_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL UNIQUE,
      balance DECIMAL(18,8) DEFAULT 100000.00,
      initial_balance DECIMAL(18,8) DEFAULT 100000.00,
      currency VARCHAR(10) DEFAULT 'USD',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    
    await pool.query(`CREATE TABLE positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      side VARCHAR(10) NOT NULL,
      quantity DECIMAL(18,8) NOT NULL,
      entry_price DECIMAL(18,8) NOT NULL,
      current_price DECIMAL(18,8),
      unrealized_pnl DECIMAL(18,8) DEFAULT 0,
      unrealized_pnl_percent DECIMAL(10,4) DEFAULT 0,
      leverage INTEGER DEFAULT 1,
      stop_loss DECIMAL(18,8),
      take_profit DECIMAL(18,8),
      is_demo BOOLEAN DEFAULT true,
      status VARCHAR(20) DEFAULT 'open',
      strategy_id UUID,
      opened_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      close_price DECIMAL(18,8),
      realized_pnl DECIMAL(18,8)
    )`);
    
    await pool.query(`CREATE TABLE trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      position_id UUID,
      symbol VARCHAR(20) NOT NULL,
      side VARCHAR(10) NOT NULL,
      order_type VARCHAR(20) DEFAULT 'market',
      quantity DECIMAL(18,8) NOT NULL,
      price DECIMAL(18,8) NOT NULL,
      total DECIMAL(18,8) NOT NULL,
      fee DECIMAL(18,8) DEFAULT 0,
      is_demo BOOLEAN DEFAULT true,
      source VARCHAR(50) DEFAULT 'manual',
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    
    await pool.query(`CREATE TABLE strategies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      tier_required VARCHAR(20) DEFAULT 'free',
      webhook_token VARCHAR(255) UNIQUE,
      symbols TEXT[],
      is_active BOOLEAN DEFAULT true,
      win_rate DECIMAL(5,2),
      avg_profit DECIMAL(10,2),
      total_trades INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    
    await pool.query(`CREATE TABLE strategy_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      strategy_id UUID REFERENCES strategies(id),
      is_active BOOLEAN DEFAULT true,
      auto_trade BOOLEAN DEFAULT false,
      risk_percent DECIMAL(5,2) DEFAULT 1.00,
      subscribed_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    
    await pool.query(`CREATE TABLE tv_signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      strategy_id UUID REFERENCES strategies(id),
      symbol VARCHAR(20) NOT NULL,
      action VARCHAR(10) NOT NULL,
      price DECIMAL(18,8),
      stop_loss DECIMAL(18,8),
      take_profit DECIMAL(18,8),
      message TEXT,
      processed BOOLEAN DEFAULT false,
      received_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    
    await pool.query(`CREATE TABLE price_cache (
      symbol VARCHAR(20) PRIMARY KEY,
      price DECIMAL(18,8) NOT NULL,
      price_change_24h DECIMAL(10,4),
      price_change_percent_24h DECIMAL(10,4),
      volume_24h DECIMAL(24,8),
      market_cap DECIMAL(24,8),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await pool.query('CREATE INDEX idx_positions_user ON positions(user_id)');
    await pool.query('CREATE INDEX idx_positions_status ON positions(status)');
    await pool.query('CREATE INDEX idx_trades_user ON trades(user_id)');
    
    await pool.query(`INSERT INTO strategies (name, description, tier_required, webhook_token, symbols, win_rate, avg_profit, total_trades) VALUES 
      ('Alpha Scalper', 'High-frequency scalping strategy for BTC/USDT', 'free', 'alpha_token_001', ARRAY['BTCUSDT'], 68.5, 1.2, 1247),
      ('Trend Master Pro', 'Trend following strategy for major pairs', 'pro', 'trend_token_002', ARRAY['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], 72.3, 2.8, 856),
      ('Swing Elite', 'Multi-timeframe swing trading', 'pro', 'swing_token_003', ARRAY['BTCUSDT', 'ETHUSDT'], 65.2, 4.5, 423),
      ('Quantum Edge', 'AI-powered strategy with dynamic risk', 'enterprise', 'quantum_token_004', ARRAY['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT'], 78.9, 3.2, 2103)
    `);
    
    console.log('All tables created successfully!');
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err.message, err.stack);
  } finally {
    await pool.end();
  }
}
createTables();