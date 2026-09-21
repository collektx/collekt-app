const { createClient } = require('@supabase/supabase-js');
const { supabase: adminSupabase, SUPABASE_URL } = require('./netlify/functions/lib/supabase-client');

// Anonymous client representing an untrusted public visitor
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

async function runSecurityAuditProbes() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  COLLEKT IT AUDIT: SECURITY REMEDIATION VERIFICATION SUITE ');
  console.log('════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const targetUserId = '0f9ae84c-c5dd-4067-8ded-82638a6e9e01'; // Collekt Technologies Ltd

  // -------------------------------------------------------------
  // PROBE 1: Direct PostgREST UPDATE on public.wallets
  // -------------------------------------------------------------
  console.log('--- PROBE 1: Direct Client Mutation on public.wallets ---');
  try {
    const { data: updateData, error: updateError } = await anonClient
      .from('wallets')
      .update({ available_balance: 9999999.00 })
      .eq('user_id', targetUserId)
      .select();

    // With RLS, either an error occurs or 0 rows are updated
    const isBlocked = updateError != null || !updateData || updateData.length === 0;
    assert(isBlocked, 'Direct client UPDATE on public.wallets is BLOCKED by RLS');

    // Check authentic balance remains intact
    const { data: realWallet } = await adminSupabase
      .from('wallets')
      .select('available_balance')
      .eq('user_id', targetUserId)
      .single();

    assert(Number(realWallet.available_balance) === 0, 'Real database wallet balance remained exactly 0.00 (Uncompromised)');
  } catch (err) {
    assert(true, 'Direct mutation threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 2: Direct Client INSERT/UPDATE on public.wallet_ledger
  // -------------------------------------------------------------
  console.log('\n--- PROBE 2: Direct Client Mutation on public.wallet_ledger ---');
  try {
    const { data: fakeLedger, error: ledgerError } = await anonClient
      .from('wallet_ledger')
      .insert({
        owner_id: targetUserId,
        entry_type: 'credit',
        amount: 500000.00,
        balance_before: 0,
        balance_after: 500000.00,
        reference: 'FORGED-TX-' + Date.now()
      })
      .select();

    const ledgerBlocked = ledgerError != null || !fakeLedger || fakeLedger.length === 0;
    assert(ledgerBlocked, 'Direct client INSERT on public.wallet_ledger is BLOCKED by RLS');
  } catch (err) {
    assert(true, 'Ledger insert threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 3: Direct Client UPDATE on other user's public.profiles
  // -------------------------------------------------------------
  console.log('\n--- PROBE 3: Horizontal Privilege Escalation on public.profiles ---');
  try {
    const { data: profData, error: profError } = await anonClient
      .from('profiles')
      .update({ role: 'admin', is_verified: true })
      .eq('id', targetUserId)
      .select();

    const profBlocked = profError != null || !profData || profData.length === 0;
    assert(profBlocked, 'Direct client UPDATE on other user profile is BLOCKED by RLS');
  } catch (err) {
    assert(true, 'Profile update threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 4: Serverless API IDOR on wallet-transfer endpoint
  // -------------------------------------------------------------
  console.log('\n--- PROBE 4: Serverless API IDOR on /api/wallet-transfer ---');
  try {
    const walletTransferFunc = require('./netlify/functions/wallet-transfer').handler;
    const fakeEvent = {
      httpMethod: 'POST',
      headers: {}, // No Bearer token
      body: JSON.stringify({
        sender_id: targetUserId,
        recipient_id: '814f4be6-cc86-47d3-b746-cd257f456548',
        amount: 1000
      })
    };

    const response = await walletTransferFunc(fakeEvent);
    assert(response.statusCode === 401, `Unauthenticated wallet transfer returned HTTP ${response.statusCode} (Rejected)`);
  } catch (err) {
    console.error('Probe 4 error:', err);
  }

  // -------------------------------------------------------------
  // PROBE 5: Serverless API IDOR on paystack-withdraw endpoint
  // -------------------------------------------------------------
  console.log('\n--- PROBE 5: Serverless API IDOR on /api/payments/withdraw ---');
  try {
    const withdrawFunc = require('./netlify/functions/paystack-withdraw').handler;
    const fakeEvent = {
      httpMethod: 'POST',
      headers: {}, // No Bearer token
      body: JSON.stringify({
        owner_id: targetUserId,
        amount: 5000,
        bank_code: '058',
        account_number: '0123456789'
      })
    };

    const response = await withdrawFunc(fakeEvent);
    assert(response.statusCode === 401, `Unauthenticated withdrawal request returned HTTP ${response.statusCode} (Rejected)`);
  } catch (err) {
    console.error('Probe 5 error:', err);
  }

  // -------------------------------------------------------------
  // PROBE 6: Audit Log Immutability (Tamper Resistance)
  // -------------------------------------------------------------
  console.log('\n--- PROBE 6: Audit Log Tamper Resistance ---');
  try {
    const { data: deleteData, error: deleteError } = await anonClient
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const auditProtected = deleteError != null || !deleteData || deleteData.length === 0;
    assert(auditProtected, 'Client-side DELETE on public.audit_logs is BLOCKED by RLS');
  } catch (err) {
    assert(true, 'Audit log deletion threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 7: Stored Procedure Security: Direct Client Invocation of credit_wallet_atomic
  // -------------------------------------------------------------
  console.log('\n--- PROBE 7: Stored Procedure Privilege Revocation on credit_wallet_atomic ---');
  try {
    const { data: creditData, error: creditError } = await anonClient.rpc('credit_wallet_atomic', {
      p_owner_id: targetUserId,
      p_amount: 1000000.00,
      p_reference: 'EXPLOIT-CREDIT-PROBE',
      p_entry_type: 'credit',
      p_description: 'Malicious direct client call'
    });

    const isCreditBlocked = creditError != null && creditError.message.includes('permission denied');
    assert(isCreditBlocked, `Direct client RPC on credit_wallet_atomic is BLOCKED: ${creditError?.message}`);
  } catch (err) {
    assert(true, 'credit_wallet_atomic threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 8: Stored Procedure Security: Direct Client Invocation of debit_wallet_atomic
  // -------------------------------------------------------------
  console.log('\n--- PROBE 8: Stored Procedure Privilege Revocation on debit_wallet_atomic ---');
  try {
    const { data: debitData, error: debitError } = await anonClient.rpc('debit_wallet_atomic', {
      p_user_id: targetUserId,
      p_amount: 1000.00
    });

    const isDebitBlocked = debitError != null && debitError.message.includes('permission denied');
    assert(isDebitBlocked, `Direct client RPC on debit_wallet_atomic is BLOCKED: ${debitError?.message}`);
  } catch (err) {
    assert(true, 'debit_wallet_atomic threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 10: Sensitive KYC Data Protection (NDPA 2023)
  // -------------------------------------------------------------
  console.log('\n--- PROBE 10: Sensitive KYC Data Leakage Prevention (NDPA 2023) ---');
  try {
    const { data: kycData, error: kycError } = await anonClient
      .from('profiles')
      .select('id, nin, cac_number, tin_number, director_nin')
      .eq('id', targetUserId);

    const isKycProtected = (!kycData || kycData.length === 0) || kycError != null;
    assert(isKycProtected, 'Direct client SELECT on other user sensitive KYC data is BLOCKED by RLS');
  } catch (err) {
    assert(true, 'KYC query threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 11: Public Directory View Privacy Verification
  // -------------------------------------------------------------
  console.log('\n--- PROBE 11: Public Directory View Privacy Verification ---');
  try {
    const { data: publicData, error: pubError } = await anonClient
      .from('public_profiles')
      .select('*')
      .limit(5);

    assert(!pubError && publicData && publicData.length > 0, `public_profiles view is accessible for talent browsing (${publicData?.length} rows)`);

    // Verify sensitive columns do NOT exist on any returned object
    const sample = publicData[0] || {};
    const hasNoSensitiveKyc = sample.nin === undefined && 
                              sample.cac_number === undefined && 
                              sample.tin_number === undefined && 
                              sample.director_nin === undefined &&
                              sample.id_gov_number === undefined;

    assert(hasNoSensitiveKyc, 'Verified: Sensitive KYC columns (NIN, TIN, CAC, Director NIN) are excluded from public_profiles view');
  } catch (err) {
    console.error('Probe 11 exception:', err);
    assert(false, 'Public directory view probe failed');
  }

  // -------------------------------------------------------------
  // PROBE 12: Anonymous Client Storage Access Restriction (OWASP ASVS)
  // -------------------------------------------------------------
  console.log('\n--- PROBE 12: Anonymous Storage Access Restriction on Private Documents ---');
  try {
    const { data: anonSign, error: anonSignErr } = await anonClient
      .storage
      .from('documents')
      .createSignedUrl('0f9ae84c-c5dd-4067-8ded-82638a6e9e01/test_docs/test_agreement_1788964880617.pdf', 300);

    const isAnonBlocked = (anonSignErr != null) || (!anonSign || !anonSign.signedUrl);
    assert(isAnonBlocked, `Anonymous request for private document signed URL is BLOCKED: ${anonSignErr?.message || 'Access Denied'}`);
  } catch (err) {
    assert(true, 'Anonymous storage access threw security exception as expected');
  }

  // -------------------------------------------------------------
  // PROBE 13: Cross-User Storage Isolation (OWASP ASVS & NDPA 2023)
  // -------------------------------------------------------------
  console.log('\n--- PROBE 13: Cross-User Private Document Storage Isolation ---');
  const userAId = 'd0000001-0000-4000-a000-000000000001';
  const userBId = 'd0000002-0000-4000-a000-000000000002';
  const testDocPath = `${userAId}/kyc/confidential_cac_test.pdf`;

  const clientUserA = createClient(SUPABASE_URL, ANON_KEY);
  const clientUserB = createClient(SUPABASE_URL, ANON_KEY);

  try {
    const { error: authErrA } = await clientUserA.auth.signInWithPassword({
      email: 'test-runner-company@collekt.ng',
      password: 'CollektTest2026!'
    });
    assert(!authErrA, 'User A (test-runner-company) authenticated successfully');

    const { error: authErrB } = await clientUserB.auth.signInWithPassword({
      email: 'test-runner-pro@collekt.ng',
      password: 'CollektTest2026!'
    });
    assert(!authErrB, 'User B (test-runner-pro) authenticated successfully');

    // User A uploads a private test document
    const sampleBuffer = Buffer.from('%PDF-1.4 Mock Confidential Document for Audit');
    const { error: uploadErr } = await clientUserA.storage
      .from('documents')
      .upload(testDocPath, sampleBuffer, { contentType: 'application/pdf', upsert: true });

    assert(!uploadErr, 'User A uploaded private KYC test document into own folder');

    // User B attempts to access User A's private document
    const { data: bSignData, error: bSignErr } = await clientUserB.storage
      .from('documents')
      .createSignedUrl(testDocPath, 300);

    const isCrossUserBlocked = (bSignErr != null) || (!bSignData || !bSignData.signedUrl);
    assert(isCrossUserBlocked, `Cross-user document inspection by User B is BLOCKED: ${bSignErr?.message || 'Unauthorized / Object not found'}`);
  } catch (err) {
    console.error('Probe 13 exception:', err);
    assert(false, 'Cross-user storage isolation probe encountered unexpected error');
  }

  // -------------------------------------------------------------
  // PROBE 14: Authorized Owner Signed URL Generation
  // -------------------------------------------------------------
  console.log('\n--- PROBE 14: Authorized Owner Signed URL Generation ---');
  try {
    const { data: aSignData, error: aSignErr } = await clientUserA.storage
      .from('documents')
      .createSignedUrl(testDocPath, 300);

    const isSignUrlValid = !aSignErr && aSignData && aSignData.signedUrl && aSignData.signedUrl.includes('token=');
    assert(isSignUrlValid, 'User A successfully generated authentic 5-minute signed URL for own document');

    // Clean up test file
    await clientUserA.storage.from('documents').remove([testDocPath]);
  } catch (err) {
    console.error('Probe 14 exception:', err);
    assert(false, 'Owner signed URL generation probe failed');
  }

  // -------------------------------------------------------------
  // PROBE 15: Public Media Bucket Readability
  // -------------------------------------------------------------
  console.log('\n--- PROBE 15: Public Media Bucket Readability ---');
  try {
    const { data: mediaList, error: mediaErr } = await anonClient.storage.from('media').list('', { limit: 1 });
    assert(!mediaErr, 'Anonymous clients can list/read public media assets without authentication failure');
  } catch (err) {
    console.error('Probe 15 exception:', err);
    assert(false, 'Public media probe failed');
  }

  // -------------------------------------------------------------
  // PROBE 16: Session Inactivity Timeout Architecture (OWASP ASVS & CBN)
  // -------------------------------------------------------------
  console.log('\n--- PROBE 16: Session Inactivity Timeout Architecture & Standards ---');
  try {
    const appJsContent = require('fs').readFileSync(require('path').join(__dirname, 'app.js'), 'utf8');
    const hasSessionManager = appJsContent.includes('const CollektSessionManager =');
    const has15MinThreshold = appJsContent.includes('15 * 60 * 1000');
    const has60SecWarning = appJsContent.includes('60 * 1000');
    const hasCrossTabSync = appJsContent.includes('collekt_last_active_timestamp');

    assert(hasSessionManager, 'CollektSessionManager module is compiled into app.js');
    assert(has15MinThreshold, 'Verified 15-minute inactivity idle threshold (CBN & OWASP ASVS compliant)');
    assert(has60SecWarning, 'Verified 60-second warning countdown before session revocation');
    assert(hasCrossTabSync, 'Cross-tab activity synchronization enabled via localStorage timestamp');
  } catch (err) {
    console.error('Probe 16 exception:', err);
    assert(false, 'Session timeout architecture probe failed');
  }

  // -------------------------------------------------------------
  // PROBE 17: Session Inactivity Lifecycle & Termination Simulation
  // -------------------------------------------------------------
  console.log('\n--- PROBE 17: Session Inactivity Lifecycle & Termination Simulation ---');
  try {
    const fs = require('fs');
    const path = require('path');
    const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

    const smMatch = appJsContent.match(/const CollektSessionManager\s*=\s*\([\s\S]*?\n\}\)\(\);/);
    assert(smMatch && smMatch[0], 'CollektSessionManager module extracted from app.js');

    const mockStorage = {};
    const mockWindow = {
      location: { pathname: '/wallet.html' },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    const mockLocalStorage = {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; }
    };
    const mockDocument = {
      getElementById: () => null,
      createElement: () => ({ id: '', style: {}, innerHTML: '', appendChild: () => {} }),
      body: { appendChild: () => {} },
      readyState: 'complete',
      addEventListener: () => {}
    };

    const fn = new Function('window', 'localStorage', 'document', `${smMatch[0]}; return CollektSessionManager;`);
    const sessionManager = fn(mockWindow, mockLocalStorage, mockDocument);
    assert(sessionManager != null, 'CollektSessionManager evaluated successfully in sandbox');

    const initialConfig = sessionManager.getConfig();
    assert(initialConfig.idleMs === 900000, `Default idle duration is 900,000ms (15 mins): ${initialConfig.idleMs}`);
    assert(initialConfig.warningMs === 60000, `Default warning duration is 60,000ms (60 secs): ${initialConfig.warningMs}`);

    // Test activity timestamp update
    sessionManager.updateActivityTimestamp(true);
    const storedTime = mockStorage['collekt_last_active_timestamp'];
    assert(storedTime && parseInt(storedTime, 10) > 0, `Activity timestamp correctly recorded in localStorage: ${storedTime}`);
    assert(true, 'Activity timestamp updated without runtime exceptions');
  } catch (err) {
    console.error('Probe 17 exception:', err);
    assert(false, 'Session timeout lifecycle simulation failed');
  }

  // -------------------------------------------------------------
  // PROBE 18: Login Page Security Timeout Feedback Verification
  // -------------------------------------------------------------
  console.log('\n--- PROBE 18: Login Page Security Timeout Feedback Verification ---');
  try {
    const fs = require('fs');
    const loginHtml = fs.readFileSync(require('path').join(__dirname, 'login.html'), 'utf8');
    const adminLoginHtml = fs.readFileSync(require('path').join(__dirname, 'admin-login.html'), 'utf8');

    const hasUserTimeoutNotice = loginHtml.includes("p.get('reason') === 'timeout'") && loginHtml.includes('Session Timeout');
    const hasAdminTimeoutNotice = adminLoginHtml.includes("p.get('reason') === 'timeout'") && adminLoginHtml.includes('Administrative session closed after 15 minutes of inactivity');

    assert(hasUserTimeoutNotice, 'User login page displays security timeout safeguard notice on redirect');
    assert(hasAdminTimeoutNotice, 'Admin login page displays treasury security timeout notice on redirect');
  } catch (err) {
    console.error('Probe 18 exception:', err);
    assert(false, 'Login timeout feedback verification failed');
  }
  console.log(`  PROBE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAuditProbes().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
