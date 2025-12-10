const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

const getUserFromToken = async (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }
  const token = authHeader.substring(7);
  const decoded = await verifyToken(token);

  // Extract Cognito groups from the token
  const groups = decoded['cognito:groups'] || [];
  const isAdmin = groups.includes('admin');

  return {
    id: decoded.sub,
    email: decoded.email,
    name: decoded.name || decoded.email,
    groups,
    isAdmin
  };
};

// Middleware to require admin access
const requireAdmin = async (authHeader) => {
  const user = await getUserFromToken(authHeader);
  if (!user.isAdmin) {
    throw new Error('Admin access required');
  }
  return user;
};

module.exports = { verifyToken, getUserFromToken, requireAdmin };