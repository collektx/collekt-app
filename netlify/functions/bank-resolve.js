const { getPaymentProvider } = require('./lib/payment-provider');

exports.handler = async (event) => {
  const method = event.httpMethod;
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid JSON payload' })
      };
    }
  } else if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  } else {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
  const cleanBank = String(bank_code || '').trim();

  if (!cleanAcct || cleanAcct.length !== 10) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Valid 10-digit NUBAN account number is required' })
    };
  }

  if (!cleanBank) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      status: 'failed',
      error: 'Could not resolve bank account details. Please verify the account number and selected bank.'
    })
  };
};