const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Elevated privileges to mutate wallets & ledgers securely
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Verify Paystack HMAC-SHA512 Signature
    const signature = event.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(event.body)
      .digest('hex');

    if (hash !== signature) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized signature' }) };
    }

    const payload = JSON.parse(event.body);

    if (payload.event === 'charge.success') {
      const data = payload.data;
      const amountInNaira = data.amount / 100;
      const reference = data.reference;

      // 2. IDEMPOTENCY CHECK — must happen before any wallet mutation.
      // If this reference was already processed, acknowledge and exit.
      const { data: existingTxn } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (existingTxn) {
        return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
      }

      // 3. Identify user — prefer metadata.user_id (set at checkout init)
      // over email lookup, which breaks silently on email mismatches.
      let userId = data.metadata?.user_id;

      if (!userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', data.customer.email)
          .single();

        if (!profile) {
          // Log this somewhere you'll actually see it — a payment was taken
          // but couldn't be matched to any user.
          console.error(`Webhook: no profile found for reference ${reference}, email ${data.customer.email}`);
          return { statusCode: 200, body: JSON.stringify({ received: true, warning: 'no matching profile' }) };
        }
        userId = profile.id;
      }

      // 4. Fetch current wallet state
      const { data: wallet, error: walletFetchError } = await supabase
        .from('wallets')
        .select('available_balance, total_deposited')
        .eq('user_id', userId)
        .single();

      if (walletFetchError || !wallet) {
        console.error(`Webhook: no wallet found for user ${userId}, reference ${reference}`);
        return { statusCode: 200, body: JSON.stringify({ received: true, warning: 'no wallet found' }) };
      }

      const balanceBefore = Number(wallet.available_balance || 0);
      const balanceAfter = balanceBefore + amountInNaira;

      // 5. Insert the ledger row FIRST. The UNIQUE constraint on `reference`
      // acts as a safety net: if two requests race past the idempotency
      // check above at the same instant, only one insert can succeed.
      const { error: insertError } = await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: amountInNaira,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'SUCCESS',
        reference: reference,
        provider: 'PAYSTACK',
        provider_reference: String(data.id),
        metadata: { channel: data.channel, paid_at: data.paid_at }
      });

      if (insertError) {
        // Most likely a race on the unique `reference` constraint —
        // meaning another request already recorded this payment.
        // Do NOT update the wallet balance in that case.
        console.error(`Webhook: ledger insert failed for reference ${reference}:`, insertError.message);
        return { statusCode: 200, body: JSON.stringify({ received: true, warning: 'ledger insert failed, likely duplicate' }) };
      }

      // 6. Only now, after the ledger row is safely recorded, update the wallet.
      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .update({
          available_balance: balanceAfter,
          total_deposited: Number(wallet.total_deposited || 0) + amountInNaira,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (walletUpdateError) {
        // This is now a real inconsistency: ledger says paid, balance didn't update.
        // Needs alerting/reconciliation — flag loudly.
        console.error(`CRITICAL: wallet update failed after ledger insert for reference ${reference}:`, walletUpdateError.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'wallet update failed, will retry' }) };
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook handler error:', err);
    // Returning 500 tells Paystack to retry — safe now that idempotency is in place.
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
