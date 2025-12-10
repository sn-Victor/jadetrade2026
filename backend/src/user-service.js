/**
 * User Service - Centralized user management with transaction support
 * 
 * Design principles:
 * 1. Internal 'id' (UUID) is the primary key - NEVER changes
 * 2. 'cognito_id' stores the Cognito user ID - can be updated on pool migrations
 * 3. All operations use database transactions for atomicity
 * 4. User lookup is by cognito_id, foreign keys use internal id
 */

const { query, withTransaction } = require('./db');
const crypto = require('crypto');

/**
 * Get or create a user by their Cognito identity
 * 
 * This handles three scenarios:
 * 1. User exists with matching cognito_id -> return user
 * 2. User exists with same email but different cognito_id -> update cognito_id (pool migration)
 * 3. User doesn't exist -> create new user
 * 
 * @param {Object} cognitoUser - User info from Cognito token { id, email, name }
 * @returns {Promise<Object>} - The user record from database
 */
async function getOrCreateUser(cognitoUser) {
  return await withTransaction(async (client) => {
    const { id: cognitoId, email, name } = cognitoUser;
    
    // Step 1: Try to find by cognito_id (fast path)
    let result = await client.query(
      'SELECT * FROM users WHERE cognito_id = $1',
      [cognitoId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Step 2: Check if user exists by email (Cognito pool migration scenario)
    result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      // User exists with different cognito_id - update it (pool migration)
      const existingUser = result.rows[0];
      console.log(`Migrating user ${email} from cognito_id ${existingUser.cognito_id} to ${cognitoId}`);
      
      result = await client.query(
        `UPDATE users SET cognito_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [cognitoId, existingUser.id]
      );
      
      return result.rows[0];
    }
    
    // Step 3: Brand new user - create with new internal UUID
    const internalId = crypto.randomUUID();
    
    result = await client.query(
      `INSERT INTO users (id, cognito_id, email, full_name, subscription_tier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'free', now(), now())
       RETURNING *`,
      [internalId, cognitoId, email, name || email]
    );
    
    const newUser = result.rows[0];
    
    // Create default portfolio for new user
    await client.query(
      'INSERT INTO portfolios (user_id, name) VALUES ($1, $2)',
      [internalId, 'Demo Portfolio']
    );
    
    // Create demo account for new user
    await client.query(
      'INSERT INTO demo_accounts (user_id, balance, initial_balance) VALUES ($1, 100000, 100000)',
      [internalId]
    );
    
    console.log(`Created new user: ${email} with internal id: ${internalId}`);
    
    return newUser;
  });
}

/**
 * Get user by internal ID (for webhook handlers that have user_id from metadata)
 * 
 * @param {string} internalId - The internal user ID (primary key)
 * @returns {Promise<Object|null>} - The user record or null
 */
async function getUserById(internalId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [internalId]);
  return result.rows[0] || null;
}

/**
 * Get user by Cognito ID
 * 
 * @param {string} cognitoId - The Cognito user ID
 * @returns {Promise<Object|null>} - The user record or null
 */
async function getUserByCognitoId(cognitoId) {
  const result = await query('SELECT * FROM users WHERE cognito_id = $1', [cognitoId]);
  return result.rows[0] || null;
}

/**
 * Update user profile
 * 
 * @param {string} internalId - The internal user ID
 * @param {Object} updates - Fields to update { full_name, avatar_url }
 * @returns {Promise<Object>} - Updated user record
 */
async function updateUser(internalId, updates) {
  const result = await query(
    `UPDATE users SET full_name = COALESCE($1, full_name), avatar_url = COALESCE($2, avatar_url), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [updates.full_name, updates.avatar_url, internalId]
  );
  return result.rows[0];
}

/**
 * Update user subscription (for Stripe webhooks)
 * 
 * @param {string} internalId - The internal user ID
 * @param {Object} subscription - { tier, stripe_customer_id, stripe_subscription_id }
 */
async function updateSubscription(internalId, subscription) {
  await query(
    `UPDATE users SET subscription_tier = $1, stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = now()
     WHERE id = $4`,
    [subscription.tier, subscription.stripe_customer_id, subscription.stripe_subscription_id, internalId]
  );
}

module.exports = {
  getOrCreateUser,
  getUserById,
  getUserByCognitoId,
  updateUser,
  updateSubscription
};

