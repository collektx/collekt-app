const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');

exports.handler = async (event) => {
  // Support both GET (query param) and POST (body)
  const reference = event.queryStringParameters?.reference || 
                    event.queryStringParameters?.trxref ||
                    (event.body ? JSON.parse(event.body || '{}').reference : null);

  if (!reference) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Transaction reference is required' })
    };
  }

  try {
    // Fetch existing transaction from Supabase first to determine gateway
    const { data: tx } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    const gateway = tx?.gateway || (reference.startsWith('OPAY') ? 'opay' : 'korapay');
    const provider = getPaymentProvider(gateway);
    const verification = await provider.verifyPayment(reference);

    if (!verification.verified) {
      // Update transaction status if failed or abandoned
      if (tx && tx.status === 'pending') {
        await supabase
          .from('transactions')
          .update({
            status: verification.status === 'abandoned' ? 'abandoned' : 'failed',
            gateway_response: verification.raw || {},
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          status: verification.status || 'failed',
          verified: false,
          reference: reference,
          amount: verification.amount || tx?.amount || 0,
          currency: verification.currency || 'NGN',
          payment_method: tx?.payment_method || verification.channel || 'card',
          created_at: tx?.created_at || new Date().toISOString(),
          message: verification.message || 'Payment was not successful.'
        })
      };
    }

    // Payment is verified as SUCCESS on Korapay/Gateway!
    const ownerId = tx?.owner_id || tx?.user_id || verification.metadata?.owner_id || verification.metadata?.user_id;

    if (!ownerId) {
      console.error('Verify warning: No owner ID found for reference', reference);
    }

    // Idempotently credit wallet via stored procedure
    let creditResult = null;
    if (ownerId) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('credit_wallet_atomic', {
        p_owner_id: ownerId,
        p_amount: verification.amount,
        p_reference: reference,
        p_entry_type: 'credit',
        p_description: `Wallet Funding via ${verification.channel ? verification.channel.toUpperCase() : 'Korapay Checkout'}`,
        p_metadata: {
          gateway_transaction_id: verification.gateway_transaction_id,
          channel: verification.channel,
          paid_at: verification.paid_at,
          customer_email: verification.customer?.email
        }
      });

      if (rpcError) {
        console.error('credit_wallet_atomic RPC error during verify:', rpcError);
      } else {
        creditResult = rpcData;
      }
    }

    // Update transactions table with gateway metadata
    await supabase
      .from('transactions')
      .update({
        status: 'successful',
        gateway_transaction_id: verification.gateway_transaction_id,
        gateway_reference: verification.reference,
        gateway_response: verification.raw || {},
        paid_at: verification.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('reference', reference);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        status: 'successful',
        verified: true,
        reference: reference,
        amount: verification.amount,
        currency: verification.currency || 'NGN',
        payment_method: tx?.payment_method || verification.channel || 'card',
        gateway_transaction_id: verification.gateway_transaction_id,
        paid_at: verification.paid_at,
        created_at: tx?.created_at || new Date().toISOString(),
        customer: verification.customer,
        message: 'Payment confirmed. Your Collekt wallet has been funded.'
      })
    };

  } catch (err) {
    console.error('paystack-verify error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Payment verification failed' })
    };
  }
};