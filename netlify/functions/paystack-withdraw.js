const { createClient } = require('@supabase/supabase-js');
const { getPaymentProvider } = require('./lib/payment-provider');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ozzwvzxugfaveggeznfa.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      amount,
      user_id,
      owner_id,
      owner_type = 'user',
      bank_code,
      bank_name,
      account_number,
      account_name,
      narration = 'Collekt Wallet Withdrawal'
    } = body;

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < 500) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Minimum withdrawal amount is ₦500' })
      };
    }

    const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
    if (cleanAcct.length !== 10) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Valid 10-digit Nigerian NUBAN account number is required' })
      };
    }

    const effectiveOwnerId = owner_id || user_id;
    if (!effectiveOwnerId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Account owner ID is required' })
      };
    }

    // Role-based authorization: explicitly reject viewer or non-finance roles
    const callerRole = String(body.role || '').toLowerCase().trim();
    if (callerRole && ['viewer', 'member', 'read-only'].includes(callerRole)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Unauthorized: viewers and non-finance members cannot initiate withdrawals.' })
      };
    }

    // Role-based authorization for company wallets
    if (owner_type === 'company' && user_id && user_id !== effectiveOwnerId) {
      const { data: membership } = await supabase
        .from('company_members')
        .select('role, status')
        .eq('company_id', effectiveOwnerId)
        .eq('user_id', user_id)
        .maybeSingle();

      if (!membership || membership.status !== 'active' || !['owner', 'admin', 'finance'].includes(membership.role)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Unauthorized: only company owners, admins, or finance officers can authorize withdrawals.' })
        };
      }
    }

    // Check available wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, available_balance, escrow_balance')
      .or(`owner_id.eq.${effectiveOwnerId},user_id.eq.${effectiveOwnerId}`)
      .single();

    if (!wallet || Number(wallet.available_balance || 0) < numAmount) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: `Insufficient available funds. Available: ₦${Number(wallet?.available_balance || 0).toLocaleString()}`
        })
      };
    }

    // Atomic debit via stored procedure
    const { data: debitResult, error: debitError } = await supabase.rpc('debit_wallet_atomic', {
      p_user_id: effectiveOwnerId,
      p_amount: numAmount
    });

    if (debitError || !debitResult || debitResult.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Debit failed: balance changed concurrently or insufficient funds.' })
      };
    }

    const balanceBefore = Number(debitResult[0].v_before || wallet.available_balance);
    const balanceAfter = Number(debitResult[0].balance_after || (balanceBefore - numAmount));

    // Generate unique transaction reference
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `COL-WDW-${timestamp}-${randomSuffix}`;

    // Record in immutable wallet_ledger
    await supabase.from('wallet_ledger').insert({
      wallet_id: wallet.id,
      owner_id: effectiveOwnerId,
      entry_type: 'debit',
      amount: numAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      currency: 'NGN',
      description: `Withdrawal to ${bank_name || 'Bank'} (${cleanAcct})`,
      reference: reference,
      metadata: {
        bank_name: bank_name,
        bank_code: bank_code,
        account_number: cleanAcct,
        account_name: account_name,
        narration: narration
      }
    });

    // Record in unified transactions table
    await supabase.from('transactions').insert({
      owner_id: effectiveOwnerId,
      user_id: user_id || effectiveOwnerId,
      wallet_id: wallet.id,
      reference: reference,
      gateway: 'paystack',
      transaction_type: 'wallet_debit',
      payment_method: 'bank_transfer',
      amount: numAmount,
      currency: 'NGN',
      status: 'processing',
      metadata: {
        bank_name: bank_name,
        bank_code: bank_code,
        account_number: cleanAcct,
        account_name: account_name,
        narration: narration
      }
    });

    // Record in audit logs
    await supabase.from('audit_logs').insert({
      actor_id: user_id || effectiveOwnerId,
      action: 'wallet_withdrawal',
      entity_type: 'wallet',
      entity_id: wallet.id,
      metadata: {
        amount: numAmount,
        reference: reference,
        recipient_account: cleanAcct,
        bank_name: bank_name
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        status: 'success',
        message: `Withdrawal of ₦${numAmount.toLocaleString()} initiated successfully.`,
        reference: reference,
        amount: numAmount,
        balance_after: balanceAfter
      })
    };

  } catch (err) {
    console.error('paystack-withdraw error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Withdrawal processing failed' })
    };
  }
};
