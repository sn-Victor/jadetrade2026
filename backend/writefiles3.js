const fs = require('fs');

// users.js
const usersContent = `const { query } = require('../db');
const { getUserFromToken } = require('../auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.getProfile = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const result = await query('SELECT * FROM users WHERE id = $1', [user.id]);
    if (result.rows.length === 0) {
      const insertResult = await query(
        'INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) RETURNING *',
        [user.id, user.email, user.name]
      );
      await query('INSERT INTO portfolios (user_id, name) VALUES ($1, $2)', [user.id, 'Demo Portfolio']);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(insertResult.rows[0]) };
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows[0]) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.updateProfile = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const body = JSON.parse(event.body);
    const result = await query(
      'UPDATE users SET full_name = $1, avatar_url = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [body.full_name, body.avatar_url, user.id]
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows[0]) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};`;

fs.writeFileSync('src/handlers/users.js', usersContent);
console.log('users.js written');