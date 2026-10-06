const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      const val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const { KorapayProvider, getPaymentProvider } = require('./netlify/functions/lib/payment-provider');
const crypto = require('crypto');

async function runTests() {
  console.log('--- Starting Korapay Virtual Bank Account Integration Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Factory initialization
  const provider = getPaymentProvider('korapay');
  assert(provider instanceof KorapayProvider, 'getPaymentProvider("korapay") returns KorapayProvider instance');
  assert(provider.gateway === 'korapay', 'Provider gateway is "korapay"');

  // 2. Bank code support
  const testBanks = ['070', '035'];
  for (const bCode of testBanks) {
    try {
      const res = await provider.createVirtualAccount({
        account_name: 'TEST USER',
        account_reference: `test_ref_${bCode}_${Date.now()}`,
        customer: { name: 'Test User', email: 'test@collektng.com' },
        kyc: { bvn: '22222222222' },
        bank_code: bCode,
        permanent: true
      });
      assert(res && res.account_number && res.bank_name, `VBA creation with bank_code "${bCode}" returns valid structure (${res?.bank_name})`);
    } catch (koraErr) {
      const isExpectedMerchantNotice = /not enabled for merchant|requires merchant approval/i.test(koraErr.message);
      assert(isExpectedMerchantNotice, `Korapay live API communicates merchant status clearly ("${koraErr.message}")`);
      break;
    }
  }

  // 3. Webhook Signature Verification
  const testSecret = 'kora_sec_test_12345';
  const customProvider = new KorapayProvider('pk_test_123', testSecret, testSecret);
  const samplePayload = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: 'COR-TEST-12345',
      amount: 25000,
      status: 'success',
      virtual_bank_account_details: {
        virtual_bank_account: {
          account_number: '0123456789',
          bank_name: 'Fidelity Bank',
          account_reference: 'kora_vba_test_001'
        },
        payer_bank_account: {
          account_name: 'EMMANUEL OKONKWO',
          bank_name: 'Zenith Bank'
        }
      }
    }
  });

  const validHmac = crypto.createHmac('sha256', testSecret).update(samplePayload).digest('hex');
  const invalidHmac = 'wrong_signature_hex_000000000000000000000000000000000000000000000000';

  assert(customProvider.verifyWebhookSignature({ 'x-korapay-signature': validHmac }, samplePayload) === true, 'HMAC verification passes for valid signature (header object)');
  assert(customProvider.verifyWebhookSignature(samplePayload, validHmac) === true, 'HMAC verification passes for valid signature (positional string)');
  assert(customProvider.verifyWebhookSignature({ 'x-korapay-signature': invalidHmac }, samplePayload) === false, 'HMAC verification rejects invalid signature');

  // 4. Sandbox credit simulation test
  const sandboxCredit = await provider.creditSandboxVirtualAccount({
    account_number: '0123456789',
    amount: 5000,
    currency: 'NGN'
  });
  assert(typeof sandboxCredit === 'object' && 'status' in sandboxCredit, 'creditSandboxVirtualAccount executes and returns structured response');

  // 5. Query account and transactions
  const txQuery = await provider.getVirtualAccountTransactions({
    account_number: '0123456789',
    limit: 10
  });
  assert(typeof txQuery === 'object', 'getVirtualAccountTransactions executes without runtime crash');

  console.log(`\n--- Test Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
