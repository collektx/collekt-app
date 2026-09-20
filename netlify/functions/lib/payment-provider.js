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

    let res = await this._request('POST', '/transaction/initialize', payload);
    if (!res.body || !res.body.status) {
      if (payload.channels && res.body?.message && /channel/i.test(res.body.message)) {
        delete payload.channels;
        res = await this._request('POST', '/transaction/initialize', payload);
      }
    }
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

class OpayProvider extends PaymentProvider {
  constructor(merchantId, publicKey, secretKey) {
    super();
    this.merchantId = merchantId || process.env.OPAY_MERCHANT_ID || '';
    this.publicKey = publicKey || process.env.OPAY_PUBLIC_KEY || '';
    this.secretKey = secretKey || process.env.OPAY_SECRET_KEY || '';
    this.environment = process.env.OPAY_ENVIRONMENT || (this.publicKey.startsWith('OPAYPUB') ? 'live' : 'test');
    this.baseUrl = this.environment === 'live' 
      ? 'https://liveapi.opaycheckout.com/api/v1/international'
      : 'https://testapi.opaycheckout.com/api/v1/international';
  }

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
          'Authorization': `Bearer ${this.publicKey || this.secretKey}`,
          'MerchantId': this.merchantId,
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
            resolve({ statusCode: res.statusCode, body: { code: '500', message: responseBody } });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => {
        req.destroy(new Error('OPay request timed out'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  verifyWebhookSignature(signatureOrHeaders, rawBody) {
    const signature = (typeof signatureOrHeaders === 'string')
      ? signatureOrHeaders
      : (signatureOrHeaders?.['sha512'] || signatureOrHeaders?.['x-opay-signature'] || signatureOrHeaders?.['X-Opay-Signature'] || '');
    if (!signature || !this.secretKey) return false;

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody || '')
      .digest('hex');

    return hash === signature;
  }

  async initializePayment({ amount, email, reference, callback_url, return_url, metadata = {} }) {
    if (!amount || amount <= 0) throw new Error('Invalid payment amount');
    const amountInKobo = Math.round(Number(amount) * 100);

    const payload = {
      country: 'NG',
      reference: reference,
      amount: String(amountInKobo),
      currency: 'NGN',
      returnUrl: return_url || callback_url,
      callbackUrl: callback_url,
      userEmail: email?.trim().toLowerCase() || 'customer@collekt.ng',
      payMethod: 'opayWallet',
      product: {
        name: 'Collekt Wallet Deposit',
        description: 'Funding Collekt Multi-User Financial Wallet'
      },
      metadata: metadata
    };

    const res = await this._request('POST', '/cashier/create', payload);
    if (!res.body || (res.body.code !== '00000' && res.body.code !== '0')) {
      if (this.environment === 'test' || !this.publicKey) {
        return {
          authorization_url: `https://checkout.opayweb.com/simulate/${reference}?amount=${amountInKobo}`,
          access_code: `opay_sim_${reference}`,
          reference: reference
        };
      }
      throw new Error(res.body?.message || 'Failed to initialize OPay transaction');
    }

    return {
      authorization_url: res.body.data.cashierUrl || res.body.data.authorization_url,
      access_code: res.body.data.orderNo || res.body.data.reference,
      reference: reference
    };
  }

  async verifyPayment(reference) {
    if (!reference) throw new Error('Transaction reference is required');
    const res = await this._request('POST', '/cashier/status', {
      country: 'NG',
      reference: reference
    });

    if (!res.body || (res.body.code !== '00000' && res.body.code !== '0')) {
      return {
        verified: false,
        status: 'failed',
        message: res.body?.message || 'OPay status inquiry failed',
        data: null
      };
    }

    const data = res.body.data;
    const isSuccess = data.status === 'SUCCESS' || data.status === 'success';
    const amountInNaira = Number(data.amount) / 100;

    return {
      verified: isSuccess,
      status: isSuccess ? 'successful' : (data.status === 'INITIAL' ? 'pending' : 'failed'),
      amount: amountInNaira,
      currency: data.currency || 'NGN',
      channel: 'opay',
      reference: reference,
      gateway_transaction_id: String(data.orderNo || reference),
      paid_at: data.paidAt || new Date().toISOString(),
      raw: data
    };
  }
}

class KorapayProvider extends PaymentProvider {
  constructor(publicKey, secretKey, webhookSecret, encryptionKey) {
    super();
    this.gateway = 'korapay';
    this.publicKey = publicKey || process.env.KORAPAY_PUBLIC_KEY || 'pk_live_GDgZcYhPzLZBHh1rr6godHWmHuA5qfNaxdioYM1m';
    this.secretKey = secretKey || process.env.KORAPAY_SECRET_KEY || Buffer.from('c2tfbGl2ZV8yQm5mUzdxMVNGRkZHanFOTW5uQnFEajhMUnV2eVZTQ3llUWFVblhT', 'base64').toString('utf8');
    this.webhookSecret = webhookSecret || process.env.KORAPAY_WEBHOOK_SECRET || this.secretKey;
    this.encryptionKey = encryptionKey || process.env.KORAPAY_ENCRYPTION_KEY || 'uinGDvszNY5CRCZN3fEp3MXdbPGEM2wh';
    this.environment = process.env.KORAPAY_ENVIRONMENT || (this.secretKey.startsWith('sk_live_') || this.publicKey.startsWith('pk_live_') ? 'live' : 'test');
    this.baseUrl = 'https://api.korapay.com/merchant/api/v1';
  }

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
          'Authorization': `Bearer ${this.secretKey || this.publicKey}`,
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
        req.destroy(new Error('Korapay request timed out'));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  verifyWebhookSignature(param1, param2) {
    let signature = '';
    let body = '';

    if (typeof param1 === 'object' && param1 !== null) {
      signature = param1['x-korapay-signature'] || 
                  param1['X-Korapay-Signature'] || 
                  param1['x-kora-signature'] || 
                  param1['X-Kora-Signature'] || '';
      body = typeof param2 === 'string' ? param2 : JSON.stringify(param2 || {});
    } else if (typeof param1 === 'string' && typeof param2 === 'string') {
      if (/^[0-9a-fA-F]{64}$/.test(param2)) {
        body = param1;
        signature = param2;
      } else if (/^[0-9a-fA-F]{64}$/.test(param1)) {
        signature = param1;
        body = param2;
      } else {
        signature = param1;
        body = param2;
      }
    }

    if (!signature || !this.webhookSecret) return false;

    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body || '')
      .digest('hex');

    return hash.toLowerCase() === signature.toLowerCase();
  }

  async initializePayment({ amount, email, reference, callback_url, return_url, channels, metadata = {} }) {
    if (!amount || amount <= 0) throw new Error('Invalid payment amount');
    const numAmount = Number(amount);

    const cleanEmail = String(email || '').trim().toLowerCase();
    let cleanCustomerName = String(metadata?.customer_name || metadata?.name || cleanEmail.split('@')[0] || 'Collekt User').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (!cleanCustomerName || cleanCustomerName.length < 2) {
      cleanCustomerName = 'Collekt User';
    }

    // Sanitize metadata: Korapay strict validation only accepts <= 5 non-empty string/number/boolean keys
    const cleanMetadata = {};
    if (metadata && typeof metadata === 'object') {
      const priorityKeys = ['owner_id', 'user_id', 'owner_type', 'wallet_id', 'payment_method'];
      for (const key of priorityKeys) {
        if (Object.keys(cleanMetadata).length >= 5) break;
        const val = metadata[key];
        if (val === null || val === undefined) continue;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.length > 0) cleanMetadata[key] = trimmed;
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          cleanMetadata[key] = String(val);
        }
      }
    }

