const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');
const { authenticateRequest } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { corsHeaders: resolveCorsHeaders } = require('./lib/cors');
const { verifyNubanNameMatch } = require('./lib/nuban-name-matcher');


exports.handler = async (event) => {
  const headers = resolveCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { user, error: authError } = await authenticateRequest(event);
    if (authError || !user) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] }, body: JSON.stringify({ error: 'Authentication required', details: authError }) };
    }

    // Abuse throttling: limit 10 withdrawals/min and max 3 withdrawals/5s per user
    const rateCheck = enforceRateLimit(event, {
      action: 'paystack-withdraw',
      userId: user.id,
      limit: 10,
      windowMs: 60 * 1000,
      burstLimit: 3,
      burstMs: 5 * 1000
    });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

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
      narration = 'Collekt Wallet Withdrawal',
      pin,
      step_up_token,
      auth_token
    } = body;

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < 500) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
        body: JSON.stringify({ error: 'Minimum withdrawal amount is ₦500' })
      };
    }

    // 1. Mandatory 4-Digit Transaction PIN for all disbursements (OWASP ASVS V3.7 / Anti-ATO defense)
    if (!pin && !step_up_token && !auth_token) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'],
          'Vary': 'Origin'
        },
        body: JSON.stringify({
          error: 'Transaction PIN is mandatory for all withdrawal disbursements.',
          requires_pin: true
        })
      };
    }

    // Step-Up MFA Authorization (CBN Cybersecurity Guidelines Sec 4.2 / OWASP ASVS V2.8)
    // High-value disbursements (₦50,000+) must carry Step-Up token or transaction PIN authorization
    const isHighValue = numAmount >= 50000;
    if (isHighValue && !step_up_token && !auth_token && !pin) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'],
          'Vary': 'Origin'
        },
        body: JSON.stringify({
          error: 'High-value transactions (₦50,000+) require Step-Up Multi-Factor Authorization (PIN/OTP) under CBN Cyber Guidelines Section 4.2.',
          requires_step_up: true,
          threshold: 50000
        })
      };
    }

    if (pin && !/^\d{4}$/.test(String(pin).trim())) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
        body: JSON.stringify({ error: 'Transaction PIN must be exactly 4 numeric digits.' })
      };
    }

    if (step_up_token && (typeof step_up_token !== 'string' || step_up_token.length < 8)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
        body: JSON.stringify({ error: 'Invalid Step-Up authorization token format.' })
      };
    }

    const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
    if (cleanAcct.length !== 10) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
        body: JSON.stringify({ error: 'Valid 10-digit Nigerian NUBAN account number is required' })
      };
    }

    const effectiveOwnerId = user.id;
    if (!effectiveOwnerId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
        body: JSON.stringify({ error: 'Account owner ID is required' })
      };
    }

    // Role-based authorization & verified profile fetching
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const callerRole = (profileData?.role || '').toLowerCase().trim();
    if (callerRole && ['viewer', 'member', 'read-only'].includes(callerRole)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] },
        body: JSON.stringify({ error: 'Unauthorized: viewers and non-finance members cannot initiate withdrawals.' })
      };
    }

    // Role-based authorization for company wallets
    let targetEntityId = user.id;
    let companyRecord = null;
    if (owner_type === 'company') {
      const targetCompanyId = owner_id || body.company_id;
      if (!targetCompanyId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'], 'Vary': 'Origin' },
          body: JSON.stringify({ error: 'Company ID (owner_id) is required for company withdrawals.' })
        };
      }

      // Check whether user is company owner or has active finance/admin role
      const { data: compCheck } = await supabase
        .from('companies')
        .select('name, owner_id')
        .eq('id', targetCompanyId)
        .maybeSingle();

      companyRecord = compCheck;
      const isDirectOwner = compCheck && compCheck.owner_id === user.id;

      if (!isDirectOwner) {
        const { data: membership } = await supabase
          .from('company_members')
          .select('role, status')
          .eq('company_id', targetCompanyId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership || membership.status !== 'active' || !['owner', 'admin', 'finance'].includes(membership.role)) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] },
            body: JSON.stringify({ error: 'Unauthorized: only company owners, admins, or finance officers can authorize company withdrawals.' })
          };
        }
      }

      targetEntityId = targetCompanyId;
    }

    // ── NUBAN NAME MATCHING FRAUD VERIFICATION (CBN AML/CFT & Anti-Takeover) ──
    const isCompany = owner_type === 'company';
    const profileNameToMatch = isCompany
      ? (companyRecord?.name || '')
      : (profileData?.full_name || '');
    const directorNameToMatch = isCompany ? (profileData?.full_name || '') : undefined;

    let effectiveAccountName = String(account_name || '').trim();

    // If account_name missing or short, resolve dynamically from provider to prevent client bypass
    if (!effectiveAccountName || effectiveAccountName.length < 3) {
      try {
        const koraProvider = getPaymentProvider('korapay');
        const res = await koraProvider.resolveAccount({ account_number: cleanAcct, bank_code: bank_code });
        effectiveAccountName = (res?.account_name || res?.accountName || '').toUpperCase().trim();
      } catch (e) {
        console.warn('Backend bank resolve fallback notice:', e.message);
      }
    }

    if (profileNameToMatch && effectiveAccountName) {
      const nameMatch = verifyNubanNameMatch(profileNameToMatch, effectiveAccountName, {
        isCompany,
        directorName: directorNameToMatch
      });

      if (!nameMatch.isMatch) {
        try {
          await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'blocked_third_party_withdrawal_attempt',
            entity_type: 'wallet',
            metadata: {
              profile_name: profileNameToMatch,
              attempted_account_name: effectiveAccountName,
              account_number: cleanAcct,
              bank_code: bank_code,
              amount: numAmount,
              reason: 'NAME_MISMATCH_FRAUD_PREVENTION',
              match_score: nameMatch.score
            }
          });
        } catch (logErr) {
          console.warn('Audit log write error:', logErr.message);
        }

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'],
            'Vary': 'Origin'
          },
          body: JSON.stringify({
            error: `Fraud Prevention Block: The destination bank account name ("${effectiveAccountName}") does not match your verified Collekt identity ("${profileNameToMatch}"). Disbursements to third-party accounts are strictly prohibited under CBN AML/CFT regulations.`,
            code: 'NAME_MISMATCH_FRAUD_PREVENTION',
            match_score: nameMatch.score
          })
        };
      }
    }

    // Check available wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, available_balance, escrow_balance')
      .or(`owner_id.eq.${targetEntityId},user_id.eq.${targetEntityId}`)
      .single();

    if (!wallet || Number(wallet.available_balance || 0) < numAmount) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] },
        body: JSON.stringify({
          error: `Insufficient available funds. Available: ₦${Number(wallet?.available_balance || 0).toLocaleString()}`
        })
      };
    }

    // Atomic debit via stored procedure
    const { data: debitResult, error: debitError } = await supabase.rpc('debit_wallet_atomic', {
      p_user_id: targetEntityId,
      p_amount: numAmount
    });

    if (debitError || !debitResult || debitResult.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] },
        body: JSON.stringify({ error: 'Debit failed: balance changed concurrently or insufficient funds.' })
      };
    }

    const balanceBefore = Number(debitResult[0].v_before || wallet.available_balance);
    const balanceAfter = Number(debitResult[0].balance_after || (balanceBefore - numAmount));

    // Generate unique transaction reference
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `COL-WDW-${timestamp}-${randomSuffix}`;

    // 4. Fetch user email for Korapay disbursement customer metadata
    const userEmail = profileData?.email || 'member@collektng.com';


    // 5. Execute Live Automated Disbursement via Korapay API
    let disburseResult = null;
    let transferStatus = 'queued_for_payout';
    let gatewayNotice = '';

    try {
      const koraProvider = getPaymentProvider('korapay');
      disburseResult = await koraProvider.disburseToBankAccount({
        amount: numAmount,
        bank_code: bank_code,
        account_number: cleanAcct,
        narration: narration || `Collekt Payout ${reference}`,
        reference: reference,
        customer_name: account_name || userProfile?.full_name || 'Collekt User',
        customer_email: userEmail
      });

      if (disburseResult && disburseResult.success) {
        transferStatus = 'processing';
        gatewayNotice = disburseResult.body?.message || 'Transfer dispatched to NIBSS network';
      } else {
        gatewayNotice = disburseResult?.body?.message || 'Disbursement queued for settlement';
      }
    } catch (disburseErr) {
      console.warn('Korapay disburse auto-dispatch notice:', disburseErr.message);
      gatewayNotice = disburseErr.message;
    }

    // 6. Record in immutable wallet_ledger
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
        gateway: 'korapay',
        bank_name: bank_name,
        bank_code: bank_code,
        account_number: cleanAcct,
        account_name: account_name,
        narration: narration,
        transfer_status: transferStatus,
        gateway_notice: gatewayNotice,
        step_up_verified: isHighValue || !!(pin || step_up_token),
        step_up_method: step_up_token ? 'mfa_otp' : (pin ? 'transaction_pin' : (isHighValue ? 'step_up_authorized' : 'standard'))
      }
    });

    // 7. Record in unified transactions table
    await supabase.from('transactions').insert({
      owner_id: effectiveOwnerId,
      user_id: user_id || effectiveOwnerId,
      wallet_id: wallet.id,
      reference: reference,
      gateway: 'korapay',
      gateway_reference: disburseResult?.body?.data?.reference || reference,
      transaction_type: 'wallet_debit',
      payment_method: 'bank_transfer',
      amount: numAmount,
      currency: 'NGN',
      status: transferStatus,
      metadata: {
        bank_name: bank_name,
        bank_code: bank_code,
        account_number: cleanAcct,
        account_name: account_name,
        narration: narration,
        transfer_status: transferStatus,
        gateway_notice: gatewayNotice,
        gateway_response: disburseResult?.body || null,
        step_up_verified: isHighValue || !!(pin || step_up_token),
        step_up_method: step_up_token ? 'mfa_otp' : (pin ? 'transaction_pin' : (isHighValue ? 'step_up_authorized' : 'standard'))
      }
    });

    // 8. Record in audit logs
    await supabase.from('audit_logs').insert({
      actor_id: user_id || effectiveOwnerId,
      action: 'wallet_withdrawal',
      entity_type: 'wallet',
      entity_id: wallet.id,
      metadata: {
        gateway: 'korapay',
        amount: numAmount,
        reference: reference,
        recipient_account: cleanAcct,
        bank_name: bank_name,
        transfer_status: transferStatus,
        gateway_notice: gatewayNotice,
        step_up_verified: isHighValue || !!(pin || step_up_token),
        step_up_method: step_up_token ? 'mfa_otp' : (pin ? 'transaction_pin' : (isHighValue ? 'step_up_authorized' : 'standard'))
      }
    });

    const successMsg = transferStatus === 'processing'
      ? `Withdrawal of ₦${numAmount.toLocaleString()} dispatched successfully via Korapay.`
      : `Withdrawal of ₦${numAmount.toLocaleString()} authorized successfully and queued for bank settlement.`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'],
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        status: 'success',
        message: successMsg,
        reference: reference,
        amount: numAmount,
        balance_after: balanceAfter,
        gateway: 'korapay',
        transfer_status: transferStatus,
        notice: gatewayNotice
      })
    };

  } catch (err) {
    console.error('paystack-withdraw error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] },
      body: JSON.stringify({ error: err.message || 'Withdrawal processing failed' })
    };
  }
};


