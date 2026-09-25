const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { authenticateRequest } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(event)
  };

  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { user, error: authError } = await authenticateRequest(event);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required to reconcile transactions', details: authError })
      };
    }

    // Rate limiting: 10 reconciliation requests/min per user
    const rateCheck = enforceRateLimit(event, {
      action: 'wallet-reconcile',
      userId: user.id,
      limit: 10,
      windowMs: 60 * 1000,
      customHeaders: headers
    });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const body = JSON.parse(event.body || '{}');
    const { reference, account_number } = body;

    const provider = getPaymentProvider('paystack');

    // 1. Reconcile by transaction reference
    if (reference) {
      // Fetch transaction from Supabase first
      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      // Authorization guard: non-admin can only reconcile own transactions
      const txOwner = tx?.owner_id || tx?.user_id;
      if (txOwner && txOwner !== user.id) {
        const { data: prof } = await supabase.from('profiles').select('role, is_admin').eq('id', user.id).maybeSingle();
        const isAdmin = !!(prof && (prof.role === 'admin' || prof.is_admin === true));
        if (!isAdmin) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Forbidden: You can only reconcile your own transactions.' })
          };
        }
      }

      // IDEMPOTENCY GUARD: Check if already credited or marked successful/completed
      if (tx && (tx.status === 'successful' || tx.status === 'completed')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'already_reconciled',
            reconciled: true,
            already_processed: true,
            reference: reference,
            amount: tx.amount,
            message: 'Transaction is already marked successful/completed. Zero duplicate credit applied.'
          })
        };
      }

      const { data: ledgerEntry } = await supabase
        .from('wallet_ledger')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (ledgerEntry) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'already_reconciled',
            reconciled: true,
            already_processed: true,
            reference: reference,
            message: 'Transaction ledger entry already exists. Zero duplicate credit applied.'
          })
        };
      }

      const verification = await provider.verifyPayment(reference);

      if (verification.verified) {
        const ownerId = txOwner || verification.metadata?.owner_id || user.id;

        if (ownerId) {
          await supabase.rpc('credit_wallet_atomic', {
            p_owner_id: ownerId,
            p_amount: verification.amount,
            p_reference: reference,
            p_entry_type: 'credit',
            p_description: 'Reconciled Payment via Paystack',
            p_metadata: { reconciled_at: new Date().toISOString(), reconciled_by: user.id }
          });

          await supabase
            .from('transactions')
            .update({
              status: 'successful',
              updated_at: new Date().toISOString()
            })
            .eq('reference', reference);
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'success',
            reconciled: true,
            reference: reference,
            amount: verification.amount,
            message: 'Transaction successfully reconciled and credited.'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: verification.status,
          reconciled: false,
          reference: reference,
          message: 'Payment provider reports transaction as not successful.'
        })
      };
    }

    // 2. Requery DVA by account number
    if (account_number) {
      const res = await provider.requeryVirtualAccount({ account_number });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', requery: res })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Please provide either a transaction reference or DVA account number to reconcile.' })
    };

  } catch (err) {
    console.error('wallet-reconcile error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Reconciliation failed' })
    };
  }
};
