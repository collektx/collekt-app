const { supabase } = require('./lib/supabase-client');

const PROMO_CONFIG = {
  validCodes: ['COLLEKT60', 'EARLYBIRD'],
  limits: {
    professional: 50,
    company: 20
  },
  trialDays: 60
};

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const action = String(payload.action || 'check').toLowerCase();
    const inputCode = String(payload.code || '').trim().toUpperCase();
    const role = (payload.role === 'company') ? 'company' : 'professional';
    const userId = payload.userId ? String(payload.userId).trim() : null;
    const email = payload.email ? String(payload.email).trim().toLowerCase() : null;

    // 1. Validate promo code format & existence
    if (!PROMO_CONFIG.validCodes.includes(inputCode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Invalid promo code. Please check the code and try again.'
        })
      };
    }

    const limit = PROMO_CONFIG.limits[role] || 50;

    // 2. Query current redemptions count for this role from Supabase
    let redeemedCount = 0;
    try {
      if (supabase && typeof supabase.from === 'function') {
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', role)
          .not('promo_code_used', 'is', null);

        if (!error && typeof count === 'number') {
          redeemedCount = count;
        }
      }
    } catch (countErr) {
      console.warn('Count query warning:', countErr);
    }

    const remaining = Math.max(0, limit - redeemedCount);

    // If quota reached
    if (redeemedCount >= limit) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          exhausted: true,
          error: `The ${limit} founding member slots for ${role === 'company' ? 'companies' : 'professionals'} have all been claimed!`
        })
      };
    }

    // ACTION: CHECK CODE
    if (action === 'check') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          code: inputCode,
          role,
          trialDays: PROMO_CONFIG.trialDays,
          discountPercent: 100,
          totalLimit: limit,
          claimedCount: redeemedCount,
          remainingSlots: remaining,
          message: `Promo code ${inputCode} valid! Grants a 60-Day (2 Months) Free Trial.`
        })
      };
    }

    // ACTION: REDEEM CODE
    if (action === 'redeem') {
      if (!userId && !email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User ID or Email is required to activate promo code.' })
        };
      }

      // Check if user already redeemed a promo code
      if (supabase && (userId || email)) {
        let query = supabase.from('profiles').select('id, email, is_premium, promo_code_used, trial_ends_at');
        if (userId) query = query.eq('id', userId);
        else query = query.eq('email', email);

        const { data: userProfile, error: profileErr } = await query.maybeSingle();

        if (userProfile && userProfile.promo_code_used) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: `You have already redeemed promo code ${userProfile.promo_code_used}. Each account is eligible for one founding trial.`
            })
          };
        }
      }

      // Calculate 60 days expiration starting immediately
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + (PROMO_CONFIG.trialDays * 24 * 60 * 60 * 1000)).toISOString();

      const updateData = {
        is_premium: true,
        subscription_tier: (role === 'company') ? 'company_enterprise' : 'pro_plus',
        subscription_cycle: 'trial_60_days',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt,
        subscription_expiry: trialEndsAt,
        promo_code_used: inputCode,
        subscription_status: 'active_trial',
        updated_at: now.toISOString()
      };

      // Persist to Supabase
      if (supabase && (userId || email)) {
        try {
          let updateQuery = supabase.from('profiles').update(updateData);
          if (userId) updateQuery = updateQuery.eq('id', userId);
          else updateQuery = updateQuery.eq('email', email);

          await updateQuery;

          // Record audit log entry
          if (typeof supabase.from === 'function') {
            await supabase.from('audit_logs').insert([{
              action: 'PROMO_TRIAL_ACTIVATED',
              entity_type: 'subscription',
              entity_id: userId || email,
              metadata: {
                promo_code: inputCode,
                role: role,
                trial_days: PROMO_CONFIG.trialDays,
                trial_ends_at: trialEndsAt,
                activated_at: now.toISOString()
              }
            }]).select('id');
          }
        } catch (dbErr) {
          console.warn('Supabase profile update warning:', dbErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          code: inputCode,
          role,
          trialDays: PROMO_CONFIG.trialDays,
          trialEndsAt: trialEndsAt,
          remainingSlots: remaining - 1,
          subscription: updateData,
          message: 'Congratulations! Your 60-day Founding Member free trial is now active and starts counting immediately.'
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Unknown action specified.' })
    };

  } catch (err) {
    console.error('Promo activation error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error processing promo code.' })
    };
  }
};
