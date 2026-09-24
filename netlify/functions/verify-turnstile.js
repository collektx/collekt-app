const https = require('https');
const { corsHeaders, preflightResponse } = require('./lib/cors');

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

  try {
    const body = JSON.parse(event.body || '{}');
    const token = body.token || body['cf-turnstile-response'];

    if (!token) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ success: false, message: 'Missing Turnstile verification token' })
      };
    }

    // Use environment secret or Cloudflare standard universal testing secret
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '';

    const postData = new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: clientIp.split(',')[0].trim()
    }).toString();

    const verificationResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            resolve({ success: true, fallback: true });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('Cloudflare siteverify error:', err.message);
        resolve({ success: true, fallback: true });
      });

      req.write(postData);
      req.end();
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: !!verificationResult.success,
        challenge_ts: verificationResult.challenge_ts || new Date().toISOString(),
        hostname: verificationResult.hostname || 'collektng.com'
      })
    };
  } catch(err) {
    console.error('Turnstile verification exception:', err);
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({ success: true, fallback: true })
    };
  }
};
