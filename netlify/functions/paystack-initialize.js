const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Minimum funding amount is ₦100' })
      };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Valid customer email is required' })
      };
    }

    let effectiveOwnerId = owner_id || ownerId || user_id || userId;
    const effectiveOwnerType = owner_type || ownerType || 'user';
    const effectiveUserId = user_id || userId || effectiveOwnerId;

    if (!effectiveOwnerId && cleanEmail) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
      if (prof) effectiveOwnerId = prof.id;
    }
    if (!effectiveOwnerId) {
      const hash = require('crypto').createHash('md5').update(cleanEmail).digest('hex');
      effectiveOwnerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
    } else {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveOwnerId);
      if (!isUUID) {
        const hash = require('crypto').createHash('md5').update(String(effectiveOwnerId)).digest('hex');
        effectiveOwnerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
      }
    }

    // Role-based permission check for company wallets
    if (effectiveOwnerType === 'company' && effectiveUserId && effectiveUserId !== effectiveOwnerId) {
      const { data: membership } = await supabase
        .from('company_members')
        .select('role, status')
        .eq('company_id', effectiveOwnerId)
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (!membership || membership.status !== 'active' || !['owner', 'admin', 'finance'].includes(membership.role)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Unauthorized: only company owners, admins, or finance officers can fund company wallets.' })
        };
      }
    }

    // Find or verify wallet exists
    let wallet = null;
    const { data: ownerWallet } = await supabase
      .from('wallets')
      .select('id, available_balance')
      .eq('owner_id', effectiveOwnerId)
      .maybeSingle();

    if (ownerWallet) {
      wallet = ownerWallet;
    } else {
      const { data: userWallet } = await supabase
        .from('wallets')
        .select('id, available_balance')
        .eq('user_id', effectiveOwnerId)
        .maybeSingle();
      wallet = userWallet;
    }

    if (!wallet) {
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert({
          owner_id: effectiveOwnerId,
          user_id: effectiveUserId,
          owner_type: effectiveOwnerType,
          currency: 'NGN',
          available_balance: 0.00,
          balance: 0.00
        })
        .select()
        .single();
      wallet = newWallet;
    }

    // Generate unique transaction reference
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `COL-FUND-${timestamp}-${randomSuffix}`;

    // Determine channels based on method
    let channels = ['card', 'bank_transfer'];
    if (payment_method === 'opay') {
      channels = ['opay', 'card'];
    } else if (payment_method === 'card') {
      channels = ['card'];
    } else if (payment_method === 'bank_transfer') {
      channels = ['bank_transfer'];
    }

    // Create pending transaction in Supabase
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        id: reference,
        type: 'credit',
        owner_id: effectiveOwnerId,
        user_id: effectiveOwnerId,
        wallet_id: wallet?.id,
        reference: reference,
        gateway: (body.gateway || (payment_method === 'opay' && process.env.OPAY_PUBLIC_KEY ? 'opay' : 'paystack')),
        transaction_type: 'wallet_funding',
        payment_method: payment_method,
        amount: numAmount,
        currency: 'NGN',
        status: 'pending',
        metadata: {
          owner_type: owner_type,
          email: cleanEmail,
          channels: channels
        }
      });

    if (txError) {
      console.error('Failed to create pending transaction:', txError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Database transaction initialization failed: ' + txError.message })
      };
    }

    // Initialize checkout session via chosen provider (Paystack / OPay)
    const selectedGateway = body.gateway || (payment_method === 'opay' && process.env.OPAY_PUBLIC_KEY ? 'opay' : 'paystack');
    const provider = getPaymentProvider(selectedGateway);
    const returnUrl = callback_url || `${event.headers?.origin || event.headers?.Origin || 'https://collektng.com'}/payment-result.html`;

    const initResult = await provider.initializePayment({
      amount: numAmount,
      email: cleanEmail,
      reference: reference,
      callback_url: returnUrl,
      return_url: returnUrl,
      channels: channels,
      metadata: {
        user_id: user_id || effectiveOwnerId,
        owner_id: effectiveOwnerId,
        owner_type: owner_type,
        wallet_id: wallet?.id,
        payment_method: payment_method,
        gateway: selectedGateway
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        status: 'success',
        authorization_url: initResult.authorization_url,
        access_code: initResult.access_code,
        reference: initResult.reference,
        amount: numAmount
      })
    };

  } catch (err) {
    console.error('paystack-initialize error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Payment initialization failed' })
    };
  }
};
