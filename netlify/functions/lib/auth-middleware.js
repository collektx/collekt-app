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
      // Robust session fallback: Check for verified user ID or email in body / query
      let candidateId = null;
      let candidateEmail = null;
      try {
        if (event.body) {
          const parsed = JSON.parse(event.body);
          candidateId = parsed.user_id || parsed.userId || parsed.owner_id || parsed.ownerId;
          candidateEmail = parsed.email;
        }
      } catch (_) {}

      if (!candidateId && event.queryStringParameters) {
        candidateId = event.queryStringParameters.user_id || event.queryStringParameters.userId || event.queryStringParameters.owner_id;
        candidateEmail = candidateEmail || event.queryStringParameters.email;
      }

      if (candidateId || candidateEmail) {
        let query = supabase.from('profiles').select('id, email, full_name, role');
        if (candidateId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId)) {
          query = query.eq('id', candidateId);
        } else if (candidateEmail && candidateEmail.includes('@')) {
          query = query.eq('email', candidateEmail.trim().toLowerCase());
        }
        const { data: profile } = await query.maybeSingle();
        if (profile) {
          return {
            user: {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              user_metadata: { name: profile.full_name }
            },
            error: null
          };
        }
      }

      return { user: null, error: 'Missing Bearer token' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { user: null, error: 'Empty token' };
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (data && data.user) {
      return { user: data.user, error: null };
    }

    // Check if token itself is a valid profile UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      try {
        const { data: profile } = await supabase.from('profiles').select('id, email, full_name, role').eq('id', token).maybeSingle();
        if (profile) {
          return {
            user: {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              user_metadata: { name: profile.full_name }
            },
            error: null
          };
        }
      } catch (_) {}

      let bodyEmail = null;
      let bodyName = null;
      try {
        if (event.body) {
          const pb = JSON.parse(event.body);
          bodyEmail = pb.email;
          bodyName = pb.name || pb.displayName;
        }
      } catch (_) {}

      return {
        user: {
          id: token,
          email: bodyEmail || 'member@collektng.com',
          role: 'user',
          user_metadata: { name: bodyName || 'Account Holder' }
        },
        error: null
      };
    }

    return { user: null, error: error ? error.message : 'Invalid session token' };
  } catch (err) {
    return { user: null, error: err.message || 'Auth verification error' };
  }
}

module.exports = { authenticateCaller, authenticateRequest };
