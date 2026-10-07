const crypto = require('crypto');
const { supabase } = require('./lib/supabase-client');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * Dispatch an email using Resend API
 */
async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[auth-otp] RESEND_API_KEY is not configured in environment');
    return { ok: false, error: 'RESEND_API_KEY missing' };
  }

  const fromSender = process.env.RESEND_FROM || 'Kolly from Collekt <Kolly@collektng.com>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromSender,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
        text: text
      })
    });

    const resJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[auth-otp] Resend API error response:', res.status, resJson);
      // If custom domain has an issue, try fallback to onboarding@resend.dev
      if (resJson && resJson.message && resJson.message.includes('domain') && !fromSender.includes('onboarding@resend.dev')) {
        console.log('[auth-otp] Retrying with onboarding@resend.dev fallback...');
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Collekt Verification <onboarding@resend.dev>',
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html,
            text: text
          })
        });
        const retryJson = await retryRes.json().catch(() => ({}));
        return { ok: retryRes.ok, status: retryRes.status, data: retryJson };
      }
      return { ok: false, status: res.status, error: resJson.message || 'Resend error' };
    }

    return { ok: true, status: res.status, data: resJson };
  } catch (err) {
    console.error('[auth-otp] Fetch to Resend failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Add or sync contact in Resend Audience
 */
async function syncResendContact({ email, firstName, lastName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
        unsubscribed: false
      })
    });
  } catch (e) {
    console.warn('[auth-otp] Resend contact sync warning:', e.message);
  }
}

/**
 * Generate 6-digit OTP Email Template
 */
function getOtpEmailContent({ code, firstName }) {
  const greetingName = firstName ? ` ${firstName}` : '';
  const text = `Your Collekt Verification Code is: ${code}\n\nHi${greetingName},\n\nThank you for signing up for Collekt. To complete your registration and access your dashboard, please enter this 6-digit verification code:\n\n${code}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, please ignore this email.\n\nBest regards,\nThe Collekt Team\nCollekt Technologies Ltd. Lagos, Nigeria`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collekt Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #040F0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0D1F1E;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #040F0E; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.4);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 60%, #13756F 100%); padding: 36px 32px 30px; text-align: center;">
              <span style="display: inline-block; background: rgba(212, 146, 11, 0.2); border: 1px solid rgba(212, 146, 11, 0.4); color: #D4920B; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                🇳🇬 Nigeria's Project &amp; Tender Infrastructure
              </span>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">Collekt Security</h1>
              <p style="color: rgba(255, 255, 255, 0.8); font-size: 13.5px; margin: 0; font-weight: 500;">
                One-Time Email Verification Code
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <h2 style="color: #0D1F1E; font-size: 20px; font-weight: 800; margin: 0 0 14px 0;">
                Verify Your Collekt Account 🔐
              </h2>

              <p style="color: #4A5568; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, welcome to Collekt. Use the verification code below to verify your email address and activate access to your dashboard:
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 24px;">
                <tr>
                  <td align="center">
                    <div style="background-color: #F4F7F6; border: 2px dashed #13756F; border-radius: 14px; padding: 22px 28px; display: inline-block; text-align: center; max-width: 320px; width: 100%; box-sizing: border-box;">
                      <div style="color: #6B8280; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">
                        Your 6-Digit Code
                      </div>
                      <div style="font-family: 'SF Pro Display', -apple-system, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #0E3B35; margin: 4px 0 6px 12px;">
                        ${code}
                      </div>
                      <div style="color: #D4920B; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                        ⏱ Valid for 10 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #718096; font-size: 13px; line-height: 1.55; margin: 0 0 16px 0; background: #FFFBEB; border-left: 3px solid #D4920B; padding: 10px 14px; border-radius: 6px;">
                <strong>Security Notice:</strong> Never share this code with anyone. Collekt staff will never ask for your verification code.
              </p>

              <p style="color: #A0AEC0; font-size: 12px; line-height: 1.5; margin: 0;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAF9; padding: 22px 32px; text-align: center; border-top: 1px solid #E2EAE9;">
              <p style="color: #8898AA; font-size: 12px; line-height: 1.5; margin: 0 0 4px 0;">
                &copy; 2026 Collekt Technologies Ltd. All rights reserved.
              </p>
              <p style="color: #A0AEC0; font-size: 11px; margin: 0;">
                NDPA 2023 Compliant &bull; CAMA 2020 Registered &bull; Lagos, Nigeria
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { text, html };
}

/**
 * Generate Welcome Email Template (Sent AFTER OTP is verified)
 */
