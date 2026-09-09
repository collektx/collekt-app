const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function paystackApi(endpoint, method, postData) {
  return new Promise((resolve, reject) => {
    const dataString = postData ? JSON.stringify(postData) : '';
    const req = https.request({
      hostname: 'api.paystack.co',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Paystack returned non-JSON response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://collektng.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  let debitedUserId = null;
  let debitedAmount = null;

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing token' }) };

    // 1. Authenticate Requesting User via Supabase JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid user token' }) };

    const { amount, accountNumber, bankCode, accountName } = JSON.parse(event.body);
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount < 1000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Minimum withdrawal amount is ₦1,000' }) };
    }
    if (!accountNumber || !bankCode || !accountName) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing bank account details' }) };
    }

    // 2. Create Transfer Recipient on Paystack FIRST — before touching any balance.
    // If bank details are invalid, we want to fail here with nothing debited yet.
    const recipientRes = await paystackApi('/transferrecipient', 'POST', {
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN'
    });

    if (!recipientRes.status) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: recipientRes.message || 'Invalid bank details' }) };
    }

    const recipientCode = recipientRes.data.recipient_code;
    const ref = `WDR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 3. ATOMIC debit — checks balance and deducts in one DB operation, so two
    // concurrent withdrawal requests can't both pass the balance check.
    const { data: debitResult, error: debitError } = await supabase
      .rpc('debit_wallet_atomic', { p_user_id: user.id, p_amount: withdrawAmount });

    if (debitError) {
      console.error('Withdraw: debit RPC error', debitError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not process wallet debit' }) };
    }
    if (!debitResult || debitResult.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Insufficient wallet balance' }) };
    }

    const { balance_before, balance_after } = debitResult[0];
    // Track that a real debit has happened, so if anything below fails,
    // the catch block knows to refund it.
    debitedUserId = user.id;
    debitedAmount = withdrawAmount;

    // 4. Log the transaction as PENDING before calling Paystack, so there's
    // a record even if the process crashes mid-transfer.
    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'WITHDRAWAL',
      amount: withdrawAmount,
      balance_before,
      balance_after,
      status: 'PENDING',
      reference: ref,
      provider_reference: recipientCode,
      metadata: { bank: bankCode, account: accountNumber, name: accountName }
    });

    // 5. Trigger the actual transfer
    const transferRes = await paystackApi('/transfer', 'POST', {
      source: 'balance',
      amount: withdrawAmount * 100,
      recipient: recipientCode,
      reference: ref,
      reason: 'Collekt Professional Disbursal'
    });

    // 6. If Paystack REJECTS the transfer outright (not just async pending),
    // refund the wallet immediately and mark the transaction FAILED.
    // Note: transferRes.data.status will be 'otp', 'pending', or 'success' on
    // acceptance — those are fine and get finalized later via webhook.
    // transferRes.status === false means Paystack rejected the request itself.
    if (!transferRes.status) {
      await supabase.rpc('refund_wallet_atomic', { p_user_id: user.id, p_amount: withdrawAmount });
      await supabase
        .from('wallet_transactions')
        .update({ status: 'FAILED', metadata: { bank: bankCode, account: accountNumber, name: accountName, failure_reason: transferRes.message } })
        .eq('reference', ref);

      return { statusCode: 400, headers, body: JSON.stringify({ error: transferRes.message || 'Transfer could not be initiated' }) };
    }

    // 7. Transfer was ACCEPTED but not yet confirmed — do not tell the user
    // it succeeded. It's pending until your transfer-webhook function
    // receives transfer.success or transfer.failed from Paystack.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Withdrawal initiated and is being processed. You will be notified once it completes.',
        status: 'PENDING',
        reference: ref
      })
    };

  } catch (err) {
    console.error('Withdraw handler error:', err);

    // If we already debited the wallet before hitting this error, refund it —
    // otherwise the user loses money with nothing sent.
    if (debitedUserId && debitedAmount) {
      try {
        await supabase.rpc('refund_wallet_atomic', { p_user_id: debitedUserId, p_amount: debitedAmount });
        console.error(`Refunded ${debitedAmount} to user ${debitedUserId} after handler error`);
      } catch (refundErr) {
        console.error('CRITICAL: refund attempt itself failed', refundErr);
      }
    }

    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
