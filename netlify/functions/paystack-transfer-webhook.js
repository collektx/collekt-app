// This handles the ASYNC outcome of withdrawals initiated by paystack-withdraw.js.
const crypto = require('crypto');
const { supabase } = require('./lib/supabase-client');

/**
 * Timing-safe comparison to prevent side-channel timing attacks
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET;
    const signature = event.headers['x-paystack-signature'] || event.headers['X-Paystack-Signature'];

    if (!signature) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Missing signature header' })
      };
    }

    if (!secretKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Server configuration error: Webhook secret missing' })
      };
    }

    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(event.body || '')
      .digest('hex');

    if (!timingSafeCompare(hash.toLowerCase(), signature.toLowerCase())) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized signature' })
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const data = payload.data;
    const reference = data?.reference;

    if (!reference) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
      };
    }

    // Find the matching PENDING withdrawal by reference in transactions or wallet_transactions
    const { data: txn } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, amount, status')
      .eq('reference', reference)
      .eq('type', 'WITHDRAWAL')
      .maybeSingle();

    if (!txn) {
      // Also check standard transactions table
      const { data: stdTx } = await supabase
        .from('transactions')
        .select('id, owner_id, user_id, amount, status')
        .eq('reference', reference)
        .maybeSingle();

      if (!stdTx) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received: true, warning: 'no matching withdrawal' })
        };
      }

      // Idempotency: if already finalized in transactions
      if (stdTx.status === 'successful' || stdTx.status === 'failed' || stdTx.status === 'reversed') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received: true, duplicate: true })
        };
      }

      if (payload.event === 'transfer.success') {
        await supabase
          .from('transactions')
          .update({ status: 'successful', updated_at: new Date().toISOString() })
          .eq('id', stdTx.id);
      } else if (payload.event === 'transfer.failed' || payload.event === 'transfer.reversed') {
        const refundOwnerId = stdTx.owner_id || stdTx.user_id;
        await supabase.rpc('credit_wallet_atomic', {
          p_owner_id: refundOwnerId,
          p_amount: Number(stdTx.amount),
          p_reference: `REF-${reference}`,
          p_entry_type: 'refund',
          p_description: `Withdrawal Reversal: ${data.reason || 'Transfer failed at recipient bank'}`
        });

        await supabase
          .from('transactions')
          .update({
            status: payload.event === 'transfer.reversed' ? 'reversed' : 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', stdTx.id);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
      };
    }

    // Idempotency: if already finalized in wallet_transactions
    if (txn.status === 'SUCCESS' || txn.status === 'FAILED' || txn.status === 'REVERSED') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true, duplicate: true })
      };
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true })
    };

  } catch (err) {
    console.error('Transfer webhook error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal error' })
    };
  }
};
