const { supabase } = require('./lib/supabase-client');
const { authenticateCaller } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * NDPA 2023 Section 34: Data Subject Rights & Account Erasure Endpoint
 * 
 * Cryptographically verifies caller session, enforces pre-conditions (no active contracts/escrows),
 * purges uploaded KYC identity files from private storage buckets, permanently scrubs PII
 * from public profiles and user documents, and preserves financial double-entry ledger integrity
 * in compliance with CBN AML/CFT regulations.
 */
exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    // 1. Authenticate caller via Supabase JWT
    let authUser;
    try {
      const authResult = await authenticateCaller(event);
      authUser = authResult.user;
    } catch (authErr) {
      return {
        statusCode: authErr.statusCode || 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: authErr.message || 'Authentication required'
        })
      };
    }

    if (!authUser || !authUser.id) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Valid session required.' })
      };
    }

    const userId = authUser.id;

    // 2. Rate Limiting: Max 5 deletion requests per hour per user/IP
    const limiter = enforceRateLimit(event, {
      action: 'account-delete',
      userId: userId,
      limit: 5,
      windowMs: 60 * 60 * 1000
    });

    if (!limiter.allowed) {
      return limiter.response;
    }

    // 3. Purge physical files from storage buckets (documents & media)
    try {
      // List and delete files in private documents bucket
      const { data: docFiles } = await supabase.storage.from('documents').list(userId, { limit: 100 });
      if (docFiles && docFiles.length > 0) {
        const filePaths = docFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('documents').remove(filePaths);
      }

      // List and delete files in media bucket
      const { data: mediaFiles } = await supabase.storage.from('media').list(userId, { limit: 100 });
      if (mediaFiles && mediaFiles.length > 0) {
        const mediaPaths = mediaFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('media').remove(mediaPaths);
      }
    } catch (storageErr) {
      console.warn('[AccountDelete] Non-fatal storage purge notice:', storageErr.message);
    }

    // 4. Invoke atomic database stored procedure for NDPA Section 34 erasure
    const { data: rpcResult, error: rpcError } = await supabase.rpc('request_data_subject_erasure', {
      target_user_id: userId
    });

    if (rpcError) {
      console.error('[AccountDelete] RPC failure:', rpcError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Database erasure procedure failed.',
          details: rpcError.message
        })
      };
    }

    if (!rpcResult || rpcResult.success === false) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: rpcResult?.error || 'Account erasure rejected.',
          details: rpcResult
        })
      };
    }

    // 5. Invalidate / ban user authentication record in auth.users
    try {
      if (supabase.auth && supabase.auth.admin) {
        // Attempt deletion first if no foreign keys hold it
        const { error: delUserErr } = await supabase.auth.admin.deleteUser(userId);
        if (delUserErr) {
          // If foreign keys retain historical contracts, ban user indefinitely and scramble auth email
          const tombstoneEmail = `deleted_${userId.slice(0, 8)}@erased.collekt.invalid`;
          await supabase.auth.admin.updateUserById(userId, {
            email: tombstoneEmail,
            ban_duration: '876000h', // 100 years
            user_metadata: { is_deleted: true, deleted_at: new Date().toISOString() }
          });
        }
      }
    } catch (authAdminErr) {
      console.warn('[AccountDelete] Auth admin disable notice:', authAdminErr.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Account and personal data erased pursuant to NDPA 2023 Section 34.',
        erased_email: rpcResult.erased_email,
        timestamp: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error('[AccountDelete] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'An unexpected error occurred while processing account erasure.',
        details: err.message
      })
    };
  }
};
