const { supabase } = require('./lib/supabase-client');
const { authenticateCaller } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { corsHeaders, preflightResponse } = require('./lib/cors');

/**
 * NDPA 2023 Section 33: Data Subject Rights & Data Portability Endpoint
 *
 * Cryptographically verifies caller session, enforces strict IDOR protection (callers can
 * ONLY export their own data), compiles machine-readable JSON portfolio covering user profile,
 * KYC metadata, wallet balance, transaction ledger, and proposal history, and logs the event
 * in compliance with NDPA and CBN regulatory standards.
 */
exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (method !== 'GET' && method !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method not allowed. Use GET or POST.' })
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
        headers: corsHeaders(event),
        body: JSON.stringify({
          error: authErr.message || 'Authentication required'
        })
      };
    }

    if (!authUser || !authUser.id) {
      return {
        statusCode: 401,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Unauthorized: Valid session required.' })
      };
    }

    const userId = authUser.id;

    // 2. Rate Limiting: Max 10 export requests per 15 minutes per user/IP
    const limiter = enforceRateLimit(event, {
      action: 'account-export',
      userId: userId,
      limit: 10,
      windowMs: 15 * 60 * 1000
    });

    if (limiter.throttled) {
      return {
        statusCode: limiter.statusCode,
        headers: { ...corsHeaders(event), ...limiter.headers },
        body: JSON.stringify(limiter.body)
      };
    }

    // 3. Query all user personal, financial, and contract data
    // Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, role, phone, state, created_at, bio, skills, title, hourly_rate, company_name')
      .eq('id', userId)
      .maybeSingle();

    // Wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, user_id, currency, available_balance, ledger_balance, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    // Ledger (recent 100 entries)
    const { data: ledgerEntries } = await supabase
      .from('wallet_ledger')
      .select('id, transaction_type, amount, balance_before, balance_after, description, reference, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Transactions (sent or received)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, amount, status, type, reference, description, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    // Proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, project_id, cover_letter, bid_amount, estimated_duration, status, created_at')
      .eq('pro_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // User documents metadata (excluding raw sensitive signatures/blobs)
    const { data: documents } = await supabase
      .from('user_documents')
      .select('id, document_type, file_name, file_size, status, created_at')
      .eq('user_id', userId);

    // Audit logs for user
    const { data: auditTrail } = await supabase
      .from('audit_logs')
      .select('id, action, timestamp, metadata')
      .or(`performed_by.eq.${userId},target_user_id.eq.${userId}`)
      .order('timestamp', { ascending: false })
      .limit(50);

    // 4. Construct NDPA 2023 Section 33 Machine-Readable Export Payload
    const exportTimestamp = new Date().toISOString();
    const exportPayload = {
      compliance: {
        standard: 'Nigeria Data Protection Act (NDPA 2023) Section 33',
        right: 'Right to Data Portability',
        format: 'Structured JSON (Machine-Readable)',
        data_controller: 'Collekt Technologies Limited',
        data_protection_officer_contact: 'dpo@collektng.com',
        export_timestamp: exportTimestamp,
        data_subject_id: userId,
        data_subject_email: profile?.email || authUser.email
      },
      data: {
        profile: profile || {},
        wallet: wallet || {},
        ledger_entries: ledgerEntries || [],
        transactions: transactions || [],
        proposals: proposals || [],
        documents_metadata: documents || [],
        audit_trail: auditTrail || []
      }
    };

    // 5. Emit administrative audit event for statutory compliance tracking
    try {
      await supabase.rpc('record_admin_audit', {
        p_action: 'DATA_SUBJECT_EXPORT_GENERATED',
        p_target_id: userId,
        p_metadata: {
          standard: 'NDPA 2023 Section 33',
          timestamp: exportTimestamp,
          client_ip: event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown'
        }
      });
    } catch (auditErr) {
      console.warn('NDPA export audit notice:', auditErr.message);
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(event),
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="collekt-data-export-${userId.substring(0, 8)}-${Date.now()}.json"`
      },
      body: JSON.stringify(exportPayload, null, 2)
    };
  } catch (err) {
    console.error('Data subject export fatal error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({
        error: 'An internal error occurred while generating your data archive. Please contact support.'
      })
    };
  }
};
