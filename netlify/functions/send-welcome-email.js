const https = require('https');
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
 * Generate responsive, branded HTML email for Collekt
 */
function generateWelcomeEmailHtml({ name, firstName, role, companyName }) {
  const isCompany = role === 'company';
  const displayName = firstName || name || 'there';
  const roleHeadline = isCompany 
    ? 'Empowering your company to source verified Nigerian energy &amp; EPC expertise'
    : 'Connecting you with Nigeria’s top energy, EPC, and infrastructure opportunities';

  const roleHighlights = isCompany ? `
    <li style="margin-bottom: 8px;"><strong>Post RFPs &amp; Tenders:</strong> Publish project requirements and receive verified proposals within 24 hours.</li>
    <li style="margin-bottom: 8px;"><strong>Verified Specialist Network:</strong> Direct access to COREN-registered engineers, project managers, and safety experts.</li>
    <li style="margin-bottom: 8px;"><strong>Protected Escrow:</strong> Fund milestones safely with CBN-regulated payment settlement and clear deliverable inspection periods.</li>
  ` : `
    <li style="margin-bottom: 8px;"><strong>Browse High-Value Tenders:</strong> Discover curated contracts across oil &amp; gas, renewables, EPC, and heavy infrastructure.</li>
    <li style="margin-bottom: 8px;"><strong>Build Your Verified Reputation:</strong> Showcase your credentials, past project delivery, and verified shield status.</li>
    <li style="margin-bottom: 8px;"><strong>Guaranteed Milestone Payments:</strong> Work confidently with escrow-secured contracts and instant NUBAN payouts.</li>
  `;

  const dashboardUrl = isCompany ? 'https://collektng.com/company-dashboard.html' : 'https://collektng.com/dashboard.html';
  const actionButtonText = isCompany ? 'Go to Company Dashboard &rarr;' : 'Explore Marketplace &amp; Tenders &rarr;';

  return `<!DOCTYPE html>
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
                Welcome aboard, ${displayName}! 🎉
              </h2>

              <p style="color: #4A5568; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0;">
                I'm <strong>Kolly</strong>, your partner and mascot here at Collekt. We’re thrilled to have you join Nigeria's dedicated marketplace for energy and EPC contracting.
              </p>

              <p style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                ${roleHeadline}.
              </p>

              <!-- Feature Highlights Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F4F7F6; border-left: 4px solid #13756F; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 20px 16px 20px;">
                    <h3 style="color: #0E3B35; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.04em;">
                      What you can do right now:
                    </h3>
                    <ul style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 18px;">
                      ${roleHighlights}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="background-color: #0E3B35; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(14, 59, 53, 0.25);">
                      ${actionButtonText}
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
                &copy; ${new Date().getFullYear()} Collekt Technologies Ltd. All rights reserved.
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
}

function generateWelcomeEmailText({ name, firstName, role, companyName }) {
  const displayName = firstName || name || 'there';
  const isCompany = role === 'company';
  const dashboardUrl = isCompany ? 'https://collektng.com/company-dashboard.html' : 'https://collektng.com/dashboard.html';

  return `Welcome to Collekt! 🇳🇬

Hi ${displayName},

I'm Kolly from Collekt. We're excited to have you join Nigeria's dedicated project and tender infrastructure for energy, EPC, and engineering!

Here is what you can do right away:
${isCompany ? `
- Post RFPs & Tenders: Publish your requirements and receive verified proposals within 24 hours.
- Verified Specialist Network: Direct access to COREN-registered engineers, project managers, and safety experts.
- Protected Escrow: Fund milestones safely with CBN-regulated payment settlement and clear deliverable inspection periods.
` : `
- Browse High-Value Tenders: Discover curated contracts across oil & gas, renewables, EPC, and heavy infrastructure.
- Build Your Verified Reputation: Showcase your credentials, past project delivery, and verified shield status.
- Guaranteed Milestone Payments: Work confidently with escrow-secured contracts and instant NUBAN payouts.
`}

Access your account here:
${dashboardUrl}

If you ever have any questions or need help with your profile or posting tenders, feel free to reply directly to this email at Kolly@collektng.com.

Best regards,
Kolly from Collekt
Collekt Technologies Ltd. Lagos, Nigeria
`;
}

/**
 * Netlify Function Handler
 * POST /api/send-welcome-email
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

  // Rate limiting: 30 requests per minute per IP to prevent spam abuse
  const rateCheck = enforceRateLimit(event, {
    action: 'send-welcome-email',
    limit: 30,
    windowMs: 60 * 1000,
    customHeaders: corsHeaders(event)
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { email, name, firstName, role, companyName } = payload;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ success: false, error: 'Valid email address is required' })
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn('[Welcome Email] RESEND_API_KEY is not configured in environment variables');
      return {
        statusCode: 500,
        headers: corsHeaders(event),
        body: JSON.stringify({ success: false, error: 'Email service configuration missing' })
      };
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanFirstName = String(firstName || '').trim();
    const cleanRole = role === 'company' ? 'company' : 'professional';

    const htmlContent = generateWelcomeEmailHtml({
      name: cleanName,
      firstName: cleanFirstName,
      role: cleanRole,
      companyName: companyName || cleanName
    });

    const textContent = generateWelcomeEmailText({
      name: cleanName,
      firstName: cleanFirstName,
      role: cleanRole,
      companyName: companyName || cleanName
    });

    const emailPayload = JSON.stringify({
      from: 'Kolly from Collekt <Kolly@collektng.com>',
      to: [cleanEmail],
      subject: cleanRole === 'company' 
        ? 'Welcome to Collekt — Source Verified EPC & Energy Talent 🇳🇬' 
        : 'Welcome to Collekt — Start Discovering Contracts & Tenders 🇳🇬',
      html: htmlContent,
      text: textContent
    });

    // 1. Send the email via Resend API
    const emailRes = await makeHttpsRequest({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailPayload)
      },
      timeout: 10000
    }, emailPayload);

    console.log('[Welcome Email] Resend response:', emailRes.status, emailRes.data);

    // 2. Also asynchronously add/update contact in Resend Audience
    try {
      const contactPayload = JSON.stringify({
        email: cleanEmail,
        first_name: cleanFirstName || cleanName.split(' ')[0] || undefined,
        last_name: cleanName.split(' ').slice(1).join(' ') || undefined,
        unsubscribed: false
      });

      makeHttpsRequest({
        hostname: 'api.resend.com',
        path: '/contacts',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(contactPayload)
        },
        timeout: 5000
      }, contactPayload).catch(e => console.warn('[Welcome Email] Audience contact sync note:', e.message));
    } catch(cErr) {
      console.warn('[Welcome Email] Contact sync exception:', cErr.message);
    }

    if (emailRes.status >= 200 && emailRes.status < 300) {
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: true,
          message: 'Welcome email sent successfully',
          id: emailRes.data && emailRes.data.id
        })
      };
    } else {
      console.error('[Welcome Email Error]:', emailRes.data);
      return {
        statusCode: emailRes.status || 500,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: (emailRes.data && emailRes.data.message) || 'Failed to send welcome email'
        })
      };
    }

  } catch (err) {
    console.error('[Welcome Email Exception]:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ success: false, error: err.message || 'Internal server error' })
    };
  }
};
