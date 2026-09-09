// This handles the ASYNC outcome of withdrawals initiated by paystack-withdraw.js.
// Point the SAME Paystack webhook URL at this file, or merge this logic into
// your existing paystack-webhook.js by adding these event types alongside
// 'charge.success'. Kept separate here for clarity.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const signature = event.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(event.body)
      .digest('hex');

    if (hash !== signature) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized signature' }) };
    }

    const payload = JSON.parse(event.body);
    const data = payload.data;
    const reference = data?.reference;

    if (!reference) {
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    // Find the matching PENDING withdrawal by reference
    const { data: txn } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, amount, status')
      .eq('reference', reference)
      .eq('type', 'WITHDRAWAL')
      .maybeSingle();

    if (!txn) {
      return { statusCode: 200, body: JSON.stringify({ received: true, warning: 'no matching withdrawal' }) };
    }

    // Idempotency: if already finalized, don't process again
    if (txn.status === 'SUCCESS' || txn.status === 'FAILED' || txn.status === 'REVERSED') {
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    }

    if (payload.event === 'transfer.success') {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'SUCCESS' })
        .eq('id', txn.id);

    } else if (payload.event === 'transfer.failed' || payload.event === 'transfer.reversed') {
      // Refund the user — the transfer did not actually go through.
      await supabase.rpc('refund_wallet_atomic', { p_user_id: txn.user_id, p_amount: txn.amount });

      await supabase
        .from('wallet_transactions')
        .update({ status: payload.event === 'transfer.reversed' ? 'REVERSED' : 'FAILED' })
        .eq('id', txn.id);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Transfer webhook error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
