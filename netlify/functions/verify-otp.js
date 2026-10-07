const crypto = require('crypto');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { supabase } = require('./lib/supabase-client');

/**
 * Netlify Function Handler
 * POST /api/verify-otp
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  // Rate limit: 20 verify attempts per 10 minutes per IP to prevent brute-force
  const rateCheck = enforceRateLimit(event, {
    action: 'verify-otp',
    limit: 20,
    windowMs: 10 * 60 * 1000,
    customHeaders: corsHeaders(event)
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { email, code, token } = payload;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').replace(/\D/g, '').trim();

    if (!cleanEmail || !cleanCode || !token) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'MISSING_FIELDS',
          message: 'Email address, verification code, and session token are required'
        })
      };
    }

    // Decode and parse verification token
    let session;
    try {
      const decodedJson = Buffer.from(token, 'base64').toString('utf8');
      session = JSON.parse(decodedJson);
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Verification token is malformed. Please request a new code.'
        })
      };
    }

    const { email: tokenEmail, codeHash, expiresAt, signature } = session;

    // Verify HMAC-SHA256 signature
    const secret = (process.env.RESEND_API_KEY || '') + (process.env.SUPABASE_KEY || 'collekt-otp-secret-2026');
    const payloadToSign = `${tokenEmail}:${codeHash}:${expiresAt}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

    if (signature !== expectedSignature) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Verification signature is invalid or tampered with. Please request a new code.'
        })
      };
    }

    // Check email match
    if (tokenEmail !== cleanEmail) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'EMAIL_MISMATCH',
          message: 'Email does not match the active verification session.'
        })
      };
    }

    // Check 15-minute expiration
    const now = Date.now();
    if (now > expiresAt) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'EXPIRED',
          message: 'This verification code has expired after 15 minutes. Please click "Resend OTP" to get a fresh code.'
        })
      };
    }

    // Compare entered code hash
    const enteredHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (enteredHash !== codeHash) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'INCORRECT_CODE',
          message: 'Incorrect verification code. Please check your email and try again.'
        })
      };
    }

    // Record audit event asynchronously
    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('audit_logs').insert({
          action: 'email_otp_verified',
          user_id: null,
          metadata: {
            email: cleanEmail,
            verified_at: new Date().toISOString(),
            ip: event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown'
          }
        }).then().catch(e => console.warn('[Verify OTP] Audit log warning:', e.message));
      }
    } catch(auditErr) {}

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: true,
        message: 'Email verified successfully!',
        verified: true,
        verifiedAt: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error('[Verify OTP] Execution exception:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Internal server error while verifying code',
        details: err.message
      })
    };
  }
};
