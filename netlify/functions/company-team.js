const { supabase } = require('./lib/supabase-client');
const { authenticateRequest } = require('./lib/auth-middleware');
const { corsHeaders: buildCorsHeaders, preflightResponse } = require('./lib/cors');

/**
 * Company Team & RBAC Management Function
 * Handles fetching, inviting, updating roles, and removing company team members.
 */
exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return preflightResponse(event);
  }

  const corsHeaders = buildCorsHeaders(event);

  try {
    const { user, error: authError } = await authenticateRequest(event);
    if (authError || !user) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Authentication required', details: authError }) };
    }

    // 1. GET: Fetch Team Members for a Company
    if (method === 'GET') {
      const companyId = event.queryStringParameters?.company_id;
      if (!companyId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ status: 'error', error: 'Missing company_id parameter' })
        };
      }

      const { data: companyCheck } = await supabase.from('companies').select('owner_id').eq('id', companyId).single();
      if (!companyCheck || companyCheck.owner_id !== user.id) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ status: 'error', error: 'Unauthorized: Not the company owner' }) };
      }

      const { data, error } = await supabase
        .from('company_members')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'removed')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[CompanyTeam] Supabase GET error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ status: 'error', error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ status: 'success', data: data || [] })
      };
    }

    // 2. POST: Actions (invite, remove, update_role)
    if (method === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const { action, company_id, name, email, role, member_id } = payload;
      const inviter_id = user.id;

      if (!company_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ status: 'error', error: 'Missing company_id' })
        };
      }

      const { data: companyCheck } = await supabase.from('companies').select('owner_id').eq('id', company_id).single();
      if (!companyCheck || companyCheck.owner_id !== user.id) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ status: 'error', error: 'Unauthorized: Not the company owner' }) };
      }

      // Action: INVITE
      if (action === 'invite') {
        if (!name || !email) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ status: 'error', error: 'Name and email are required' })
          };
        }

        const validRoles = ['admin', 'finance', 'member', 'viewer'];
        const assignedRole = validRoles.includes(role) ? role : 'member';
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();

        // Check if member already exists in this company
        const { data: existing } = await supabase
          .from('company_members')
          .select('*')
          .eq('company_id', company_id)
          .eq('email', cleanEmail)
          .maybeSingle();

        let memberResult = null;

        if (existing) {
          if (existing.status !== 'removed') {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({ status: 'error', error: 'A team member with this email already exists in your company.' })
            };
          } else {
            // Re-activate member
            const { data: updated, error: updateErr } = await supabase
              .from('company_members')
              .update({
                name: cleanName,
                role: assignedRole,
                status: 'pending',
                invited_by: inviter_id || null,
                invited_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)
              .select()
              .single();

            if (updateErr) throw updateErr;
            memberResult = updated;
          }
        } else {
          // Check if this email matches an existing user profile to link user_id if present
          let linkedUserId = null;
          try {
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', cleanEmail)
              .maybeSingle();
            if (userProfile?.id) linkedUserId = userProfile.id;
          } catch(e){}

          // Insert new member record
          const { data: inserted, error: insertErr } = await supabase
            .from('company_members')
            .insert({
              company_id: company_id,
              user_id: linkedUserId,
              name: cleanName,
              email: cleanEmail,
              role: assignedRole,
              status: linkedUserId ? 'active' : 'pending',
              invited_by: inviter_id || null,
              invited_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertErr) throw insertErr;
          memberResult = inserted;
        }

        // Send email invitation via Resend if API key is present
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          try {
            // Fetch company profile name
            let companyName = 'Your Organization';
            const { data: coProfile } = await supabase
              .from('profiles')
              .select('company_name, name')
              .eq('id', company_id)
              .maybeSingle();
            if (coProfile) companyName = coProfile.company_name || coProfile.name || companyName;

            const inviteUrl = `https://collektng.com/register.html?invite_company=${encodeURIComponent(company_id)}&email=${encodeURIComponent(cleanEmail)}`;

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Collekt Invitations <onboarding@resend.dev>',
                to: cleanEmail,
                subject: `You've been invited to join ${companyName} on Collekt`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="color: #0e3b35; margin: 0;">COLLEKT</h2>
                      <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Energy & Infrastructure Marketplace</p>
                    </div>
                    <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 12px;">Team Invitation</h3>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                      Hello <strong>${cleanName}</strong>,
                    </p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                      You have been invited to join the <strong>${companyName}</strong> team on Collekt with the role of <strong>${assignedRole.toUpperCase()}</strong>.
                    </p>
                    <div style="margin: 28px 0; text-align: center;">
                      <a href="${inviteUrl}" style="background: #0e3b35; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                        Accept Invitation &rarr;
                      </a>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      If you did not expect this invitation, you can safely ignore this email.
                    </p>
                  </div>
                `
              })
            });
          } catch(e) {
            console.warn('[CompanyTeam] Resend email send notice:', e.message);
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            status: 'success',
            message: `Invitation sent to ${cleanName} (${assignedRole.toUpperCase()})`,
            data: memberResult
          })
        };
      }

      // Action: REMOVE
      if (action === 'remove') {
        if (!member_id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ status: 'error', error: 'Missing member_id' })
          };
        }

        const { error: delErr } = await supabase
          .from('company_members')
          .delete()
          .eq('id', member_id)
          .eq('company_id', company_id);

        if (delErr) {
          console.error('[CompanyTeam] Supabase DELETE error:', delErr);
          throw delErr;
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ status: 'success', message: 'Member removed successfully' })
        };
      }

      // Action: UPDATE ROLE
      if (action === 'update_role') {
        if (!member_id || !role) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ status: 'error', error: 'Missing member_id or role' })
          };
        }

        const validRoles = ['admin', 'finance', 'member', 'viewer'];
        const assignedRole = validRoles.includes(role) ? role : 'member';

        const { data: updated, error: roleErr } = await supabase
          .from('company_members')
          .update({
            role: assignedRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', member_id)
          .eq('company_id', company_id)
          .select()
          .single();

        if (roleErr) throw roleErr;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            status: 'success',
            message: `Role updated to ${assignedRole.toUpperCase()}`,
            data: updated
          })
        };
      }

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ status: 'error', error: `Unknown action: ${action}` })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  } catch (err) {
    console.error('[CompanyTeam Handler Error]:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'error', error: err.message || 'Internal Server Error' })
    };
  }
};
