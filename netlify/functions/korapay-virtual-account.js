const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');
const crypto = require('crypto');
const { corsHeaders: buildCorsHeaders, preflightResponse } = require('./lib/cors');

exports.handler = async (event) => {
  const method = event.httpMethod;

  // CORS headers resolved from hardened allowlist (never wildcard)
  const headers = buildCorsHeaders(event);

  if (method === 'OPTIONS') {
    return preflightResponse(event);
  }

  try {
    const koraProvider = getPaymentProvider('korapay');

    // ─────────────────────────────────────────────────────────
    // 1. GET: Query Virtual Account by ownerId / accountReference / transactions
    // ─────────────────────────────────────────────────────────
    if (method === 'GET') {
      const q = event.queryStringParameters || {};
      const ownerId = q.owner_id || q.user_id || q.userId || q.ownerId;
      const accountRef = q.account_reference || q.accountReference || q.ref;
      const accountNumber = q.account_number || q.accountNumber;
      const action = q.action || '';

      // Query transactions on Virtual Account
      if (action === 'transactions' && accountNumber) {
        const txData = await koraProvider.getVirtualAccountTransactions({
          account_number: accountNumber,
          start_date: q.start_date,
          end_date: q.end_date,
          page: Number(q.page || 1),
          limit: Number(q.limit || 50)
        });
        return { statusCode: 200, headers, body: JSON.stringify({ status: true, data: txData }) };
      }

      // Query by account reference directly from Korapay
      if (accountRef) {
        const vbaDetails = await koraProvider.getVirtualAccount(accountRef);
        if (vbaDetails) {
          return { statusCode: 200, headers, body: JSON.stringify({ status: true, data: vbaDetails }) };
        }
      }

      // Query by ownerId from Supabase database
      if (ownerId) {
        let effectiveOwnerId = ownerId;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveOwnerId);
        if (!isUUID) {
          const hash = crypto.createHash('md5').update(String(effectiveOwnerId)).digest('hex');
          effectiveOwnerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
        }

        const { data: vba } = await supabase
          .from('virtual_accounts')
          .select('*')
          .eq('owner_id', effectiveOwnerId)
          .eq('status', 'active')
          .maybeSingle();

        if (vba) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              status: true,
              data: {
                account_number: vba.account_number,
                account_name: vba.account_name,
                bank_name: vba.bank_name,
                bank_code: vba.bank_code,
                currency: vba.currency || 'NGN',
                account_reference: vba.provider_account_id,
                status: vba.status,
                provider: vba.provider
              }
            })
          };
        }

        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ status: false, message: 'No virtual bank account provisioned yet' })
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: false, message: 'owner_id or account_reference is required' })
      };
    }

    // ─────────────────────────────────────────────────────────
    // 2. POST: Create Virtual Bank Account or Credit Sandbox Account
    // ─────────────────────────────────────────────────────────
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const action = body.action || '';

      // Action: Credit Sandbox Virtual Account
      if (action === 'credit_sandbox') {
        const { account_number, amount, currency } = body;
        const result = await koraProvider.creditSandboxVirtualAccount({
          account_number,
          amount: amount || 5000,
          currency: currency || 'NGN'
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result)
        };
      }

      // Action: Create Permanent Virtual Bank Account
      const rawOwnerId = body.owner_id || body.user_id || body.ownerId || body.userId;
      if (!rawOwnerId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ status: false, message: 'owner_id is required' })
        };
      }

      let effectiveOwnerId = rawOwnerId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveOwnerId);
      if (!isUUID) {
        const hash = crypto.createHash('md5').update(String(effectiveOwnerId)).digest('hex');
        effectiveOwnerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
      }

      // Check existing in Supabase
      const { data: existingVba } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('owner_id', effectiveOwnerId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingVba) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: true,
            message: 'Virtual bank account retrieved successfully',
            data: {
              account_number: existingVba.account_number,
              account_name: existingVba.account_name,
              bank_name: existingVba.bank_name,
              bank_code: existingVba.bank_code,
              currency: existingVba.currency || 'NGN',
              account_reference: existingVba.provider_account_id,
              status: existingVba.status,
              provider: existingVba.provider
            }
          })
        };
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', effectiveOwnerId)
        .maybeSingle();

      const customerEmail = (body.email || profile?.email || '').trim().toLowerCase();
      let customerName = (body.name || body.displayName || profile?.company_name || profile?.name || '').trim();
      if (!customerName || customerName.toLowerCase() === 'collekt member') {
        customerName = [profile?.first_name, profile?.other_name, profile?.last_name].filter(Boolean).join(' ').trim();
      }
      if (!customerName && customerEmail) {
        customerName = customerEmail.split('@')[0].replace(/[._-]/g, ' ');
      }
      if (!customerName) customerName = 'Account Holder';

      const preferredName = customerName.toUpperCase();
      const formattedAcctName = `COLLEKT / ${preferredName}`;
      const accountRef = `kora_vba_${effectiveOwnerId.replace(/-/g, '').substring(0, 12)}_${Date.now()}`;

      // KYC data
      const userBvn = body.bvn || body.kyc?.bvn || profile?.bvn || profile?.kyc_bvn || profile?.metadata?.bvn;
      const userNin = body.nin || body.kyc?.nin || profile?.nin || profile?.kyc_nin || profile?.metadata?.nin;
      const kycData = (userBvn || userNin) ? { bvn: userBvn, nin: userNin } : undefined;

      const bankCode = body.bank_code || body.bankCode || '070'; // Default 070 Fidelity Bank

      let vbaRes;
      try {
        vbaRes = await koraProvider.createVirtualAccount({
          account_name: formattedAcctName,
          account_reference: accountRef,
          bank_code: bankCode,
          permanent: true,
          customer: {
            name: preferredName,
            email: customerEmail
          },
          kyc: kycData
        });
      } catch (koraErr) {
        console.warn('Korapay VBA creation failed:', koraErr.message);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: false,
            requires_instant_checkout: true,
            message: koraErr.message || 'Dedicated Virtual Bank Accounts require merchant approval from Korapay. Instant Bank Transfer funding is available.',
            provider: 'korapay'
          })
        };
      }

      if (!vbaRes || !vbaRes.account_number) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: false,
            requires_instant_checkout: true,
            message: 'Live Bank Transfer available via Korapay Checkout',
            provider: 'korapay'
          })
        };
      }

      // Save to Supabase virtual_accounts
      await supabase
        .from('virtual_accounts')
        .insert({
          owner_id: effectiveOwnerId,
          user_id: effectiveOwnerId,
          provider: 'korapay',
          provider_customer_id: customerEmail,
          provider_account_id: accountRef,
          account_number: vbaRes.account_number,
          account_name: vbaRes.account_name || formattedAcctName,
          bank_name: vbaRes.bank_name,
          bank_code: vbaRes.bank_code || bankCode,
          currency: vbaRes.currency || 'NGN',
          status: vbaRes.status || 'active',
          metadata: {
            provisioned_at: new Date().toISOString(),
            customer_email: customerEmail,
            provider: 'korapay',
            bank_code: bankCode
          }
        });

      // Sync to wallets table
      await supabase
        .from('wallets')
        .update({
          paystack_dva_account: vbaRes.account_number,
          paystack_dva_bank: vbaRes.bank_name,
          paystack_dva_name: vbaRes.account_name || formattedAcctName,
          updated_at: new Date().toISOString()
        })
        .eq('owner_id', effectiveOwnerId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: true,
          message: 'Virtual bank account created successfully',
          data: {
            account_number: vbaRes.account_number,
            account_name: vbaRes.account_name || formattedAcctName,
            bank_name: vbaRes.bank_name,
            bank_code: vbaRes.bank_code,
            currency: 'NGN',
            account_reference: accountRef,
            status: 'active',
            provider: 'korapay'
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: false, message: 'Method Not Allowed' })
    };

  } catch (err) {
    console.error('korapay-virtual-account error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: false, message: err.message || 'Server error' })
    };
  }
};
