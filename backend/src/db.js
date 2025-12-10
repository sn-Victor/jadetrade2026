const { Pool } = require('pg');

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.RDS_HOST,
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DATABASE,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 5, // Allow more connections for concurrency
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
};

/**
 * Execute a single query (auto-releases connection)
 */
const query = async (text, params) => {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple operations in a transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('INSERT INTO ...');
 *     await client.query('UPDATE ...');
 *     return someValue;
 *   });
 *
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} - The return value of the callback
 */
const withTransaction = async (callback) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get a client for manual transaction management
 * Remember to call client.release() when done!
 */
const getClient = async () => {
  return await getPool().connect();
};

module.exports = { getPool, query, withTransaction, getClient };