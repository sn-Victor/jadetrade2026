const { Pool } = require('pg');

const pool = new Pool({
  host: 'nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'nextrade',
  user: 'postgres',
  password: 'NexTrade2024Secure!',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const result = await pool.query('SELECT id, email, subscription_tier, stripe_customer_id FROM users LIMIT 10');
    console.log('Users:', result.rows);
    
    const logs = await pool.query('SELECT level, message, data FROM app_logs WHERE level = $1 ORDER BY timestamp DESC LIMIT 5', ['error']);
    console.log('Recent errors:', logs.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();