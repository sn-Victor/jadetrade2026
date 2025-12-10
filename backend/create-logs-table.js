const { Pool } = require('pg');

const pool = new Pool({
  host: 'nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'nextrade',
  user: 'postgres',
  password: 'NexTrade2024Secure!',
  ssl: { rejectUnauthorized: false }
});

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS app_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      level VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      user_id VARCHAR(255),
      page VARCHAR(255),
      user_agent TEXT,
      session_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON app_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON app_logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON app_logs(user_id);
  `;
  
  try {
    await pool.query(sql);
    console.log('app_logs table created successfully');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

createTable();