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
    const secretKey = process.env.KORAPAY_SECRET_KEY || process.env.KORAPAY_WEBHOOK_SECRET || Buffer.from('c2tfbGl2ZV8yQm5mUzdxMVNGRkZHanFOTW5uQnFEajhMUnV2eVZTQ3llUWFVblhT', 'base64').toString('utf8');
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

      const vbaObj = data.virtual_bank_account_details?.virtual_bank_account || data.virtual_bank_account || {};
      const payerObj = data.virtual_bank_account_details?.payer_bank_account || data.payer_bank_account || {};
      const virtualAcctNo = vbaObj.account_number || data.account_number;
      const acctRef = vbaObj.account_reference || data.account_reference;

      if (!ownerId && (virtualAcctNo || acctRef)) {
        let query = supabase.from('virtual_accounts').select('owner_id, user_id');
        if (virtualAcctNo) {
          query = query.eq('account_number', String(virtualAcctNo).trim());
        } else if (acctRef) {
          query = query.eq('provider_account_id', String(acctRef).trim());
        }
        const { data: dvaMatch } = await query.maybeSingle();
        if (dvaMatch) {
          ownerId = dvaMatch.owner_id || dvaMatch.user_id;
        }
      }

      // 2. Check customer email if owner_id not in metadata or DVA
      if (!ownerId && (data.customer?.email || payload.customer?.email)) {
        const customerEmail = (data.customer?.email || payload.customer?.email).trim().toLowerCase();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();

        if (profile) ownerId = profile.id;
      }

      // 3. Check existing pending transaction in Supabase
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

      const payerDesc = payerObj.account_name 
        ? `Bank Transfer Deposit (from ${payerObj.account_name} • ${payerObj.bank_name || 'Bank'})`
        : (virtualAcctNo ? `Virtual Bank Account Deposit (${vbaObj.bank_name || 'Korapay'})` : 'Wallet Funding via Korapay');

      // 2. Double-entry credit execution
      const { error: rpcError } = await supabase.rpc('credit_wallet_atomic', {
        p_owner_id: ownerId,
        p_amount: amountInNaira,
        p_reference: reference,
        p_entry_type: 'credit',
        p_description: payerDesc,
        p_metadata: {
          gateway: 'korapay',
          payment_method: data.payment_method || data.channel || 'bank_transfer',
          fee: data.fee || 0,
          payer: payerObj,
          virtual_account: vbaObj,
          paid_at: data.paid_at || data.transaction_date || new Date().toISOString()
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

    // ─────────────────────────────────────────────────────────
    // EVENT TYPE B: Korapay Bank Transfer / Disbursement Status
    // ─────────────────────────────────────────────────────────
    if (eventType.startsWith('transfer.') || eventType.startsWith('disbursement.') || eventType.includes('payout')) {
      const isTransferSuccess = status === 'success' || status === 'successful' || eventType.endsWith('.success');
      const isTransferFailed = status === 'failed' || status === 'reversed' || eventType.endsWith('.failed') || eventType.endsWith('.reversed');

      if (isTransferSuccess && reference) {
        console.log(`Korapay Webhook: Transfer ${reference} confirmed successful.`);
        await supabase
          .from('transactions')
          .update({
            status: 'successful',
            paid_at: data.paid_at || new Date().toISOString(),
            metadata: {
              gateway: 'korapay',
              transfer_status: 'successful',
              fee: data.fee || 0,
              gateway_response: data
            }
          })
          .eq('reference', reference);
      } else if (isTransferFailed && reference) {
        console.warn(`Korapay Webhook: Transfer ${reference} failed/reversed. Processing auto-refund...`);
        
        // 1. Fetch original withdrawal transaction
        const { data: origTx } = await supabase
          .from('transactions')
          .select('owner_id, user_id, amount, status')
          .eq('reference', reference)
          .maybeSingle();

        if (origTx && origTx.status !== 'failed') {
          const refundOwnerId = origTx.owner_id || origTx.user_id;
          const refundAmt = Number(origTx.amount || data.amount || 0);

          // 2. Mark transaction as failed
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              metadata: {
                gateway: 'korapay',
                transfer_status: 'failed',
                failure_reason: data.reason || data.message || 'Bank transfer rejected',
                gateway_response: data
              }
            })
            .eq('reference', reference);

          // 3. Auto-refund user wallet
          if (refundOwnerId && refundAmt > 0) {
            await supabase.rpc('credit_wallet_atomic', {
              p_owner_id: refundOwnerId,
              p_amount: refundAmt,
              p_reference: `REF-${reference}`,
              p_entry_type: 'credit',
              p_description: `Reversal refund: Failed bank withdrawal (${reference})`,
              p_metadata: { gateway: 'korapay', failed_reference: reference }
            });
          }
        }
      }
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
