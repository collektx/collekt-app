try { require('dotenv').config(); } catch(e){}
const crypto = require('crypto');
const { supabase } = require('./lib/supabase-client');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * Dispatch an email using Resend API
 */
async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = (process.env.RESEND_API_KEY || process.env.RESEND_API || '').trim();
  if (!apiKey) {
    console.warn('[auth-otp] RESEND_API_KEY is not configured in environment');
    return { ok: false, error: 'RESEND_API_KEY missing' };
  }

  const fromSender = process.env.RESEND_FROM || 'Kolly from Collekt <Kolly@collektng.com>';
  const replyToAddress = process.env.RESEND_REPLY_TO || 'Kolly@collektng.com';

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
        reply_to: replyToAddress,
        subject: subject,
        html: html,
        text: text,
        headers: {
          'X-Entity-Ref-ID': crypto.randomUUID()
        }
      })
    });

    let resJson = await res.json().catch(() => ({}));
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 650));
      const rateRetry = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromSender,
          to: Array.isArray(to) ? to : [to],
          reply_to: replyToAddress,
          subject: subject,
          html: html,
          text: text,
          headers: {
            'X-Entity-Ref-ID': crypto.randomUUID()
          }
        })
      });
      const rateRetryJson = await rateRetry.json().catch(() => ({}));
      if (rateRetry.ok) {
        return { ok: true, status: rateRetry.status, data: rateRetryJson };
      }
      resJson = rateRetryJson;
    }

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
            text: text,
            headers: {
              'X-Entity-Ref-ID': crypto.randomUUID()
            }
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
  const apiKey = (process.env.RESEND_API_KEY || process.env.RESEND_API || '').trim();
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
 * Generate 6-digit OTP Email Template with Purpose Awareness
 */
function getOtpEmailContent({ code, firstName, purpose }) {
  const greetingName = firstName ? ` ${firstName}` : '';
  let subject = `Your Collekt Verification Code: ${code}`;
  let title = 'Verify Your Collekt Account';
  let bannerSub = 'One-Time Email Verification Code';
  let intro = `Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, welcome to Collekt. Use the verification code below to verify your email address and activate access to your dashboard:`;
  let textIntro = `Thank you for signing up for Collekt. To complete your registration and access your dashboard, please enter this 6-digit verification code:`;

  if (purpose === 'pin_setup' || purpose === 'create_pin') {
    subject = `Your Collekt Transaction PIN Setup Code: ${code}`;
    title = 'Authorize Transaction PIN Setup';
    bannerSub = 'Transaction PIN Authorization';
    intro = `Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, you requested to set up or change your confidential 4-digit Transaction PIN. Use the verification code below to authorize this financial security configuration:`;
    textIntro = `You requested to set up or change your 4-digit Transaction PIN. Use this 6-digit verification code to proceed:`;
  } else if (purpose === '2fa_setup' || purpose === 'two_factor') {
    subject = `Your Collekt Two-Factor Authentication Code: ${code}`;
    title = 'Enable Two-Factor Authentication';
    bannerSub = 'Two-Factor Authentication Setup';
    intro = `Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, you requested to enable Two-Factor Authentication on your Collekt account. Use the verification code below to confirm and activate this security layer:`;
    textIntro = `You requested to enable Two-Factor Authentication. Use this 6-digit verification code to confirm:`;
  } else if (purpose === 'password_change' || purpose === 'change_password') {
    subject = `Your Collekt Password Change Code: ${code}`;
    title = 'Authorize Password Change';
    bannerSub = 'Password Change Security Authorization';
    intro = `Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, you requested to change your Collekt account password. Use the verification code below to authorize this password update:`;
    textIntro = `You requested to change your Collekt account password. Use this 6-digit verification code to authorize:`;
  } else if (purpose === 'pin_reset') {
    subject = `Your Collekt Transaction PIN Reset Code: ${code}`;
    title = 'Reset Your Transaction PIN';
    bannerSub = 'Transaction PIN Reset Authorization';
    intro = `Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, you requested to reset your 4-digit Transaction PIN. Use the verification code below to authorize setting a new PIN:`;
    textIntro = `You requested to reset your Transaction PIN. Use this 6-digit verification code to proceed:`;
  }

  const text = `Your Collekt Security Code is: ${code}\n\nHi${greetingName},\n\n${textIntro}\n\n${code}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, please secure your account immediately.\n\nBest regards,\nThe Collekt Team\nCollekt Technologies Ltd. Lagos, Nigeria`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
                Nigeria's Project &amp; Tender Infrastructure
              </span>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">Collekt Security</h1>
              <p style="color: rgba(255, 255, 255, 0.8); font-size: 13.5px; margin: 0; font-weight: 500;">
                ${bannerSub}
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <h2 style="color: #0D1F1E; font-size: 20px; font-weight: 800; margin: 0 0 14px 0;">
                ${title}
              </h2>

              <p style="color: #4A5568; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px 0;">
                ${intro}
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
                        Valid for 10 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #718096; font-size: 13px; line-height: 1.55; margin: 0 0 16px 0; background: #FFFBEB; border-left: 3px solid #D4920B; padding: 10px 14px; border-radius: 6px;">
                <strong>Security Notice:</strong> Never share this code with anyone. Collekt staff will never ask for your verification code.
              </p>

              <p style="color: #A0AEC0; font-size: 12px; line-height: 1.5; margin: 0;">
                If you did not initiate this request, please secure your account credentials immediately.
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

  return { text, html, subject };
}