function getWelcomeEmailContent({ firstName, role }) {
  const greetingName = firstName || 'there';
  const isCompany = role === 'company';
  const targetDashboardUrl = isCompany ? 'https://collektng.com/company-dashboard.html' : 'https://collektng.com/dashboard.html';

  const text = `Welcome to Collekt! 🇳🇬\n\nHi ${greetingName},\n\nI'm Kolly from Collekt. We're excited to have you join Nigeria's dedicated project and tender infrastructure for energy, EPC, and engineering!\n\nHere is what you can do right away:\n- Browse High-Value Tenders: Discover curated contracts across oil & gas, renewables, EPC, and heavy infrastructure.\n- Build Your Verified Reputation: Showcase your credentials, past project delivery, and verified shield status.\n- Guaranteed Milestone Payments: Work confidently with escrow-secured contracts and instant NUBAN payouts.\n\nAccess your account here:\n${targetDashboardUrl}\n\nIf you ever have any questions or need help with your profile or posting tenders, feel free to reply directly to this email at Kolly@collektng.com.\n\nBest regards,\nKolly from Collekt\nCollekt Technologies Ltd. Lagos, Nigeria`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Collekt</title>
</head>
<body style="margin: 0; padding: 0; background-color: #040F0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0D1F1E;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #040F0E; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.35);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 60%, #13756F 100%); padding: 36px 32px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background: rgba(212, 146, 11, 0.2); border: 1px solid rgba(212, 146, 11, 0.4); color: #D4920B; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                      🇳🇬 Nigeria's Project &amp; Tender Infrastructure
                    </span>
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">Collekt</h1>
                    <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px; margin: 0; font-weight: 500;">
                      Energy &bull; EPC &bull; Engineering &bull; Infrastructure
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="color: #0D1F1E; font-size: 22px; font-weight: 800; margin: 0 0 16px 0;">
                Welcome aboard, ${greetingName}! 🎉
              </h2>

              <p style="color: #4A5568; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0;">
                I'm <strong>Kolly</strong>, your partner and mascot here at Collekt. We’re thrilled to have you join Nigeria's dedicated marketplace for energy and EPC contracting.
              </p>

              <p style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Connecting you with Nigeria’s top energy, EPC, and infrastructure opportunities.
              </p>

              <!-- Feature Highlights Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F4F7F6; border-left: 4px solid #13756F; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 20px 16px 20px;">
                    <h3 style="color: #0E3B35; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.04em;">
                      What you can do right now:
                    </h3>
                    <ul style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 18px;">
                      <li style="margin-bottom: 8px;"><strong>Browse High-Value Tenders:</strong> Discover curated contracts across oil &amp; gas, renewables, EPC, and heavy infrastructure.</li>
                      <li style="margin-bottom: 8px;"><strong>Build Your Verified Reputation:</strong> Showcase your credentials, past project delivery, and verified shield status.</li>
                      <li style="margin-bottom: 8px;"><strong>Guaranteed Milestone Payments:</strong> Work confidently with escrow-secured contracts and instant NUBAN payouts.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${targetDashboardUrl}" style="background-color: #0E3B35; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(14, 59, 53, 0.25);">
                      Explore Marketplace &amp; Tenders &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Founder / Direct Help Note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #E2EAE9; padding-top: 20px; margin-top: 10px;">
                <tr>
                  <td>
                    <p style="color: #6B8280; font-size: 13.5px; line-height: 1.6; margin: 0 0 6px 0;">
                      Need assistance setting up or have a project you'd like guidance posting?
                    </p>
                    <p style="color: #0E3B35; font-size: 13.5px; font-weight: 700; margin: 0;">
                      Just reply directly to this email (<a href="mailto:Kolly@collektng.com" style="color: #13756F; text-decoration: none;">Kolly@collektng.com</a>) and our team will get right back to you.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAF9; padding: 24px 32px; text-align: center; border-top: 1px solid #E2EAE9;">
              <p style="color: #8898AA; font-size: 12px; line-height: 1.5; margin: 0 0 6px 0;">
                &copy; 2026 Collekt Technologies Ltd. All rights reserved.
              </p>
              <p style="color: #A0AEC0; font-size: 11px; margin: 0;">
                Protected Escrow Infrastructure &bull; CAMA 2020 Registered &bull; NDPA 2023 Compliant &bull; Lagos, Nigeria
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { text, html };
}

