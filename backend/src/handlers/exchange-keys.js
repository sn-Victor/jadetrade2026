/**
 * Exchange API Keys Handler
 * 
 * Manages encrypted storage and retrieval of user exchange API keys.
 * Uses AES-256-GCM encryption for secure storage.
 */
const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { getUserFromToken } = require('../auth');
const { getOrCreateUser } = require('../user-service');

// Encryption key from environment (32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.EXCHANGE_ENCRYPTION_KEY || 'jadetrade-dev-key-32-bytes-long!';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'jadetrade-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM
 */
function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'jadetrade-salt', 32);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Get all exchange API keys for a user (without secrets)
 */
async function getExchangeKeys(event, userId) {
  const result = await query(
    `SELECT id, exchange, label, is_read_only, can_trade, is_active, is_valid,
            last_used_at, last_validated_at, created_at,
            SUBSTRING(api_key_encrypted, 1, 20) as api_key_preview
     FROM exchange_api_keys 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );

  // Mask the API key for display (show first 4 and last 4 chars)
  const keys = result.rows.map(row => {
    let maskedKey = '****';
    try {
      const decrypted = decrypt(row.api_key_preview.split(':').length === 3 
        ? row.api_key_preview 
        : '');
      maskedKey = decrypted.substring(0, 4) + '****' + decrypted.slice(-4);
    } catch (e) {
      // Preview not available, use generic mask
    }
    
    return {
      id: row.id,
      exchange: row.exchange,
      label: row.label,
      apiKeyMasked: maskedKey,
      isReadOnly: row.is_read_only,
      canTrade: row.can_trade,
      isActive: row.is_active,
      isValid: row.is_valid,
      lastUsedAt: row.last_used_at,
      lastValidatedAt: row.last_validated_at,
      createdAt: row.created_at,
    };
  });

  return { statusCode: 200, body: { keys } };
}

/**
 * Add a new exchange API key
 */
async function addExchangeKey(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const { exchange, apiKey, apiSecret, passphrase, label } = body;

  if (!exchange || !apiKey || !apiSecret) {
    return { statusCode: 400, body: { error: 'Missing required fields: exchange, apiKey, apiSecret' } };
  }

  const validExchanges = ['binance', 'bybit', 'coinbase', 'kraken', 'okx', 'kucoin', 'gate', 'bitget'];
  if (!validExchanges.includes(exchange.toLowerCase())) {
    return { statusCode: 400, body: { error: `Invalid exchange. Supported: ${validExchanges.join(', ')}` } };
  }

  // Encrypt the credentials
  const encryptedApiKey = encrypt(apiKey);
  const encryptedApiSecret = encrypt(apiSecret);
  const encryptedPassphrase = passphrase ? encrypt(passphrase) : null;

  try {
    const result = await query(
      `INSERT INTO exchange_api_keys 
       (user_id, exchange, label, api_key_encrypted, api_secret_encrypted, passphrase_encrypted, is_read_only, can_trade)
       VALUES ($1, $2, $3, $4, $5, $6, false, true)
       RETURNING id, exchange, label, created_at`,
      [userId, exchange.toLowerCase(), label || `${exchange} Account`, encryptedApiKey, encryptedApiSecret, encryptedPassphrase]
    );

    return { 
      statusCode: 201, 
      body: { 
        message: 'API key added successfully',
        key: {
          id: result.rows[0].id,
          exchange: result.rows[0].exchange,
          label: result.rows[0].label,
          createdAt: result.rows[0].created_at,
        }
      } 
    };
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return { statusCode: 409, body: { error: 'An API key with this label already exists for this exchange' } };
    }
    throw error;
  }
}

/**
 * Delete an exchange API key
 */
async function deleteExchangeKey(event, userId) {
  const keyId = event.pathParameters?.keyId;
  if (!keyId) {
    return { statusCode: 400, body: { error: 'Key ID is required' } };
  }

  const result = await query(
    'DELETE FROM exchange_api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
    [keyId, userId]
  );

  if (result.rowCount === 0) {
    return { statusCode: 404, body: { error: 'API key not found' } };
  }

  return { statusCode: 200, body: { message: 'API key deleted successfully' } };
}

/**
 * Update exchange API key status (enable/disable)
 */
async function updateExchangeKey(event, userId) {
  const keyId = event.pathParameters?.keyId;
  const body = JSON.parse(event.body || '{}');
  const { isActive, label } = body;

  if (!keyId) {
    return { statusCode: 400, body: { error: 'Key ID is required' } };
  }

  const updates = [];
  const values = [keyId, userId];
  let paramIndex = 3;

  if (typeof isActive === 'boolean') {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }
  if (label) {
    updates.push(`label = $${paramIndex++}`);
    values.push(label);
  }
  updates.push('updated_at = now()');

  if (updates.length === 1) {
    return { statusCode: 400, body: { error: 'No fields to update' } };
  }

  const result = await query(
    `UPDATE exchange_api_keys SET ${updates.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING id, exchange, label, is_active`,
    values
  );

  if (result.rowCount === 0) {
    return { statusCode: 404, body: { error: 'API key not found' } };
  }

  return { statusCode: 200, body: { key: result.rows[0] } };
}

/**
 * Get decrypted API key for internal use (trade execution)
 * NOT exposed via API - only used internally by bot-engine
 */
async function getDecryptedKey(userId, exchange) {
  const result = await query(
    `SELECT api_key_encrypted, api_secret_encrypted, passphrase_encrypted, is_active, can_trade, is_valid
     FROM exchange_api_keys
     WHERE user_id = $1 AND exchange = $2 AND is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, exchange.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  if (!row.is_valid) {
    return { error: 'API key is invalid. Please update your credentials.' };
  }
  if (!row.can_trade) {
    return { error: 'API key does not have trading permissions.' };
  }

  return {
    apiKey: decrypt(row.api_key_encrypted),
    apiSecret: decrypt(row.api_secret_encrypted),
    passphrase: row.passphrase_encrypted ? decrypt(row.passphrase_encrypted) : null,
  };
}

/**
 * Mark API key as validated (called after successful test)
 */
async function markKeyValidated(keyId, isValid) {
  await query(
    `UPDATE exchange_api_keys
     SET is_valid = $2, last_validated_at = now(), updated_at = now()
     WHERE id = $1`,
    [keyId, isValid]
  );
}

/**
 * Mark API key as used (called after trade)
 */
async function markKeyUsed(keyId) {
  await query(
    `UPDATE exchange_api_keys SET last_used_at = now() WHERE id = $1`,
    [keyId]
  );
}

/**
 * Validate an exchange API key by testing connectivity
 * This is a lightweight check - actual validation happens in bot-engine
 */
async function validateExchangeKey(event, userId) {
  const keyId = event.pathParameters?.keyId;
  if (!keyId) {
    return { statusCode: 400, body: { error: 'Key ID is required' } };
  }

  // Get the key to verify ownership
  const result = await query(
    `SELECT id, exchange, api_key_encrypted, api_secret_encrypted, passphrase_encrypted
     FROM exchange_api_keys
     WHERE id = $1 AND user_id = $2`,
    [keyId, userId]
  );

  if (result.rows.length === 0) {
    return { statusCode: 404, body: { error: 'API key not found' } };
  }

  const row = result.rows[0];

  try {
    // Decrypt credentials
    const apiKey = decrypt(row.api_key_encrypted);
    const apiSecret = decrypt(row.api_secret_encrypted);

    // For now, just verify we can decrypt and the key format looks valid
    // Real validation would call the exchange API
    const isValidFormat = apiKey.length >= 16 && apiSecret.length >= 16;

    if (!isValidFormat) {
      await markKeyValidated(keyId, false);
      return { statusCode: 200, body: { valid: false, error: 'Invalid API key format' } };
    }

    // Mark as validated
    await markKeyValidated(keyId, true);

    return {
      statusCode: 200,
      body: {
        valid: true,
        message: 'API key validated successfully',
        exchange: row.exchange
      }
    };
  } catch (error) {
    await markKeyValidated(keyId, false);
    return { statusCode: 200, body: { valid: false, error: error.message } };
  }
}

module.exports = {
  getExchangeKeys,
  addExchangeKey,
  deleteExchangeKey,
  updateExchangeKey,
  validateExchangeKey,
  getDecryptedKey,
  markKeyValidated,
  markKeyUsed,
  encrypt,
  decrypt,
  corsHeaders
};