/**
 * Generate Security Alert Email for Logins
 */
function getLoginAlertEmailContent({ name, email, location, device, ip, time, resetUrl }) {
  const greetingName = name ? ` ${name}` : '';
  const subject = `Security Alert: New sign-in to your Collekt account (${location})`;

  const text = `Security Alert: New Sign-In to Collekt\n\nHi${greetingName},\n\nWe detected a new sign-in to your Collekt account (${email}).\n\nSign-in details:\n- Date & Time: ${time}\n- Device / Browser: ${device}\n- Approximate Location: ${location}\n- IP Address: ${ip}\n\nWas this you?\nIf you recently signed in, you can safely ignore this email.\n\nWas this NOT you?\nIf you did not sign in or suspect unauthorized activity, someone else may have accessed your account. Change your password immediately to protect your funds and profile:\n\n${resetUrl}\n\nBest regards,\nCollekt Security Team\nCollekt Technologies Ltd. Lagos, Nigeria`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert: New Sign-in</title>
</head>
<body style="margin: 0; padding: 0; background-color: #040F0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0D1F1E;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #040F0E; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.4);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 60%, #13756F 100%); padding: 36px 32px 30px; text-align: center;">
              <span style="display: inline-block; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.45); color: #FBBF24; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                Account Security Alert
              </span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em;">New Sign-In Detected</h1>
              <p style="color: rgba(255, 255, 255, 0.85); font-size: 13.5px; margin: 0; font-weight: 500;">
                Login alert notification for your Collekt account
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 34px 32px 28px;">
              <h2 style="color: #0D1F1E; font-size: 19px; font-weight: 800; margin: 0 0 12px 0;">
                We noticed a new sign-in to your account
              </h2>

              <p style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi${greetingName ? ' <strong>' + greetingName + '</strong>' : ''}, a new sign-in was recorded for <strong>${email}</strong> with the following session details:
              </p>

              <!-- Session Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAF9; border: 1px solid #E2EAE9; border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; color: #718096; width: 38%;">Date &amp; Time</td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; font-weight: 700; color: #0D1F1E;">${time}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; color: #718096;">Location</td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; font-weight: 700; color: #0E3B35;">${location}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; color: #718096;">Device / Browser</td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2EAE9; font-size: 13px; font-weight: 700; color: #0D1F1E;">${device}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; font-size: 13px; color: #718096;">IP Address</td>
                  <td style="padding: 12px 18px; font-size: 13px; font-family: monospace; font-weight: 700; color: #0D1F1E;">${ip}</td>
                </tr>
              </table>

              <!-- Action Card -->
              <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="color: #92400E; font-size: 13.5px; font-weight: 700; margin-bottom: 4px;">
                  Was this NOT you?
                </div>
                <p style="color: #78350F; font-size: 13px; line-height: 1.5; margin: 0 0 14px 0;">
                  If you did not initiate this sign-in, your account credentials may have been compromised. Change your password immediately to secure your account, earnings, and escrow funds.
                </p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" style="display: inline-block; background-color: #B45309; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; padding: 12px 24px; border-radius: 10px; box-shadow: 0 4px 12px rgba(180, 83, 9, 0.3);">
                    Change Your Password Immediately &rarr;
                  </a>
                </div>
              </div>

              <p style="color: #718096; font-size: 12px; line-height: 1.5; margin: 0;">
                If this sign-in was initiated by you, you can safely disregard this message. You received this email because <em>Login Alerts</em> are turned ON in your security settings.
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

  return { text, html, subject };
}