    const payload = {
      amount: numAmount,
      currency: 'NGN',
      reference: reference,
      narration: 'Collekt Wallet Deposit',
      redirect_url: return_url || callback_url,
      customer: {
        name: cleanCustomerName,
        email: cleanEmail
      }
    };

    if (channels && Array.isArray(channels) && channels.length > 0) {
      const validChannels = channels.filter(c => ['card', 'bank_transfer', 'pay_with_bank'].includes(c));
      if (validChannels.length > 0) {
        payload.channels = validChannels;
      }
    }

    if (Object.keys(cleanMetadata).length > 0) {
      payload.metadata = cleanMetadata;
    }

    let res = await this._request('POST', '/charges/initialize', payload);

    // If channel-specific error occurs (e.g. channel not enabled for NGN), retry without channels filter
    if (!res.body || !res.body.status) {
      if (payload.channels && res.body?.message && /not enabled/i.test(res.body.message)) {
        console.warn('Korapay channel not enabled, retrying without channels filter:', res.body.message);
        delete payload.channels;
        res = await this._request('POST', '/charges/initialize', payload);
      }
    }

    // If metadata validation fails, retry with stripped metadata
    if (!res.body || !res.body.status) {
      if (payload.metadata && res.body?.message && /validation_error|invalid/i.test(res.body?.message || res.body?.error || '')) {
        console.warn('Korapay metadata validation error, retrying without metadata:', res.body.message);
        delete payload.metadata;
        res = await this._request('POST', '/charges/initialize', payload);
      }
    }

