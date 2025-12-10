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
    const logs = await pool.query('SELECT level, message, data FROM app_logs ORDER BY timestamp DESC LIMIT 10');
    console.log('Recent logs:');
    logs.rows.forEach(r => console.log(`[${r.level}] ${r.message}`, r.data));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();