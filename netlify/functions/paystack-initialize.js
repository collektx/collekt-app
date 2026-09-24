const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');
const { corsHeaders, preflightResponse } = require('./lib/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      amount,
      email,
      payment_method = 'card',
      user_id,
      userId,
      owner_id,
      ownerId,
      owner_type = 'user',
      ownerType,
      callback_url
    } = body;

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < 100) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Minimum funding amount is ₦100' })
      };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Valid customer email is required' })
      };
    }

    let effectiveOwnerId = owner_id || ownerId || user_id || userId;
    const effectiveOwnerType = owner_type || ownerType || 'user';
    const effectiveUserId = user_id || userId || effectiveOwnerId;

    if (!effectiveOwnerId && cleanEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (profile) effectiveOwnerId = profile.id;
    }

    if (!effectiveOwnerId) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'User account not found for provided email.' })
      };
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveOwnerId);

    const provider = getPaymentProvider('paystack');
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `COL-PAY-${timestamp}-${randomSuffix}`;

    const callbackUrl = callback_url ||
      `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host || 'collektng.com'}/payment-result.html`;

    const initResult = await provider.initializePayment({
      email: cleanEmail,
      amount: numAmount,
      reference,
      payment_method,
      callback_url: callbackUrl,
      metadata: {
        owner_id: effectiveOwnerId,
        user_id: effectiveUserId,
        owner_type: effectiveOwnerType,
        payment_method,
        custom_fields: [
          { display_name: 'Platform', variable_name: 'platform', value: 'Collekt' },
          { display_name: 'Payment Method', variable_name: 'payment_method', value: payment_method }
        ]
      }
    });

    if (!initResult || !initResult.authorization_url) {
      return {
        statusCode: 502,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Payment initialization failed. Please try again.' })
      };
    }

    // Record pending transaction
    await supabase.from('transactions').insert({
      owner_id: effectiveOwnerId,
      user_id: effectiveUserId,
      type: 'credit',
      transaction_type: 'wallet_funding',
      payment_method,
      gateway: 'paystack',
      reference,
      amount: numAmount,
      currency: 'NGN',
      status: 'pending',
      metadata: {
        owner_type: effectiveOwnerType,
        payment_method,
        callback_url: callbackUrl
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        status: 'success',
        authorization_url: initResult.authorization_url,
        access_code: initResult.access_code,
        reference,
        amount: numAmount,
        gateway: 'paystack',
        payment_method
      })
    };

  } catch (err) {
    console.error('paystack-initialize error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: err.message || 'Payment initialization failed' })
    };
  }
};
