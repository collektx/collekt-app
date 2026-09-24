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
    // 1. Verify Paystack HMAC-SHA512 Webhook Signature
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || secretKey;
    const signature = event.headers['x-paystack-signature'] || event.headers['X-Paystack-Signature'];

    if (!signature || !webhookSecret) {
      console.error('Webhook rejected: Missing signature or secret key');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized signature' })
      };
    }

    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(event.body || '')
      .digest('hex');

    if (!timingSafeCompare(hash.toLowerCase(), signature.toLowerCase())) {
      console.error('Webhook signature mismatch');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid HMAC signature' })
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const eventType = payload.event;
    const data = payload.data || {};

    console.log(`Received authoritative Paystack webhook event: ${eventType}`);

    // 2. Handle CHARGE.SUCCESS (Card, OPay, and Dedicated Virtual Account Direct Transfers)
    if (eventType === 'charge.success') {
      const amountInNaira = data.amount / 100;
      const reference = data.reference;
      const channel = data.channel || 'card';

      // Idempotency: Prevent replay attacks and double crediting
      if (reference) {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id, status')
          .eq('reference', reference)
          .maybeSingle();

        if (existingTx && existingTx.status === 'successful') {
          console.log(`Paystack Webhook: Reference ${reference} already processed (Idempotent)`);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ received: true, credited: false, duplicate: true })
          };
        }

        const { data: existingLedger } = await supabase
          .from('wallet_ledger')
          .select('id')
          .eq('reference', reference)
          .maybeSingle();

        if (existingLedger) {
          console.log(`Paystack Webhook: Ledger entry already exists for reference ${reference} (Idempotent)`);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ received: true, credited: false, duplicate: true })
          };
        }
      }

      // Identify user/owner: prioritize metadata.owner_id / metadata.user_id, then dedicated account match, then customer email
      let ownerId = data.metadata?.owner_id || data.metadata?.user_id;

      if (!ownerId && data.dedicated_account) {
        // Incoming transfer to Dedicated Virtual Account
        const { data: dvaMatch } = await supabase
          .from('virtual_accounts')
          .select('owner_id')
          .eq('account_number', data.dedicated_account.account_number)
          .maybeSingle();

        if (dvaMatch) ownerId = dvaMatch.owner_id;
      }

      if (!ownerId && data.customer?.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', data.customer.email.trim().toLowerCase())
          .maybeSingle();

        if (profile) ownerId = profile.id;
      }

      if (!ownerId) {
        console.error(`Webhook Warning: No matching owner found for reference ${reference}, customer ${data.customer?.email}`);
        return { statusCode: 200, body: JSON.stringify({ received: true, warning: 'no matching owner profile' }) };
      }

      // Normalize ownerId to UUID format for database compatibility
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId);
      if (!isUUID) {
        const hash = crypto.createHash('md5').update(String(ownerId)).digest('hex');
        ownerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
      }

      // Execute Atomic Credit & Ledger Logging via Stored Procedure
      const { data: rpcResult, error: rpcError } = await supabase.rpc('credit_wallet_atomic', {
        p_owner_id: ownerId,
        p_amount: amountInNaira,
        p_reference: reference,
        p_entry_type: 'credit',
        p_description: `Wallet Funding via ${channel.toUpperCase()}`,
        p_metadata: {
          gateway_transaction_id: String(data.id || ''),
          channel: channel,
          paid_at: data.paid_at,
          customer_email: data.customer?.email,
          fees: data.fees ? data.fees / 100 : 0
        }
      });

      if (rpcError) {
        console.error(`Webhook RPC failure for reference ${reference}:`, rpcError.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Atomic credit failed, will retry' }) };
      }

      // Upsert transaction row in transactions table
      await supabase
        .from('transactions')
        .upsert({
          owner_id: ownerId,
          user_id: ownerId,
          reference: reference,
          gateway: 'paystack',
          transaction_type: 'wallet_funding',
          payment_method: channel,
          amount: amountInNaira,
          currency: data.currency || 'NGN',
          status: 'successful',
          gateway_transaction_id: String(data.id || ''),
          gateway_reference: data.reference,
          gateway_response: data,
          paid_at: data.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'reference' });

      return { statusCode: 200, body: JSON.stringify({ received: true, credited: true }) };
    }

    // 3. Handle DEDICATED_ACCOUNT.ASSIGN.SUCCESS
    if (eventType === 'dedicated_account.assign.success') {
      const dva = data.dedicated_account;
      const customer = data.customer;

      if (dva && customer?.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customer.email.trim().toLowerCase())
          .maybeSingle();

        if (profile) {
          await supabase.from('virtual_accounts').upsert({
            owner_id: profile.id,
            user_id: profile.id,
            provider: 'paystack',
            provider_customer_id: customer.customer_code,
            provider_account_id: String(dva.id || ''),
            account_number: dva.account_number,
            account_name: dva.account_name,
            bank_name: dva.bank?.name || 'Wema Bank',
            bank_code: dva.bank?.slug || '035',
            status: 'active',
            updated_at: new Date().toISOString()
          }, { onConflict: 'account_number' });

          await supabase.from('wallets').update({
            paystack_dva_account: dva.account_number,
            paystack_dva_bank: dva.bank?.name || 'Wema Bank',
            paystack_dva_name: dva.account_name,
            paystack_customer_code: customer.customer_code,
            updated_at: new Date().toISOString()
          }).or(`owner_id.eq.${profile.id},user_id.eq.${profile.id}`);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
      };
    }

    // 4. Handle TRANSFER.SUCCESS (Withdrawals Disbursed)
    if (eventType === 'transfer.success') {
      const reference = data.reference;
      if (reference) {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id, status')
          .eq('reference', reference)
          .maybeSingle();

        if (existingTx && existingTx.status === 'successful') {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ received: true, duplicate: true })
          };
        }

        await supabase
          .from('transactions')
          .update({
            status: 'successful',
            gateway_response: data,
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference);
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
      };
    }

    // 5. Handle TRANSFER.FAILED / TRANSFER.REVERSED (Automatic Wallet Refund)
    if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
      const reference = data.reference;
      const amountInNaira = data.amount / 100;

      const { data: txn } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      if (txn && txn.status !== 'reversed' && txn.status !== 'refunded' && txn.status !== 'failed') {
        const ownerId = txn.owner_id || txn.user_id;

        // Refund wallet balance atomically
        await supabase.rpc('credit_wallet_atomic', {
          p_owner_id: ownerId,
          p_amount: amountInNaira,
          p_reference: `REFUND-${reference}`,
          p_entry_type: 'refund',
          p_description: `Withdrawal Reversal: ${data.reason || 'Transfer failed at recipient bank'}`,
          p_metadata: { original_reference: reference, failure_reason: data.reason }
        });

        await supabase
          .from('transactions')
          .update({
            status: eventType === 'transfer.reversed' ? 'reversed' : 'failed',
            gateway_response: data,
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true, refunded: true })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true, unhandled_event: eventType })
    };

  } catch (err) {
    console.error('Webhook handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal webhook error' })
    };
  }
};