/**
 * Generate Welcome Email Template (Sent AFTER OTP is verified)
 */
function getWelcomeEmailContent({ firstName, role }) {
  const greetingName = firstName || 'Collektor';
  const isCompany = role === 'company';
  const targetDashboardUrl = isCompany ? 'https://collektng.com/company-dashboard.html' : 'https://collektng.com/dashboard.html';
  const subject = `Welcome to Collekt, ${greetingName}! (Account Verified)`;

  const text = `Welcome to Collekt!\n\nHi ${greetingName},\n\nWelcome to the Collekt Family! I'm Kolly from Collekt, and your account email has now been verified.\n\nCollekt is built specifically for verified Nigerian energy, EPC, engineering, and project specialists and companies.\n\nHere is what you can do right away:\n- Explore Verified Tenders & Projects: Discover curated engineering, EPC, oil & gas, and infrastructure opportunities in the Marketplace.\n- Complete Your Professional Profile: Showcase your credentials, COREN / industry certifications, and project track record.\n- Structured Project Milestones: Collaborate seamlessly with verified companies and professionals across Nigeria.\n\nGo to your dashboard: ${targetDashboardUrl}\n\nIf you ever have questions or need assistance, simply reply directly to this email (${ 'Kolly@collektng.com' }).\n\nKind regards,\nKolly from Collekt\nCollekt Technologies Ltd. Lagos, Nigeria`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Collekt</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f7f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0D1F1E;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2eae9; overflow: hidden; box-shadow: 0 8px 28px rgba(14, 59, 53, 0.08);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 65%, #13756F 100%); padding: 30px 28px 24px; text-align: center;">
      <img src="https://resend-attachments.s3.amazonaws.com/cedf0c5f-1108-47d6-ae7c-ccfbfd20a6ae" alt="Collekt" width="96" style="display: inline-block; border-radius: 8px; margin-bottom: 12px; border: none; outline: none;" />
      <div style="display: block;">
        <span style="display: inline-block; background: rgba(212, 146, 11, 0.2); border: 1px solid rgba(212, 146, 11, 0.45); color: #FBBF24; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; letter-spacing: 0.05em;">
          ACCOUNT VERIFIED &bull; WELCOME ABOARD
        </span>
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 12px 0 4px 0; letter-spacing: -0.02em;">Welcome to the Collekt Family!</h1>
      <p style="color: rgba(255, 255, 255, 0.82); font-size: 13.5px; margin: 0; font-weight: 500;">
        Nigeria's Project, EPC &amp; Engineering Infrastructure
      </p>
    </div>

    <!-- Main Body -->
    <div style="padding: 32px 28px;">
      <p style="color: #0D1F1E; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">
        Hi ${greetingName},
      </p>

      <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0;">
        I'm <strong>Kolly</strong> from Collekt. Your email verification is complete and your account is now active! We are excited to have you on board Nigeria's dedicated network for energy, EPC, and infrastructure specialists and companies.
      </p>

      <div style="background: #f7faf9; border-left: 4px solid #13756F; padding: 18px 20px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #0E3B35; font-size: 13.5px; margin: 0 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
          Here is what you can do right away:
        </p>
        <ul style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 18px;">
          <li style="margin-bottom: 8px;"><strong>Explore Verified Projects &amp; Tenders:</strong> Browse curated opportunities across oil &amp; gas, renewables, EPC, and heavy infrastructure.</li>
          <li style="margin-bottom: 8px;"><strong>Build Your Verified Profile:</strong> Add your credentials, COREN / industry certifications, and project portfolio.</li>
          <li style="margin-bottom: 0;"><strong>Collaborate with Confidence:</strong> Connect with verified Nigerian companies and engineering professionals.</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${targetDashboardUrl}" style="background-color: #0E3B35; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 800; font-size: 14.5px; display: inline-block;">
          Go to Your Dashboard &rarr;
        </a>
      </div>

      <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        If you ever have any questions or need assistance setting up your profile, simply reply directly to this email (<a href="mailto:Kolly@collektng.com" style="color: #13756F; font-weight: 700; text-decoration: none;">Kolly@collektng.com</a>).
      </p>

      <p style="color: #0D1F1E; font-size: 14px; line-height: 1.5; margin: 0;">
        Kind regards,<br>
        <strong>Kolly from Collekt</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8faf9; padding: 18px 28px; text-align: center; border-top: 1px solid #e2eae9;">
      <p style="color: #8898aa; font-size: 12px; margin: 0 0 4px 0;">
        &copy; 2026 Collekt Technologies Ltd. Lagos, Nigeria. All rights reserved.
      </p>
      <p style="color: #a0aec0; font-size: 11px; margin: 0;">
        NDPA 2023 Compliant &bull; CAMA 2020 Registered
      </p>
    </div>

  </div>
</body>
</html>`;

  return { subject, text, html };
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
  const purpose = (body.purpose || '').trim().toLowerCase();

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

      // 4. Send OTP email via Resend with purpose awareness
      const firstName = name ? name.split(' ')[0] : '';
      const emailContent = getOtpEmailContent({ code, firstName, purpose });

      const sendResult = await sendResendEmail({
        to: email,
        subject: emailContent.subject,
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
          email_delivered: Boolean(sendResult.ok),
          fallback_code: sendResult.ok ? undefined : code,
          delivery_warning: sendResult.ok ? undefined : (sendResult.error || 'Email delivery provider requires API key update'),
          message: sendResult.ok
            ? 'Verification code sent to your email address.'
            : `Email gateway notice: ${sendResult.error || 'Provider offline'}. Your instant verification code is ${code}.`,
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
        await supabase.rpc('verify_user_otp', { p_email: email });
      } catch (rpcErr) {
        console.warn('[auth-otp] verify_user_otp RPC notice:', rpcErr.message);
      }

      try {
        await supabase
          .from('profiles')
          .update({
            email_verified: true,
            otp_verified: true,
            otp_verified_at: nowIso,
            updated_at: nowIso
          })
          .ilike('email', email);
      } catch (profErr) {
        console.warn('[auth-otp] Profile update notice:', profErr.message);
      }

      // Resolve name and role from DB if not provided in request body
      let resolvedFirstName = firstName;
      let resolvedLastName = lastName;
      let resolvedRole = role;
      if (!resolvedFirstName && supabase) {
        try {
          const { data: profRow } = await supabase
            .from('profiles')
            .select('name, role')
            .ilike('email', email)
            .maybeSingle();
          if (profRow) {
            if (profRow.name) {
              resolvedFirstName = profRow.name.split(' ')[0];
              resolvedLastName = profRow.name.split(' ').slice(1).join(' ');
            }
            if (profRow.role) {
              resolvedRole = profRow.role;
            }
          }
        } catch (e) {}
      }

      // 6. Send the Official Welcome Email via Resend FIRST (before contact sync to avoid rate-limit collision)
      const welcomeContent = getWelcomeEmailContent({ firstName: resolvedFirstName, role: resolvedRole });
      const welcomeSendResult = await sendResendEmail({
        to: email,
        subject: welcomeContent.subject || 'Welcome to Collekt! (Account Verified)',
        html: welcomeContent.html,
        text: welcomeContent.text
      });

      if (!welcomeSendResult.ok) {
        console.warn('[auth-otp] Welcome email send notice:', welcomeSendResult);
      } else {
        console.log(`[auth-otp] Welcome email dispatched successfully to ${email}`);
      }

      // 7. Sync contact with Resend after email dispatch
      syncResendContact({ email, firstName: resolvedFirstName, lastName: resolvedLastName }).catch(() => {});

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          verified: true,
          welcome_email_sent: Boolean(welcomeSendResult && welcomeSendResult.ok),
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

  /* ========================================================
     ACTION: SEND_WELCOME (Explicit or Fallback Welcome Email)
     ======================================================== */
  if (action === 'send_welcome') {
    try {
      let resolvedFirstName = name ? name.split(' ')[0] : '';
      let resolvedRole = role || 'professional';
      if (!resolvedFirstName && supabase) {
        try {
          const { data: profRow } = await supabase
            .from('profiles')
            .select('name, role')
            .ilike('email', email)
            .maybeSingle();
          if (profRow) {
            if (profRow.name) resolvedFirstName = profRow.name.split(' ')[0];
            if (profRow.role) resolvedRole = profRow.role;
          }
        } catch (e) {}
      }

      const welcomeContent = getWelcomeEmailContent({ firstName: resolvedFirstName, role: resolvedRole });
      const welcomeSendResult = await sendResendEmail({
        to: email,
        subject: welcomeContent.subject || 'Welcome to Collekt! (Account Verified)',
        html: welcomeContent.html,
        text: welcomeContent.text
      });

      return {
        statusCode: welcomeSendResult.ok ? 200 : 500,
        headers,
        body: JSON.stringify({
          success: Boolean(welcomeSendResult.ok),
          welcome_email_sent: Boolean(welcomeSendResult.ok),
          message: welcomeSendResult.ok ? 'Welcome email sent.' : (welcomeSendResult.error || 'Could not send welcome email.')
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message })
      };
    }
  }

  /* ========================================================
     ACTION: SEND_RESET_OTP (Password Recovery / Set Password for Google & Email Users)
     ======================================================== */
  if (action === 'send_reset_otp') {
    try {
      // 1. Verify account exists in profiles or auth.users
      let firstName = name ? name.split(' ')[0] : '';
      if (supabase) {
        try {
          const { data: profRow } = await supabase
            .from('profiles')
            .select('name, first_name')
            .ilike('email', email)
            .maybeSingle();
          if (profRow) {
            firstName = profRow.first_name || (profRow.name ? profRow.name.split(' ')[0] : '');
          }
        } catch (e) {}
      }

      // 2. Generate cryptographically secure 6-digit numeric reset OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      if (supabase) {
        await supabase
          .from('auth_otps')
          .update({ verified: true })
          .eq('email', email)
          .eq('verified', false);

        await supabase
          .from('auth_otps')
          .insert({
            email,
            code_hash: codeHash,
            expires_at: expiresAt,
            verified: false,
            attempts: 0
          });
      }

      const resetLink = `https://collektng.com/login.html?reset_email=${encodeURIComponent(email)}&reset_code=${code}`;
      const greeting = firstName ? ` ${firstName}` : '';
      const resetText = `Collekt Password Reset Code: ${code}\n\nHi${greeting},\n\nWe received a request to reset or set the password for your Collekt account (${email}).\n\nYour 6-Digit Password Reset Code is:\n\n${code}\n\nOr click the link below to open the password reset dialog directly:\n${resetLink}\n\nThis code expires in 10 minutes. If you signed in with Google previously, setting a password here allows you to sign in using either Google or your email and password.\n\nBest regards,\nKolly from Collekt\nCollekt Technologies Ltd. Lagos, Nigeria`;

      const resetHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Collekt Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #040F0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0D1F1E;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #040F0E; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.4);">
          <tr>
            <td style="background: linear-gradient(135deg, #040F0E 0%, #0E3B35 60%, #13756F 100%); padding: 34px 32px 28px; text-align: center;">
              <span style="display: inline-block; background: rgba(212, 146, 11, 0.2); border: 1px solid rgba(212, 146, 11, 0.4); color: #D4920B; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                Account Security &amp; Password Recovery
              </span>
              <h1 style="color: #ffffff; font-size: 25px; font-weight: 800; margin: 0 0 6px 0;">Reset Your Password</h1>
              <p style="color: rgba(255, 255, 255, 0.82); font-size: 13.5px; margin: 0;">
                Collekt Account Recovery &bull; Works for Email &amp; Google Accounts
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 34px 32px 28px;">
              <p style="color: #4A5568; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi${greeting ? ' <strong>' + greeting + '</strong>' : ''}, enter the 6-digit recovery code below on the Collekt login screen to set your new password:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #F4F7F6; border: 2px dashed #13756F; border-radius: 14px; padding: 20px 28px; display: inline-block; text-align: center; max-width: 320px; width: 100%; box-sizing: border-box;">
                      <div style="color: #6B8280; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">
                        Password Reset Code
                      </div>
                      <div style="font-family: 'SF Pro Display', -apple-system, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #0E3B35; margin: 4px 0 6px 12px;">
                        ${code}
                      </div>
                      <div style="color: #D4920B; font-size: 12px; font-weight: 700;">
                        Valid for 10 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${resetLink}" style="background-color: #0E3B35; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block;">
                  Open Password Reset Screen &rarr;
                </a>
              </div>
              <p style="color: #718096; font-size: 12.5px; line-height: 1.55; margin: 0; background: #FFFBEB; border-left: 3px solid #D4920B; padding: 10px 14px; border-radius: 6px;">
                <strong>Note for Google Sign-In Users:</strong> Setting a password here links email+password login to your Google account so you can sign in using either method anytime.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8FAF9; padding: 20px 32px; text-align: center; border-top: 1px solid #E2EAE9;">
              <p style="color: #8898AA; font-size: 12px; margin: 0;">
                &copy; 2026 Collekt Technologies Ltd. Lagos, Nigeria
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const sendResult = await sendResendEmail({
        to: email,
        subject: `Reset Your Collekt Password (Code: ${code})`,
        html: resetHtml,
        text: resetText
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          email_delivered: Boolean(sendResult.ok),
          fallback_code: sendResult.ok ? undefined : code,
          message: sendResult.ok
            ? `Password recovery code sent to ${email}.`
            : `Instant recovery code generated: ${code}.`
        })
      };
    } catch (err) {
      console.error('[auth-otp] send_reset_otp error:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Could not send password recovery code. Please try again.' })
      };
    }
  }

  /* ========================================================
     ACTION: RESET_PASSWORD (Verify 6-digit code & update password)
     ======================================================== */
  if (action === 'reset_password') {
    const rawCode = (body.code || '').toString().trim();
    const newPassword = (body.new_password || body.password || '').toString();

    if (!rawCode || rawCode.length !== 6 || !/^\d{6}$/.test(rawCode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Please enter the 6-digit recovery code sent to your email.' })
      };
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Your new password must be at least 8 characters long.' })
      };
    }

    try {
      const codeHash = crypto.createHash('sha256').update(`${email}:${rawCode}`).digest('hex');
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_otp_and_reset_password', {
        p_email: email,
        p_code_hash: codeHash,
        p_new_password: newPassword
      });

      if (rpcErr) {
        console.error('[auth-otp] verify_otp_and_reset_password RPC error:', rpcErr);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: rpcErr.message || 'Could not update password.' })
        };
      }

      if (!rpcRes || !rpcRes.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: (rpcRes && rpcRes.error) || 'Invalid or expired recovery code.'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Your password has been updated! You can now sign in with your email and new password.'
        })
      };
    } catch (err) {
      console.error('[auth-otp] reset_password exception:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to update password. Please try again.' })
      };
    }
  }

  /* ========================================================
     ACTION: LOGIN_ALERT (Conditional New Device Sign-In Notification)
     ======================================================== */
  if (action === 'login_alert') {
    try {
      // 1. Resolve client IP and geographic location from Netlify headers or payload
      const clientIp = (
        (event.headers && (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.headers['x-forwarded-for'])) ||
        body.ip ||
        '102.89.23.41'
      ).split(',')[0].trim();

      let location = (body.location || '').trim();
      if (!location && event.headers && event.headers['x-nf-geo']) {
        try {
          const geo = JSON.parse(event.headers['x-nf-geo']);
          const parts = [geo.city, geo.subdivision_name, geo.country_name].filter(Boolean);
          if (parts.length > 0) location = parts.join(', ');
        } catch(e){}
      }
      if (!location) location = 'Lagos, Nigeria';

      const device = (body.device || (event.headers && event.headers['user-agent']) || 'Web Browser').trim();
      const firstName = name ? name.split(' ')[0] : 'Collektor';

      const now = new Date();
      const timeFormatted = now.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'medium',
        timeStyle: 'short'
      }) + ' WAT';

      const resetUrl = `https://collektng.com/login.html?reset_email=${encodeURIComponent(email)}`;

      // 2. Generate and dispatch security alert email via Resend
      const alertContent = getLoginAlertEmailContent({
        name: firstName,
        email,
        location,
        device,
        ip: clientIp,
        time: timeFormatted,
        resetUrl
      });

      const sendResult = await sendResendEmail({
        to: email,
        subject: alertContent.subject,
        html: alertContent.html,
        text: alertContent.text
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          email_delivered: Boolean(sendResult.ok),
          message: sendResult.ok ? 'Login alert notification delivered.' : 'Login alert triggered (notification provider notice).'
        })
      };
    } catch (err) {
      console.error('[auth-otp] login_alert exception:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message || 'Failed to dispatch login alert.' })
      };
    }
  }

  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ success: false, error: `Unsupported action: '${action}'.` })
  };
};
