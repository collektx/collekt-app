const https = require('https');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit, getClientIp } = require('./lib/rate-limiter');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  // Rate limit: 30 requests per minute per IP to prevent automated challenge flooding
  const rateLimitResult = enforceRateLimit(event, {
    action: 'turnstile',
    limit: 30,
    windowMs: 60000,
    customHeaders: corsHeaders(event)
  });
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response;
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const token = body.token || body['cf-turnstile-response'];

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'MISSING_TOKEN',
          message: 'Missing or empty Turnstile verification token'
        })
      };
    }

    // Use environment secret or Cloudflare standard universal testing secret
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const clientIp = getClientIp(event);

    const postData = new URLSearchParams({
      secret: secretKey,
      response: token.trim(),
      remoteip: clientIp
    }).toString();

    // OWASP ASVS V13.2 / V1.1.7: Fail-Closed cryptographic verification with explicit timeout
    const verificationResult = await new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      const req = https.request({
        hostname: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            safeResolve(parsed);
          } catch(e) {
            console.error('Failed to parse Cloudflare Turnstile response JSON:', e.message);
            safeResolve({
              success: false,
              error: 'PARSE_ERROR',
              message: 'Invalid response from verification service'
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('Cloudflare siteverify timed out after 8000ms');
        safeResolve({
          success: false,
          error: 'TIMEOUT',
          message: 'Verification service timed out'
        });
      });

      req.on('error', (err) => {
        console.warn('Cloudflare siteverify network error:', err.message);
        safeResolve({
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Security verification service temporarily unreachable'
        });
      });

      req.write(postData);
      req.end();
    });

    if (!verificationResult || !verificationResult.success) {
      const errorCodes = (verificationResult && verificationResult['error-codes']) || 
                         [verificationResult && verificationResult.error ? verificationResult.error : 'VERIFICATION_FAILED'];
      const statusCode = (verificationResult && (verificationResult.error === 'TIMEOUT' || verificationResult.error === 'NETWORK_ERROR')) ? 502 : 400;

      return {
        statusCode,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error_codes: errorCodes,
          message: verificationResult && verificationResult.message ? verificationResult.message : 'Bot verification challenge failed. Please try again.'
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: true,
        challenge_ts: verificationResult.challenge_ts || new Date().toISOString(),
        hostname: verificationResult.hostname || 'collektng.com',
        action: verificationResult.action || null
      })
    };
  } catch(err) {
    console.error('Turnstile verification exception:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An internal error occurred during verification'
      })
    };
  }
};
