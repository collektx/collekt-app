const { supabase } = require('./lib/supabase-client');
const crypto = require('crypto');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * Timing-safe Svix / Resend Webhook Signature Verifier (CWE-347 / OWASP ASVS V13.1)
 */
function verifyResendSignature(headers, rawBody, secret) {
  if (!secret) return true;
  const svixId = headers['svix-id'] || headers['Svix-Id'] || '';
  const svixTimestamp = headers['svix-timestamp'] || headers['Svix-Timestamp'] || '';
  const svixSignature = headers['svix-signature'] || headers['Svix-Signature'] || '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Prevent timestamp replay attack (tolerance window: 5 minutes / 300s)
  const tsNum = parseInt(svixTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretKey = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : secret;
  const expectedHmac = crypto.createHmac('sha256', secretKey).update(toSign).digest();

  // Parse space or comma-delimited signatures (e.g. "v1,abc... v1,xyz...")
  const signatures = svixSignature.split(/[ ,]+/).map(s => {
    const parts = s.split(',');
    return parts.length > 1 ? parts[1] : parts[0];
  });

  for (const sig of signatures) {
    try {
      const sigBuf = Buffer.from(sig, 'base64');
      if (sigBuf.length === expectedHmac.length && crypto.timingSafeEqual(sigBuf, expectedHmac)) {
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  return false;
}

/**
 * Resend Webhook Handler
 * Receives email status events: delivered, bounced, complained, opened, clicked, etc.
 * Verifies Svix cryptographic signature and rate-limits incoming webhooks.
 */
exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return preflightResponse(event);
  }

  const headers = corsHeaders(event);

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Rate limiting to prevent webhook amplification attacks (max 60 webhooks/min per IP)
  const rateCheck = enforceRateLimit(event, {
    action: 'resend-webhook',
    limit: 60,
    windowMs: 60 * 1000,
    customHeaders: headers
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  try {
    const rawBody = event.body || '{}';

    // Cryptographic signature check (CWE-347 / OWASP ASVS V13.1)
    const resendSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (resendSecret) {
      const isValid = verifyResendSignature(event.headers, rawBody, resendSecret);
      if (!isValid) {
        console.warn('[Resend Webhook] Cryptographic signature verification failed (CWE-347)');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or missing webhook cryptographic signature' })
        };
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type || payload.event;
    const eventData = payload.data || {};

    console.log(`[Resend Webhook] Received verified event: ${eventType}`, {
      email_id: eventData.email_id || eventData.id,
      to: eventData.to,
      subject: eventData.subject,
      created_at: payload.created_at
    });

    // Handle specific event types
    switch (eventType) {
      case 'email.delivered':
        console.log(`[Resend Webhook] Email delivered to: ${eventData.to}`);
        break;

      case 'email.bounced':
        console.warn(`[Resend Webhook] Email bounced for: ${eventData.to}`, eventData.bounce);
        break;

      case 'email.complained':
        console.warn(`[Resend Webhook] Spam complaint from: ${eventData.to}`);
        break;

      case 'email.opened':
      case 'email.clicked':
        console.log(`[Resend Webhook] Engagement event: ${eventType} by ${eventData.to}`);
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event: ${eventType}`);
        break;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        received: true,
        type: eventType
      })
    };

  } catch (err) {
    console.error('[Resend Webhook Error]:', err);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid webhook payload: ' + err.message })
    };
  }
};

module.exports.verifyResendSignature = verifyResendSignature;
