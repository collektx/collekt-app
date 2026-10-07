const https = require('https');
const crypto = require('crypto');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * HTTPS helper with promise and timeout
 */
function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Generate branded HTML email with the 6-digit OTP code (15 minutes validity)
 */
function generateOtpEmailHtml({ name, firstName, code }) {
  const displayName = firstName || name || 'there';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collekt Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #040F0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0D1F1E;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #040F0E; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.35);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 60%, #13756F 100%); padding: 32px 28px; text-align: center;">
              <span style="display: inline-block; background: rgba(212, 146, 11, 0.2); border: 1px solid rgba(212, 146, 11, 0.4); color: #D4920B; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                🔐 Account Security Verification
              </span>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">Collekt</h1>
              <p style="color: rgba(255, 255, 255, 0.8); font-size: 13.5px; margin: 0; font-weight: 500;">
                Nigeria's Dedicated Project &amp; Tender Infrastructure
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #0D1F1E; font-size: 20px; font-weight: 800; margin: 0 0 14px 0;">
                Confirm your email address
              </h2>

              <p style="color: #4A5568; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${displayName}</strong>,<br>
                Thank you for signing up on Collekt! Please enter the 6-digit verification code below to verify your email and activate your account:
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #F4F7F6; border: 2px dashed #13756F; border-radius: 12px; padding: 20px 24px; text-align: center; display: inline-block; max-width: 320px; width: 100%;">
                      <div style="font-size: 11px; font-weight: 800; color: #13756F; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Verification Code
                      </div>
                      <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #0E3B35; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
                        ${code}
                      </div>
                      <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; background: rgba(212, 146, 11, 0.15); border: 1px solid rgba(212, 146, 11, 0.35); border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #9A6700;">
                        ⏱️ Valid for 15 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #4A5568; font-size: 13.5px; line-height: 1.6; margin: 0 0 20px 0;">
                Enter this code on the registration page to finalize your registration and access your dashboard. If the code expires, you can click <strong>"Resend OTP"</strong> at any time.
              </p>

              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FEF3C7; border-left: 4px solid #D97706; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="color: #92400E; font-size: 12px; line-height: 1.5; margin: 0;">
                      <strong>Security Notice:</strong> Never share this code with anyone. Collekt representatives will never ask for your verification code.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Help note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #E2EAE9; padding-top: 16px;">
                <tr>
                  <td>
                    <p style="color: #718096; font-size: 12.5px; line-height: 1.5; margin: 0;">
                      Didn't request this verification? You can safely disregard this email, or reply to <a href="mailto:Kolly@collektng.com" style="color: #13756F; text-decoration: none;">Kolly@collektng.com</a> if you have concerns.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAF9; padding: 20px 28px; text-align: center; border-top: 1px solid #E2EAE9;">
              <p style="color: #8898AA; font-size: 11.5px; margin: 0 0 4px 0;">
                &copy; 2026 Collekt Technologies Ltd. All rights reserved.
              </p>
              <p style="color: #A0AEC0; font-size: 11px; margin: 0;">
                CAMA 2020 Registered &bull; NDPA 2023 Compliant &bull; Lagos, Nigeria
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Netlify Function Handler
 * POST /api/send-otp
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

  // Rate limit: 10 requests per 10 minutes per IP/client to prevent spam
  const rateCheck = enforceRateLimit(event, {
    action: 'send-otp',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    customHeaders: corsHeaders(event)
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { email, name, firstName, role } = payload;

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ success: false, error: 'A valid email address is required' })
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn('[Send OTP] RESEND_API_KEY is not configured in environment variables');
      return {
        statusCode: 500,
        headers: corsHeaders(event),
        body: JSON.stringify({ success: false, error: 'Email delivery service configuration missing' })
      };
    }

    // Generate cryptographically secure 6-digit numeric OTP
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Exactly 15 minutes expiration
    const expiresAt = Date.now() + 15 * 60 * 1000;

    // Cryptographic state token with HMAC-SHA256 signature
    const secret = resendApiKey + (process.env.SUPABASE_KEY || 'collekt-otp-secret-2026');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const payloadToSign = `${cleanEmail}:${codeHash}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
    
    const verificationToken = Buffer.from(JSON.stringify({
      email: cleanEmail,
      codeHash,
      expiresAt,
      signature
    })).toString('base64');

    // Build Email Contents
    const emailSubject = `${code} is your Collekt verification code 🔐`;
    const emailHtml = generateOtpEmailHtml({
      name: name || cleanEmail.split('@')[0],
      firstName: firstName || '',
      code
    });
    const emailText = `Your Collekt verification code is: ${code}\n\nThis code is valid for 15 minutes.\n\nIf you did not request this code, please ignore this email.\n\nCollekt Technologies Ltd. Lagos, Nigeria`;

    // Dispatch via Resend API
    const resendPayload = JSON.stringify({
      from: 'Kolly from Collekt <Kolly@collektng.com>',
      to: [cleanEmail],
      reply_to: 'Kolly@collektng.com',
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });

    const resendResponse = await makeHttpsRequest({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(resendPayload)
      },
      timeout: 10000
    }, resendPayload);

    if (resendResponse.status >= 200 && resendResponse.status < 300) {
      console.log(`[Send OTP] OTP sent to ${cleanEmail}. Email ID:`, resendResponse.data?.id);
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: true,
          message: 'Verification code sent successfully',
          token: verificationToken,
          expiresAt: expiresAt,
          expiresInMinutes: 15
        })
      };
    } else {
      console.error('[Send OTP] Resend API error response:', resendResponse);
      return {
        statusCode: 502,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'Failed to dispatch verification email',
          details: resendResponse.data?.message || 'Upstream provider error'
        })
      };
    }

  } catch (err) {
    console.error('[Send OTP] Execution exception:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({
        success: false,
        error: 'Internal server error while dispatching OTP',
        details: err.message
      })
    };
  }
};
