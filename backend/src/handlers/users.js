const { getUserFromToken } = require('../auth');
const { getOrCreateUser, updateUser } = require('../user-service');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Get user profile - handles auto-creation and Cognito pool migrations
 * Uses transaction-based user service for reliability
 */
exports.getProfile = async (event) => {
  try {
    // Get Cognito user info from JWT token
    const cognitoUser = await getUserFromToken(event.headers.Authorization || event.headers.authorization);

    // Get or create user (handles pool migrations automatically)
    const dbUser = await getOrCreateUser(cognitoUser);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(dbUser)
    };
  } catch (error) {
    console.error('getProfile Error:', error);
    return {
      statusCode: error.message.includes('token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (event) => {
  try {
    const cognitoUser = await getUserFromToken(event.headers.Authorization || event.headers.authorization);

    // First get/create to ensure user exists and get internal ID
    const dbUser = await getOrCreateUser(cognitoUser);

    // Update using internal ID
    const body = JSON.parse(event.body);
    const updatedUser = await updateUser(dbUser.id, {
      full_name: body.full_name,
      avatar_url: body.avatar_url
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(updatedUser)
    };
  } catch (error) {
    console.error('updateProfile Error:', error);
    return {
      statusCode: error.message.includes('token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};