const crypto = require('crypto');
const { supabase } = require('./lib/supabase-client');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const rawBody = event.body || '';
    const secretKey = process.env.KORAPAY_SECRET_KEY || process.env.KORAPAY_WEBHOOK_SECRET || '';
    const signature = event.headers['x-korapay-signature'] || 
                      event.headers['X-Korapay-Signature'] || 
                      event.headers['x-kora-signature'] || 
                      event.headers['X-Kora-Signature'];

    // 1. Verify HMAC-SHA256 signature if secretKey is configured
    if (secretKey && signature) {
      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('hex');

      if (hash !== signature) {
        console.error('Korapay Webhook signature mismatch');
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: false, message: 'Invalid HMAC signature' })
        };
      }
    }

    const payload = JSON.parse(rawBody || '{}');
    const eventType = payload.event || payload.type || 'charge.success';
    const data = payload.data || payload;
    const status = (data.status || payload.status || '').toLowerCase();
    const reference = data.reference || payload.reference;

    console.log(`Received Korapay webhook [${eventType}] for ref ${reference}, status: ${status}`);

    if (eventType === 'charge.success' || status === 'success' || status === 'successful') {
      const amountInNaira = Number(data.amount_paid || data.amount || payload.amount || 0);
      let ownerId = data.metadata?.owner_id || data.metadata?.user_id;

      // Check customer email if owner_id not in metadata
      if (!ownerId && (data.customer?.email || payload.customer?.email)) {
        const customerEmail = (data.customer?.email || payload.customer?.email).trim().toLowerCase();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();

        if (profile) ownerId = profile.id;
      }

      // Check existing pending transaction in Supabase
      if (!ownerId && reference) {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('owner_id, user_id')
          .eq('reference', reference)
          .maybeSingle();

        if (existingTx) {
          ownerId = existingTx.owner_id || existingTx.user_id;
        }
      }

      if (!ownerId) {
        console.warn(`Korapay Webhook Warning: No matching owner found for reference ${reference}`);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: true, message: 'Processed without owner assignment' })
        };
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId);
      if (!isUUID) {
        const hash = crypto.createHash('md5').update(String(ownerId)).digest('hex');
        ownerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
      }

      // 2. Double-entry credit execution
      const { error: rpcError } = await supabase.rpc('credit_wallet_atomic', {
        p_owner_id: ownerId,
        p_amount: amountInNaira,
        p_reference: reference,
        p_entry_type: 'credit',
        p_description: 'Wallet Funding via Korapay Secure Channel',
        p_metadata: {
          gateway: 'korapay',
          payment_method: data.payment_method || data.channel || 'korapay',
          fee: data.fee || 0,
          paid_at: data.paid_at || new Date().toISOString()
        }
      });

      if (rpcError) {
        console.error('Korapay credit_wallet_atomic error:', rpcError.message);
        // Fallback: Direct wallet update if RPC is unavailable
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id, available_balance, balance')
          .eq('owner_id', ownerId)
          .maybeSingle();

        if (wallet) {
          const newBal = Number(wallet.available_balance || wallet.balance || 0) + amountInNaira;
          await supabase
            .from('wallets')
            .update({
              available_balance: newBal,
              balance: newBal,
              updated_at: new Date().toISOString()
            })
            .eq('id', wallet.id);

          await supabase
            .from('wallet_ledger')
            .insert({
              owner_id: ownerId,
              wallet_id: wallet.id,
              amount: amountInNaira,
              entry_type: 'credit',
              balance_after: newBal,
              reference: reference,
              description: 'Wallet Funding via Korapay Checkout'
            });
        }
      }

      // 3. Upsert transaction record
      await supabase
        .from('transactions')
        .upsert({
          id: reference,
          owner_id: ownerId,
          user_id: ownerId,
          type: 'credit',
          transaction_type: 'wallet_funding',
          payment_method: data.payment_method || 'korapay',
          gateway: 'korapay',
          reference: reference,
          gateway_reference: String(data.id || reference),
          amount: amountInNaira,
          currency: data.currency || 'NGN',
          status: 'successful',
          paid_at: data.paid_at || new Date().toISOString(),
          gateway_response: data
        }, { onConflict: 'id' });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: true, message: 'Webhook processed successfully' })
    };

  } catch (err) {
    console.error('Korapay webhook handler exception:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: false, message: err.message })
    };
  }
};
