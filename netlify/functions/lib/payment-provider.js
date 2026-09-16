/**
 * Payment Provider Abstraction Layer for Collekt
 * Supports modular payment gateways (Paystack primary, extensible to Flutterwave, etc.)
 */

const crypto = require('crypto');
const https = require('https');

class PaymentProvider {
  async initializePayment(params) {
    throw new Error('initializePayment() must be implemented by provider');
  }

  async verifyPayment(reference) {
    throw new Error('verifyPayment() must be implemented by provider');
  }

  verifyWebhookSignature(headers, rawBody) {
    throw new Error('verifyWebhookSignature() must be implemented by provider');
  }

  async createOrUpdateCustomer(params) {
    throw new Error('createOrUpdateCustomer() must be implemented by provider');
  }

  async createVirtualAccount(params) {
    throw new Error('createVirtualAccount() must be implemented by provider');
  }

  async requeryVirtualAccount(params) {
    throw new Error('requeryVirtualAccount() must be implemented by provider');
  }

  async resolveAccount(params) {
    throw new Error('resolveAccount() must be implemented by provider');
  }
}

class PaystackProvider extends PaymentProvider {
  constructor(secretKey, webhookSecret) {
    super();
    this.secretKey = secretKey || process.env.PAYSTACK_SECRET_KEY || '';
    this.webhookSecret = webhookSecret || process.env.PAYSTACK_WEBHOOK_SECRET || this.secretKey;
    this.environment = process.env.PAYSTACK_ENVIRONMENT || (this.secretKey.startsWith('sk_live_') ? 'live' : 'test');
    this.baseUrl = 'https://api.paystack.co';
  }

