const { supabase } = require('./lib/supabase-client');
const { getPaymentProvider } = require('./lib/payment-provider');

exports.handler = async (event) => {
  const method = event.httpMethod;

  try {
    let body = {};
    let owner_id, user_id, owner_type, email, first_name, last_name, phone, company_name, name, displayName;

    if (method === 'GET') {
      owner_id = event.queryStringParameters?.owner_id || event.queryStringParameters?.user_id || event.queryStringParameters?.userId || event.queryStringParameters?.ownerId;
    } else if (method === 'POST') {
      body = JSON.parse(event.body || '{}');
      owner_id = body.owner_id || body.user_id || body.ownerId || body.userId;
      user_id = body.user_id || body.userId || owner_id;
      owner_type = body.owner_type || body.ownerType || 'professional';
      email = body.email;
      first_name = body.first_name || body.firstName;
      last_name = body.last_name || body.lastName;
      phone = body.phone;
      company_name = body.company_name || body.companyName;
      name = body.name;
      displayName = body.displayName;
    } else {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    if (!owner_id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Account owner ID is required' })
      };
    }

    // Normalize owner_id to valid UUID format
    let effectiveOwnerId = owner_id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveOwnerId);
    if (!isUUID) {
      const hash = require('crypto').createHash('md5').update(String(effectiveOwnerId)).digest('hex');
      effectiveOwnerId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
    }

    // 1. Check if Dedicated Virtual Account already exists in database
    const { data: existingDva } = await supabase
      .from('virtual_accounts')
      .select('*')
      .eq('owner_id', effectiveOwnerId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingDva) {
      let finalName = existingDva.account_name || '';
      if (!finalName || finalName.includes('COLLEKT MEMBER') || finalName.includes('COLLEKT / MEMBER') || finalName.trim() === 'COLLEKT /' || finalName.trim() === 'COLLEKT') {
        // Fetch profile to get real name and auto-repair database row
        const { data: prof } = await supabase.from('profiles').select('name, company_name, first_name, other_name, last_name, email').eq('id', effectiveOwnerId).maybeSingle();
        let repairName = prof?.company_name || prof?.name || [prof?.first_name, prof?.other_name, prof?.last_name].filter(Boolean).join(' ');
        if (!repairName && prof?.email) repairName = prof.email.split('@')[0].replace(/[._-]/g, ' ');
        if (!repairName) repairName = 'ACCOUNT HOLDER';
        finalName = `COLLEKT / ${repairName.toUpperCase()}`;
        await supabase.from('virtual_accounts').update({ account_name: finalName }).eq('id', existingDva.id);
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
          status: 'success',
          virtual_account: {
            account_number: existingDva.account_number,
            account_name: finalName,
            bank_name: existingDva.bank_name,
            bank_code: existingDva.bank_code,
            currency: existingDva.currency || 'NGN',
            status: existingDva.status,
            provider: existingDva.provider
          }
        })
      };
    }

    // If GET and no DVA exists yet, return not found so frontend can trigger generation
    if (method === 'GET') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'not_found', message: 'No dedicated virtual account provisioned yet' })
      };
    }

    // 2. Fetch profile from Supabase to get complete user/company information
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveOwnerId)
      .maybeSingle();

    const customerEmail = (email || profile?.email || '').trim().toLowerCase();
    
    // Resolve authentic personal or company name (Never fallback to generic 'Collekt Member')
    let rawFullName = (body.name || body.displayName || company_name || profile?.company_name || profile?.name || '').trim();
    if (!rawFullName || rawFullName.toLowerCase() === 'collekt member' || rawFullName.toLowerCase() === 'user' || rawFullName.toLowerCase() === 'guest') {
      rawFullName = [profile?.first_name || first_name, profile?.other_name, profile?.last_name || last_name].filter(Boolean).join(' ').trim();
    }
    if (!rawFullName && customerEmail) {
      rawFullName = customerEmail.split('@')[0].replace(/[._-]/g, ' ');
    }
    if (!rawFullName) rawFullName = 'Account Holder';

    const customerFirstName = first_name || profile?.first_name || rawFullName.split(' ')[0] || 'Member';
    const customerLastName = last_name || profile?.last_name || rawFullName.split(' ').slice(1).join(' ') || 'Account';
    const customerPhone = phone || profile?.phone || '';
    const preferredName = (company_name || profile?.company_name || rawFullName).toUpperCase();

    if (!customerEmail) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Valid email address is required to provision virtual account' })
      };
    }

    // 3. Provision Dedicated Virtual Account (Korapay primary, Paystack fallback)
    let dvaResult = null;
    let usedProvider = 'korapay';
    const koraAccountRef = `kora_dva_${effectiveOwnerId.replace(/-/g, '').substring(0, 12)}_${Date.now()}`;
    const formattedAcctName = `COLLEKT / ${preferredName}`;

    try {
      const koraProvider = getPaymentProvider('korapay');
      dvaResult = await koraProvider.createVirtualAccount({
        account_name: formattedAcctName,
        account_reference: koraAccountRef,
        bank_code: '000',
        permanent: true,
        customer: {
          name: preferredName,
          email: customerEmail
        }
      });
      usedProvider = 'korapay';
    } catch (koraErr) {
      console.warn('Korapay DVA creation note:', koraErr.message);
      try {
        const paystackProvider = getPaymentProvider('paystack');
        dvaResult = await paystackProvider.createVirtualAccount({
          first_name: customerFirstName,
          last_name: customerLastName,
          email: customerEmail,
          phone: customerPhone,
          preferred_bank: 'wema-bank'
        });
        usedProvider = 'paystack';
        if (dvaResult && (!dvaResult.account_name || dvaResult.account_name.includes('COLLEKT MEMBER'))) {
          dvaResult.account_name = formattedAcctName;
        }
      } catch (paystackErr) {
        console.warn('Paystack DVA creation note:', paystackErr.message);
      }
    }

    if (!dvaResult || !dvaResult.account_number) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
          status: 'instant_checkout_ready',
          requires_instant_checkout: true,
          message: 'Direct Bank Transfer available via live Korapay rails',
          provider: 'korapay'
        })
      };
    }

    // 4. Save authentic account to virtual_accounts table in Supabase
    const { data: savedDva, error: saveError } = await supabase
      .from('virtual_accounts')
      .insert({
        owner_id: effectiveOwnerId,
        user_id: effectiveOwnerId,
        provider: usedProvider,
        provider_customer_id: dvaResult.provider_customer_id || customerEmail,
        provider_account_id: dvaResult.account_reference || dvaResult.provider_account_id || koraAccountRef,
        account_number: dvaResult.account_number,
        account_name: dvaResult.account_name || formattedAcctName,
        bank_name: dvaResult.bank_name || 'Wema Bank / Sterling Bank',
        bank_code: dvaResult.bank_code || '000',
        currency: dvaResult.currency || 'NGN',
        status: dvaResult.status || 'active',
        metadata: {
          provisioned_at: new Date().toISOString(),
          customer_email: customerEmail,
          provider: usedProvider
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save virtual account to database:', saveError);
    }

    // 5. Sync to wallets table
    await supabase
      .from('wallets')
      .update({
        paystack_dva_account: dvaResult.account_number,
        paystack_dva_bank: dvaResult.bank_name,
        paystack_dva_name: dvaResult.account_name || formattedAcctName,
        paystack_customer_code: dvaResult.provider_customer_id || customerEmail,
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', effectiveOwnerId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        status: 'success',
        virtual_account: {
          account_number: dvaResult.account_number,
          account_name: dvaResult.account_name || formattedAcctName,
          bank_name: dvaResult.bank_name,
          bank_code: dvaResult.bank_code,
          currency: dvaResult.currency || 'NGN',
          status: dvaResult.status || 'active',
          provider: usedProvider
        }
      })
    };

  } catch (err) {
    console.error('paystack-dva error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Virtual account provisioning failed' })
    };
  }
};
