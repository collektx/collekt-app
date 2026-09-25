const { getPaymentProvider } = require('./lib/payment-provider');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { authenticateRequest } = require('./lib/auth-middleware');

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return preflightResponse(event);
  }

  const headers = corsHeaders(event);

  // Authentication requirement to prevent unauthenticated NUBAN scraping & harvesting (NDPA 2023 Sec 39 / CBN Framework Sec 4.1)
  const { user, error: authError } = await authenticateRequest(event);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authentication required for bank account resolution', details: authError })
    };
  }

  // Rate limiting to prevent NUBAN account enumeration (max 60 lookups/min per user/IP)
  const rateCheck = enforceRateLimit(event, {
    action: 'bank-resolve',
    userId: user.id,
    limit: 60,
    windowMs: 60 * 1000,
    customHeaders: headers
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  let account_number, bank_code;

  if (method === 'GET') {
    account_number = event.queryStringParameters?.account_number || event.queryStringParameters?.account;
    bank_code = event.queryStringParameters?.bank_code || event.queryStringParameters?.bank;
  } else if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      account_number = body.account_number || body.account;
      bank_code = body.bank_code || body.bank;
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Invalid JSON payload' })
      };
    }
  } else {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
  const cleanBank = String(bank_code || '').trim();

  if (!cleanAcct || cleanAcct.length !== 10) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Valid 10-digit NUBAN account number is required' })
    };
  }

  if (!cleanBank) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Destination bank code is required' })
    };
  }

  // 1. Attempt resolution via Korapay
  try {
    const koraProvider = getPaymentProvider('korapay');
    const result = await koraProvider.resolveAccount({
      account_number: cleanAcct,
      bank_code: cleanBank
    });

    if (result && (result.account_name || result.accountName)) {
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          status: 'success',
          data: {
            account_number: cleanAcct,
            account_name: (result.account_name || result.accountName || '').toUpperCase().trim(),
            bank_code: cleanBank,
            provider: 'korapay'
          }
        })
      };
    }
  } catch (koraErr) {
    console.warn('Korapay resolveAccount note:', koraErr.message);
  }

  // 2. Fallback resolution via Paystack
  try {
    const paystackProvider = getPaymentProvider('paystack');
    const paystackResult = await paystackProvider.resolveAccount({
      account_number: cleanAcct,
      bank_code: cleanBank
    });

    if (paystackResult && paystackResult.account_name) {
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          status: 'success',
          data: {
            account_number: cleanAcct,
            account_name: paystackResult.account_name.toUpperCase().trim(),
            bank_code: cleanBank,
            provider: 'paystack'
          }
        })
      };
    }
  } catch (paystackErr) {
    console.warn('Paystack resolveAccount note:', paystackErr.message);
  }

  return {
    statusCode: 404,
    headers: corsHeaders(event),
    body: JSON.stringify({
      status: 'failed',
      error: 'Could not resolve bank account details. Please verify the account number and selected bank.'
    })
  };
};