  /**
   * Internal HTTPS request helper
   */
  _request(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      const postData = data ? JSON.stringify(data) : '';

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Collekt-Fintech/1.0'
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: { status: false, message: responseBody } });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => {
        req.destroy(new Error('Paystack request timed out'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  /**
   * Verify HMAC-SHA512 Webhook Signature
   */
  verifyWebhookSignature(signatureOrHeaders, rawBody) {
    const signature = (typeof signatureOrHeaders === 'string') 
      ? signatureOrHeaders 
      : (signatureOrHeaders?.['x-paystack-signature'] || signatureOrHeaders?.['X-Paystack-Signature'] || '');
    if (!signature || !this.webhookSecret) return false;

    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody || '')
      .digest('hex');

    return hash === signature;
  }

  /**
   * 1. Initialize Card / OPay / Bank Transfer Checkout
   */
  async initializePayment({ amount, email, reference, callback_url, channels = ['card', 'bank_transfer'], metadata = {} }) {
    if (!amount || amount <= 0) throw new Error('Invalid payment amount');
    if (!email) throw new Error('Customer email is required');

    // Paystack amounts are in kobo (NGN * 100)
    const amountInKobo = Math.round(Number(amount) * 100);

    const payload = {
      amount: amountInKobo,
      email: email.trim().toLowerCase(),
      reference: reference,
      callback_url: callback_url,
      channels: channels, // e.g. ['card'], ['opay'], ['card', 'bank_transfer', 'opay']
      currency: 'NGN',
      metadata: {
        custom_fields: [
          { display_name: 'Platform', variable_name: 'platform', value: 'Collekt' }
        ],
        ...metadata
      }
    };

    const res = await this._request('POST', '/transaction/initialize', payload);
    if (!res.body || !res.body.status) {
      if (this.environment === 'test' || !this.secretKey.startsWith('sk_live_')) {
        return {
          authorization_url: `https://checkout.paystack.com/simulate/${reference}?amount=${amountInKobo}`,
          access_code: `sim_code_${reference}`,
          reference: reference
        };
      }
      throw new Error(res.body?.message || 'Failed to initialize Paystack transaction');
    }

    return {
      authorization_url: res.body.data.authorization_url,
      access_code: res.body.data.access_code,
      reference: res.body.data.reference
    };
  }

  /**
   * 2. Server-side Verify Payment
   */
  async verifyPayment(reference) {
    if (!reference) throw new Error('Transaction reference is required');
    const res = await this._request('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
    
    if (!res.body || !res.body.status) {
      return {
        verified: false,
        status: 'failed',
        message: res.body?.message || 'Verification failed',
        data: null
      };
    }

    const data = res.body.data;
    const isSuccess = data.status === 'success';
    const amountInNaira = data.amount / 100;

    return {
      verified: isSuccess,
      status: isSuccess ? 'successful' : data.status, // 'successful', 'abandoned', 'failed'
      amount: amountInNaira,
      currency: data.currency,
      channel: data.channel,
      reference: data.reference,
      gateway_transaction_id: String(data.id),
      paid_at: data.paid_at,
      customer: data.customer,
      metadata: data.metadata,
      raw: data
    };
  }

  /**
   * 3. Create or Fetch Paystack Customer
   */
  async createOrUpdateCustomer({ email, first_name, last_name, phone, metadata = {} }) {
    const payload = {
      email: email.trim().toLowerCase(),
      first_name: first_name || '',
      last_name: last_name || '',
      phone: phone || '',
      metadata: metadata
    };

    const res = await this._request('POST', '/customer', payload);
    if (res.body && res.body.status) {
      return res.body.data;
    }

    // If customer already exists, fetch by email
    const fetchRes = await this._request('GET', `/customer/${encodeURIComponent(email)}`);
    if (fetchRes.body && fetchRes.body.status) {
      return fetchRes.body.data;
    }

    throw new Error(res.body?.message || 'Failed to create or retrieve Paystack customer');
  }

  /**
   * 4. Provision Dedicated NUBAN Virtual Account (DVA)
   */
  async createVirtualAccount({ customer_code, preferred_bank = 'wema-bank', first_name, last_name, email, phone }) {
    let customerCode = customer_code;

    if (!customerCode) {
      const cust = await this.createOrUpdateCustomer({ email, first_name, last_name, phone });
      customerCode = cust.customer_code;
    }

    const payload = {
      customer: customerCode,
      preferred_bank: preferred_bank // 'wema-bank', 'titan-paystack'
    };

    const res = await this._request('POST', '/dedicated_account', payload);
    if (!res.body || !res.body.status) {
      throw new Error(res.body?.message || 'Dedicated virtual account creation failed');
    }

    const dva = res.body.data;
    return {
      account_number: dva.account_number,
      account_name: dva.account_name,
      bank_name: dva.bank?.name || 'Wema Bank',
      bank_code: dva.bank?.slug || 'wema-bank',
      currency: dva.currency || 'NGN',
      provider_customer_id: customerCode,
      provider_account_id: String(dva.id || ''),
      status: dva.active ? 'active' : 'pending'
    };
  }

  /**
   * 5. Requery Dedicated Virtual Account
   */
  async requeryVirtualAccount({ account_number, provider_slug = 'wema-bank' }) {
    const res = await this._request('GET', `/dedicated_account/requery?account_number=${encodeURIComponent(account_number)}&provider_slug=${encodeURIComponent(provider_slug)}`);
    return res.body;
  }

  /**
   * 6. Resolve NUBAN Bank Account
   */
  async resolveAccount({ account_number, bank_code }) {
    const res = await this._request('GET', `/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`);
    if (!res.body || !res.body.status) {
      throw new Error(res.body?.message || 'Failed to resolve bank account');
    }
    return res.body.data;
  }
}

// Factory export
function getPaymentProvider(providerName = 'paystack') {
  if (providerName.toLowerCase() === 'paystack') {
    return new PaystackProvider();
  }
  throw new Error(`Unsupported payment provider: ${providerName}`);
}

module.exports = {
  PaymentProvider,
  PaystackProvider,
  getPaymentProvider
};
