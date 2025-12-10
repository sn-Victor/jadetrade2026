const { Pool } = require('pg');

const pool = new Pool({
  host: 'nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'nextrade',
  user: 'postgres',
  password: 'NexTrade2024Secure!',
  ssl: { rejectUnauthorized: false }
});

async function update() {
  try {
    await pool.query("UPDATE users SET subscription_tier = 'pro' WHERE email = 'victor.s.curran@gmail.com'");
    const result = await pool.query('SELECT email, subscription_tier FROM users');
    console.log('Updated:', result.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

update();