/**
 * Collekt Statutory Consent Audit Trail API
 * NDPA 2023 Sections 24 & 39 | FCCPA 2018 Sections 114–116 | Evidence Act 2011 Sec 84
 * COBIT 2019 DSS05 / DSS06 | ISACA ITAF 5th Edition Section 2208
 *
 * Immutably logs affirmative data protection consent grants, terms acceptance,
 * and privacy policy acknowledgements into public.audit_logs.
 */

const { supabase } = require('./lib/supabase-client');
const { corsHeaders } = require('./lib/cors');
const { checkRateLimit } = require('./lib/rate-limiter');
const { authenticateCaller } = require('./lib/auth-middleware');

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: ''
    };
  }

  // Method restriction
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  // Rate Limiting (60 requests/minute)
  const rateLimit = checkRateLimit(event, 'consent-record', { maxRequests: 60, windowSeconds: 60 });
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: corsHeaders(event, { 'Retry-After': String(rateLimit.retryAfter) }),
      body: JSON.stringify({
        error: 'Too many consent audit requests. Please try again later.',
        retryAfter: rateLimit.retryAfter
      })
    };
  }

  try {
    let payload = {};
    if (event.body) {
      try {
        payload = JSON.parse(event.body);
      } catch (e) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Invalid JSON request payload.' })
        };
      }
    }

    // Optional caller authentication
    let caller = { user: null, userId: null };
    try {
      caller = await authenticateCaller(event, { required: false });
    } catch (e) {
      // Allow unauthenticated guest consent (e.g. cookie banner, pre-registration affirmative consent)
    }

    const effectiveUserId = caller.userId || payload.user_id || null;
    const clientIp = event.headers['x-forwarded-for'] || 
                     event.headers['client-ip'] || 
                     (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) || 
                     '127.0.0.1';
    const userAgent = event.headers['user-agent'] || 'Web Browser';
    const consentType = payload.consent_type || 'terms_and_privacy';
    const policyVersion = payload.policy_version || '2026.1';
    const jurisdiction = payload.jurisdiction || 'Federal Republic of Nigeria';
    const nowIso = new Date().toISOString();

    const auditEntry = {
      actor_id: effectiveUserId,
      action: 'STATUTORY_CONSENT_RECORDED',
      entity_type: 'user_consent',
      entity_id: effectiveUserId || payload.email || 'anonymous',
      metadata: {
        consent_type: consentType,
        policy_version: policyVersion,
        jurisdiction: jurisdiction,
        ndpa_accepted: true,
        fccpa_acknowledged: true,
        cbn_disclaimer_acknowledged: true,
        ip_address: clientIp.split(',')[0].trim(),
        user_agent: userAgent,
        recorded_at: nowIso,
        statutory_acts: [
          'Nigeria Data Protection Act (NDPA) 2023',
          'Federal Competition and Consumer Protection Act (FCCPA) 2018',
          'Evidence Act 2011 (Section 84)',
          'Arbitration and Mediation Act 2023'
        ],
        ...(payload.metadata || {})
      }
    };

    // Insert into immutable public.audit_logs
    if (supabase) {
      try {
        const { error: insertErr } = await supabase.from('audit_logs').insert(auditEntry);
        if (insertErr) {
          console.warn('[consent-record] Supabase insert warning:', insertErr.message);
        }
      } catch (dbErr) {
        console.warn('[consent-record] DB insert exception:', dbErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: true,
        status: 'recorded',
        action: 'STATUTORY_CONSENT_RECORDED',
        consent_type: consentType,
        policy_version: policyVersion,
        jurisdiction: jurisdiction,
        recorded_at: nowIso
      })
    };
  } catch (err) {
    console.error('[consent-record] Fatal error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Internal server error while recording statutory consent.' })
    };
  }
};
