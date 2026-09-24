const { supabase } = require('./supabase-client');

/**
 * Serverless JWT Authentication Middleware
 * Extracts and cryptographically verifies the caller's session token via Supabase Auth.
 * Returns the authenticated user object or throws an authorization error.
 * 
 * @param {object} event - Netlify serverless invocation event
 * @param {object} [options] - Options e.g. { required: true }
 * @returns {Promise<{ user: object, userId: string, email: string }>}
 */
async function authenticateCaller(event, options = { required: true }) {
  const authHeader = event.headers.authorization || 
                     event.headers.Authorization || 
                     event.headers['authorization'] || 
                     '';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (!options.required) return { user: null, userId: null };
    const err = new Error('Authentication required: Missing or malformed Bearer token.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    if (!options.required) return { user: null, userId: null };
    const err = new Error('Authentication required: Empty Bearer token.');
    err.statusCode = 401;
    throw err;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      const err = new Error(error ? error.message : 'Invalid or expired session token.');
      err.statusCode = 401;
      throw err;
    }

    return {
      user: data.user,
      userId: data.user.id,
      email: data.user.email
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const authErr = new Error('Authentication verification failed: ' + (err.message || 'Unknown error'));
    authErr.statusCode = 401;
    throw authErr;
  }
}

async function authenticateRequest(event) {
  try {
    const authHeader = event.headers.authorization || 
                       event.headers.Authorization || 
                       event.headers['authorization'] || 
                       '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing Bearer token' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { user: null, error: 'Empty token' };
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return { user: null, error: error ? error.message : 'Invalid session token' };
    }

    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err.message || 'Auth verification error' };
  }
}

module.exports = { authenticateCaller, authenticateRequest };