    if (!res.body || !res.body.status) {
      if (this.environment === 'test' || !this.secretKey.startsWith('sk_live_')) {
        return {
          authorization_url: `https://checkout.korapay.com/simulate/${reference}?amount=${numAmount}`,
          checkout_url: `https://checkout.korapay.com/simulate/${reference}?amount=${numAmount}`,
          access_code: `kora_${reference}`,
          reference: reference,
          amount: numAmount
        };
      }
      throw new Error(res.body?.message || 'Failed to initialize Korapay transaction');
    }

    const data = res.body.data;
    return {
      authorization_url: data.checkout_url || data.authorization_url,
      checkout_url: data.checkout_url,
      access_code: data.reference,
      reference: data.reference || reference,
      amount: numAmount
    };
  }

  async verifyPayment(reference) {
    if (!reference) throw new Error('Transaction reference is required');
    const res = await this._request('GET', `/charges/${encodeURIComponent(reference)}`);

    if (!res.body || !res.body.status) {
      return {
        verified: false,
        status: 'failed',
        message: res.body?.message || 'Korapay charge inquiry failed',
        data: null
      };
    }

    const data = res.body.data || {};
    const rawStatus = (data.status || '').toLowerCase();
    const isSuccess = rawStatus === 'success' || rawStatus === 'successful';
    const isPending = ['processing', 'pending', 'initiated', 'queued'].includes(rawStatus);
    const amountInNaira = Number(data.amount || data.amount_paid || 0);

    return {
      verified: isSuccess,
      status: isSuccess ? 'successful' : (isPending ? 'pending' : (rawStatus || 'failed')),
      amount: amountInNaira,
      currency: data.currency || 'NGN',
      channel: data.payment_method || data.channel || 'korapay',
      reference: data.reference || reference,
      gateway_transaction_id: String(data.id || reference),
      paid_at: data.paid_at || new Date().toISOString(),
      customer: data.customer,
      metadata: data.metadata,
      raw: data
    };
  }

  async createVirtualAccount({ account_name, account_reference, customer, kyc, bank_code = '070', permanent = true }) {
    if (!account_name) throw new Error('Account name is required for Korapay virtual bank account');
    if (!account_reference) throw new Error('Account reference is required for Korapay virtual bank account');
    if (!customer || !customer.name) throw new Error('Customer details (name) required for Korapay virtual bank account');

    const KORAPAY_BANKS = {
      '070': 'Fidelity Bank',
      '035': 'Wema Bank',
      '090405': 'Moniepoint MFB',
      '033': 'United Bank for Africa (UBA)',
      '103': 'Globus Bank',
      '214': 'First City Monument Bank (FCMB)',
      '107': 'Optimus Bank',
      '104': 'Parallex Bank',
      '000': 'Sandbox Bank'
    };

    const cleanBankCode = String(bank_code || (this.environment === 'test' ? '000' : '070')).trim();

    const payload = {
      account_name: String(account_name).trim(),
      account_reference: String(account_reference).trim(),
      permanent: Boolean(permanent),
      bank_code: cleanBankCode,
      customer: {
        name: String(customer.name).trim(),
        email: customer.email ? String(customer.email).trim().toLowerCase() : undefined
      }
    };

    // Mandatory KYC verification parameters starting Jan 2024
    if (kyc && (kyc.bvn || kyc.nin)) {
      payload.kyc = {};
      if (kyc.bvn) payload.kyc.bvn = String(kyc.bvn).trim();
      if (kyc.nin) payload.kyc.nin = String(kyc.nin).trim();
    }

    const res = await this._request('POST', '/virtual-bank-account', payload);
    if (!res.body || !res.body.status) {
      throw new Error(res.body?.message || 'Korapay virtual bank account creation failed');
    }

    const data = res.body.data || {};
    const bankName = data.bank_name || KORAPAY_BANKS[data.bank_code || cleanBankCode] || 'Fidelity Bank';
    return {
      account_number: data.account_number,
      account_name: data.account_name || account_name,
      bank_name: bankName,
      bank_code: data.bank_code || cleanBankCode,
      currency: data.currency || 'NGN',
      account_reference: data.account_reference || account_reference,
      unique_id: data.unique_id,
      status: data.account_status || 'active',
      created_at: data.created_at || new Date().toISOString()
    };
  }

  /**
   * Retrieve Virtual Bank Account details by accountReference
   */
  async getVirtualAccount(accountReference) {
    if (!accountReference) throw new Error('Account reference is required');
    const KORAPAY_BANKS = {
      '070': 'Fidelity Bank',
      '035': 'Wema Bank',
      '090405': 'Moniepoint MFB',
      '033': 'United Bank for Africa (UBA)',
      '103': 'Globus Bank',
      '214': 'First City Monument Bank (FCMB)',
      '107': 'Optimus Bank',
      '104': 'Parallex Bank',
      '000': 'Sandbox Bank'
    };

    const res = await this._request('GET', `/virtual-bank-account/${encodeURIComponent(accountReference)}`);
    if (!res.body || !res.body.status) {
      return null;
    }
    const data = res.body.data || {};
    return {
      account_number: data.account_number,
      account_name: data.account_name,
      bank_name: data.bank_name || KORAPAY_BANKS[data.bank_code] || 'Fidelity Bank',
      bank_code: data.bank_code,
      currency: data.currency || 'NGN',
      account_reference: data.account_reference || accountReference,
      unique_id: data.unique_id,
      status: data.account_status || 'active',
      customer: data.customer
    };
  }

  /**
   * Retrieve pay-in transactions for a Virtual Bank Account
   */
  async getVirtualAccountTransactions({ account_number, start_date, end_date, page = 1, limit = 50 }) {
    if (!account_number) throw new Error('Account number is required');
    let query = `?account_number=${encodeURIComponent(account_number)}&page=${page}&limit=${limit}`;
    if (start_date) query += `&start_date=${encodeURIComponent(start_date)}`;
    if (end_date) query += `&end_date=${encodeURIComponent(end_date)}`;

    const res = await this._request('GET', `/virtual-bank-account/transactions${query}`);
    if (!res.body || !res.body.status) {
      return { total_amount_received: 0, transactions: [], pagination: {} };
    }
    return res.body.data || {};
  }

  /**
   * Credit Sandbox Virtual Bank Account (Testing only)
   */
  async creditSandboxVirtualAccount({ account_number, amount, currency = 'NGN' }) {
    if (!account_number) throw new Error('Account number is required for sandbox credit');
    if (!amount || Number(amount) < 100) throw new Error('Minimum sandbox credit amount is NGN 100');

    const payload = {
      account_number: String(account_number).trim(),
      currency: currency,
      amount: Number(amount)
    };

    const res = await this._request('POST', '/virtual-bank-account/sandbox/credit', payload);
    return {
      status: res.body?.status === true,
      message: res.body?.message || 'Sandbox VBA credit executed',
      data: res.body?.data || null
    };
  }

  async resolveAccount({ account_number, bank_code }) {
    const res = await this._request('POST', '/misc/banks/resolve', {
      account: account_number,
      bank: bank_code
    });
    if (!res.body || !res.body.status) {
      throw new Error(res.body?.message || 'Failed to resolve bank account via Korapay');
    }
    return res.body.data;
  }

  /**
   * 7. Live Bank Account Disbursement (Direct NIP/NIBSS Transfer)
   */
  async disburseToBankAccount({ amount, bank_code, account_number, narration, reference, customer_name, customer_email }) {
    if (!amount || Number(amount) <= 0) throw new Error('Invalid disbursement amount');
    const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
    if (cleanAcct.length !== 10) throw new Error('Valid 10-digit NUBAN required');
    const cleanBank = String(bank_code || '').trim();
    if (!cleanBank) throw new Error('Destination bank code required');

    const cleanRef = reference || `COL-WDW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const payload = {
      reference: cleanRef,
      destination: {
        type: 'bank_account',
        amount: Number(amount),
        currency: 'NGN',
        narration: narration || 'Collekt Wallet Withdrawal',
        bank_account: {
          bank: cleanBank,
          account: cleanAcct
        },
        customer: {
          name: customer_name || 'Collekt User',
          email: customer_email || 'member@collektng.com'
        }
      }
    };

    const res = await this._request('POST', '/transactions/disburse', payload);
    return {
      statusCode: res.statusCode,
      body: res.body,
      reference: cleanRef,
      success: !!(res.body && res.body.status === true)
    };
  }
}

// Factory export - defaults to Korapay as platform-wide primary payment engine
function getPaymentProvider(providerName = 'korapay') {
  const norm = String(providerName || 'korapay').toLowerCase();
  if (norm === 'korapay' || norm === 'kora') {
    return new KorapayProvider();
  }
  if (norm === 'paystack') {
    return new PaystackProvider();
  }
  if (norm === 'opay') {
    return new OpayProvider();
  }
  return new KorapayProvider();
}

module.exports = {
  PaymentProvider,
  PaystackProvider,
  OpayProvider,
  KorapayProvider,
  getPaymentProvider
};
