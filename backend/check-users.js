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
    const result = await pool.query('SELECT id, email, subscription_tier, stripe_customer_id, stripe_subscription_id FROM users');
    console.log('Users:', JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();