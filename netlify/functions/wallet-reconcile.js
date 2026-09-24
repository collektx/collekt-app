const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');
const { corsHeaders, preflightResponse } = require('./lib/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(event), body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { reference, account_number } = body;

    const provider = getPaymentProvider('paystack');

    // 1. Reconcile by transaction reference
    if (reference) {
      const verification = await provider.verifyPayment(reference);

      if (verification.verified) {
        const { data: tx } = await supabase
          .from('transactions')
          .select('*')
          .eq('reference', reference)
          .maybeSingle();

        const ownerId = tx?.owner_id || tx?.user_id || verification.metadata?.owner_id;

        if (ownerId) {
          await supabase.rpc('credit_wallet_atomic', {
            p_owner_id: ownerId,
            p_amount: verification.amount,
            p_reference: reference,
            p_entry_type: 'credit',
            p_description: 'Reconciled Payment via Paystack',
            p_metadata: { reconciled_at: new Date().toISOString() }
          });
        }

        return {
          statusCode: 200,
          headers: corsHeaders(event),
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
        headers: corsHeaders(event),
        body: JSON.stringify({
          status: verification.status,
          reconciled: false,
          reference: reference,
          message: 'Paystack reports transaction as not successful.'
        })
      };
    }

    // 2. Requery DVA by account number
    if (account_number) {
      const res = await provider.requeryVirtualAccount({ account_number });
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({ status: 'success', requery: res })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Please provide either a transaction reference or DVA account number to reconcile.' })
    };

  } catch (err) {
    console.error('wallet-reconcile error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: err.message || 'Reconciliation failed' })
    };
  }
};
