const crypto = require('crypto');
const { supabase } = require('./lib/supabase-client');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secretKey = process.env.OPAY_SECRET_KEY || '';
    const signature = event.headers['sha512'] || event.headers['x-opay-signature'] || event.headers['X-Opay-Signature'];

    if (secretKey && signature) {
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(event.body || '')
        .digest('hex');

      if (hash !== signature) {
        console.error('OPay Webhook signature mismatch');
        return { statusCode: 401, body: JSON.stringify({ code: '401', message: 'Invalid HMAC signature' }) };
      }
    }

    const payload = JSON.parse(event.body || '{}');
    const data = payload.payload || payload.data || payload;
    const status = (data.status || payload.status || '').toUpperCase();
    const reference = data.reference || payload.reference;

    console.log(`Received OPay webhook event for ref ${reference}, status: ${status}`);

    if (status === 'SUCCESS' || status === 'SUCCESSFUL') {
      const amountInNaira = Number(data.amount || payload.amount || 0) / 100;
      let ownerId = data.metadata?.owner_id || data.metadata?.user_id;

      if (!ownerId && (data.userEmail || payload.userEmail)) {
        const email = (data.userEmail || payload.userEmail).trim().toLowerCase();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (profile) ownerId = profile.id;
      }

      if (!ownerId) {
        console.error(`OPay Webhook Warning: No matching owner found for reference ${reference}`);
        return { statusCode: 200, body: JSON.stringify({ code: '00000', message: 'SUCCESS' }) };
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId);
      if (!isUUID) {
        const hash = crypto.createHash('md5').update(String(ownerId)).digest('hex');
        ownerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
      }

      const { error: rpcError } = await supabase.rpc('credit_wallet_atomic', {
        p_owner_id: ownerId,
        p_amount: amountInNaira,
        p_reference: reference,
        p_entry_type: 'credit',
        p_description: 'Wallet Funding via OPay Direct Cashier',
        p_metadata: {
          gateway: 'opay',
          order_no: data.orderNo || payload.orderNo,
          paid_at: data.paidAt || new Date().toISOString()
        }
      });

      if (rpcError) {
        console.error(`OPay Webhook RPC error:`, rpcError.message);
        return { statusCode: 500, body: JSON.stringify({ code: '500', message: 'Ledger failure' }) };
      }

      await supabase
        .from('transactions')
        .upsert({
          id: reference,
          owner_id: ownerId,
          user_id: ownerId,
          type: 'credit',
          transaction_type: 'wallet_funding',
          payment_method: 'opay',
          gateway: 'opay',
          reference: reference,
          gateway_reference: data.orderNo || reference,
          amount: amountInNaira,
          currency: 'NGN',
          status: 'successful',
          paid_at: new Date().toISOString(),
          gateway_response: data
        }, { onConflict: 'id' });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00000', message: 'SUCCESS' })
    };
  } catch (err) {
    console.error('OPay webhook handler exception:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '500', message: err.message })
    };
  }
};
