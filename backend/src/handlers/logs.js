const { query } = require('../db');

// POST /api/logs - Store logs (no auth required for logging)
async function storeLogs(body) {
  const logs = body.logs || [];
  
  if (!Array.isArray(logs) || logs.length === 0) {
    return { statusCode: 400, body: { error: 'No logs provided' } };
  }

  try {
    for (const log of logs) {
      await query(
        `INSERT INTO app_logs (timestamp, level, message, data, user_id, page, user_agent, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          log.timestamp || new Date().toISOString(),
          log.level || 'info',
          log.message || '',
          JSON.stringify(log.data || {}),
          log.userId || null,
          log.page || null,
          log.userAgent || null,
          log.sessionId || null
        ]
      );
    }
    return { statusCode: 200, body: { stored: logs.length } };
  } catch (error) {
    console.error('Error storing logs:', error);
    return { statusCode: 500, body: { error: 'Failed to store logs' } };
  }
}

// GET /api/logs - Retrieve logs (requires auth, admin only in production)
async function getLogs(queryParams, userId) {
  const limit = parseInt(queryParams?.limit) || 100;
  const level = queryParams?.level;
  const page = queryParams?.page;
  const userFilter = queryParams?.userId;
  
  try {
    let sql = 'SELECT * FROM app_logs WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (level) {
      paramCount++;
      sql += ` AND level = $${paramCount}`;
      params.push(level);
    }

    if (page) {
      paramCount++;
      sql += ` AND page = $${paramCount}`;
      params.push(page);
    }

    if (userFilter) {
      paramCount++;
      sql += ` AND user_id = $${paramCount}`;
      params.push(userFilter);
    }

    paramCount++;
    sql += ` ORDER BY timestamp DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(sql, params);
    return { statusCode: 200, body: result.rows };
  } catch (error) {
    console.error('Error fetching logs:', error);
    return { statusCode: 500, body: { error: 'Failed to fetch logs' } };
  }
}

// DELETE /api/logs - Clear old logs (older than 7 days)
async function clearOldLogs() {
  try {
    const result = await query(
      `DELETE FROM app_logs WHERE timestamp < NOW() - INTERVAL '7 days' RETURNING id`
    );
    return { statusCode: 200, body: { deleted: result.rowCount } };
  } catch (error) {
    console.error('Error clearing logs:', error);
    return { statusCode: 500, body: { error: 'Failed to clear logs' } };
  }
}

module.exports = { storeLogs, getLogs, clearOldLogs };