/**
 * Main Serverless Handler
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  const headers = corsHeaders(event);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  // Rate Limiting (max 20 requests/min per IP)
  const rateLimit = enforceRateLimit(event, {
    action: 'auth-otp',
    limit: 20,
    windowMs: 60 * 1000,
    customHeaders: headers
  });
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON request payload' })
    };
  }

  const action = (body.action || '').trim().toLowerCase();
  const rawEmail = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const role = (body.role || 'professional').trim();

  if (!rawEmail || !rawEmail.includes('@')) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'A valid email address is required.' })
    };
  }

  const email = rawEmail;

  /* ========================================================
     ACTION: SEND_OTP / RESEND_OTP
     ======================================================== */
  if (action === 'send_otp' || action === 'resend_otp') {
    try {
      // 1. Check if a code was already generated within the last 25 seconds (cooldown)
      if (supabase) {
        const { data: recentOtps } = await supabase
          .from('auth_otps')
          .select('created_at, expires_at')
          .eq('email', email)
          .eq('verified', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentOtps && recentOtps.length > 0) {
          const diffMs = Date.now() - new Date(recentOtps[0].created_at).getTime();
          if (diffMs < 25000) {
            const waitSec = Math.ceil((25000 - diffMs) / 1000);
            return {
              statusCode: 429,
              headers,
              body: JSON.stringify({
                success: false,
                error: `Please wait ${waitSec} seconds before requesting another code.`
              })
            };
          }
        }
      }

      // 2. Generate cryptographically secure 6-digit numeric OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // 3. Invalidate prior unverified codes for this email
      if (supabase) {
        await supabase
          .from('auth_otps')
          .update({ verified: true })
          .eq('email', email)
          .eq('verified', false);

        // Insert new OTP record
        const { error: insertErr } = await supabase
          .from('auth_otps')
          .insert({
            email,
            code_hash: codeHash,
            expires_at: expiresAt,
            verified: false,
            attempts: 0
          });

        if (insertErr) {
          console.warn('[auth-otp] DB insert notice:', insertErr.message);
        }
      }

      // 4. Send OTP email via Resend
      const firstName = name ? name.split(' ')[0] : '';
      const emailContent = getOtpEmailContent({ code, firstName });

      const sendResult = await sendResendEmail({
        to: email,
        subject: `Your Collekt Verification Code: ${code} 🔐`,
        html: emailContent.html,
        text: emailContent.text
      });

      if (!sendResult.ok) {
        console.warn('[auth-otp] Resend delivery notice:', sendResult);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Verification code sent to your email address.',
          expires_in: 600
        })
      };
    } catch (err) {
      console.error('[auth-otp] Send OTP exception:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Could not send verification code. Please try again.' })
      };
    }
  }

  /* ========================================================
     ACTION: VERIFY_OTP
     ======================================================== */
  if (action === 'verify_otp') {
    const rawCode = (body.code || '').toString().trim();
    if (!rawCode || rawCode.length !== 6 || !/^\d{6}$/.test(rawCode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Please enter a valid 6-digit verification code.' })
      };
    }

    try {
      if (!supabase) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Database service is currently unreachable.' })
        };
      }

      // 1. Fetch the latest active OTP record for this email
      const { data: records, error: fetchErr } = await supabase
        .from('auth_otps')
        .select('*')
        .eq('email', email)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchErr || !records || records.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Verification code has expired or was not found. Please request a new code.'
          })
        };
      }

      const otpRecord = records[0];

      // 2. Prevent brute force attempts
      if ((otpRecord.attempts || 0) >= 5) {
        await supabase
          .from('auth_otps')
          .update({ verified: true })
          .eq('id', otpRecord.id);

        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.'
          })
        };
      }

      // 3. Cryptographically compare submitted code with stored hash
      const submittedHash = crypto.createHash('sha256').update(`${email}:${rawCode}`).digest('hex');
      const hashMatch = crypto.timingSafeEqual(
        Buffer.from(submittedHash, 'utf8'),
        Buffer.from(otpRecord.code_hash, 'utf8')
      );

      if (!hashMatch) {
        await supabase
          .from('auth_otps')
          .update({ attempts: (otpRecord.attempts || 0) + 1 })
          .eq('id', otpRecord.id);

        const remaining = 5 - ((otpRecord.attempts || 0) + 1);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Incorrect verification code. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Please request a new code.'}`
          })
        };
      }

      // 4. Code is correct! Mark OTP as verified
      await supabase
        .from('auth_otps')
        .update({ verified: true })
        .eq('id', otpRecord.id);

      // 5. Update user profile to record verified email and OTP
      const nowIso = new Date().toISOString();
      const firstName = name ? name.split(' ')[0] : '';
      const lastName = name ? name.split(' ').slice(1).join(' ') : '';

      try {
        await supabase
          .from('profiles')
          .update({
            email_verified: true,
            otp_verified: true,
            otp_verified_at: nowIso,
            updated_at: nowIso
          })
          .eq('email', email);
      } catch (profErr) {
        console.warn('[auth-otp] Profile update notice:', profErr.message);
      }

      // 6. Sync contact with Resend
      syncResendContact({ email, firstName, lastName }).catch(() => {});

      // 7. Send the Official Welcome Email via Resend!
      const welcomeContent = getWelcomeEmailContent({ firstName, role });
      const welcomeSendResult = await sendResendEmail({
        to: email,
        subject: 'Welcome to Collekt — Start Discovering Contracts & Tenders 🇳🇬',
        html: welcomeContent.html,
        text: welcomeContent.text
      });

      if (!welcomeSendResult.ok) {
        console.warn('[auth-otp] Welcome email send notice:', welcomeSendResult);
      } else {
        console.log(`[auth-otp] Welcome email dispatched successfully to ${email}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          verified: true,
          message: 'Email verified successfully! Welcome to Collekt.'
        })
      };
    } catch (err) {
      console.error('[auth-otp] Verify OTP exception:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Internal error verifying code. Please try again.' })
      };
    }
  }

  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ success: false, error: `Unsupported action: '${action}'.` })
  };
};
