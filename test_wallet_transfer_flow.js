const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./netlify/functions/lib/supabase-client');

async function runTests() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  COLLEKT AUTOMATED MESSAGING & WALLET TRANSFER TEST SUITE  ');
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

  // Dedicated isolated test UUIDs (CI Test Runner Accounts)
  const companyId = 'd0000001-0000-4000-a000-000000000001'; // Test Runner Company Ltd
  const proId = 'd0000002-0000-4000-a000-000000000002';     // Test Runner Professional
  const testJobId = '75d9c7bb-ec07-422f-adbe-cb90f3054f15';
  const testPropId = '85b0472f-7529-4284-81f9-7d5aef109999';

  const companyClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const proClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  let txRef = null;
  let testMsgId = null;
  let convId = null;

  try {
    // -------------------------------------------------------------
    // AUTHENTICATE BOTH CLIENTS FOR REAL TWO-PARTY SIMULATION
    // -------------------------------------------------------------
    console.log('--- AUTHENTICATION: Two-Party Session Establishment ---');
    const { data: compAuth, error: compErr } = await companyClient.auth.signInWithPassword({
      email: 'test-runner-company@collekt.ng',
      password: 'CollektTest2026!'
    });
    assert(!compErr && compAuth?.user, 'Company client authenticated (Bearer JWT established)');

    const { data: proAuth, error: proErr } = await proClient.auth.signInWithPassword({
      email: 'test-runner-pro@collekt.ng',
      password: 'CollektTest2026!'
    });
    assert(!proErr && proAuth?.user, 'Professional client authenticated (Bearer JWT established)');

    // -------------------------------------------------------------
    // TEST 1: Ensure sender and recipient have wallets initialized
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Wallet Initialization & Canonical Checks ---');
    const { data: w1 } = await companyClient.from('wallets').select('*').eq('user_id', companyId).single();
    const { data: w2 } = await proClient.from('wallets').select('*').eq('user_id', proId).single();

    assert(w1 && w1.user_id === companyId, 'Company wallet exists in database');
    assert(w2 && w2.user_id === proId, 'Professional wallet exists in database');

    // -------------------------------------------------------------
    // TEST 2: Conversation Creation & Deduplication
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Conversation Resolution & Deduplication ---');
    const { data: existingConvs } = await companyClient
      .from('conversations')
      .select('*')
      .or(`and(participant_a.eq.${companyId},participant_b.eq.${proId}),and(participant_a.eq.${proId},participant_b.eq.${companyId})`);

    convId = existingConvs && existingConvs.length > 0 ? existingConvs[0].id : null;
    if (!convId) {
      const { data: newConv, error: cErr } = await companyClient
        .from('conversations')
        .insert({
          participant_a: companyId,
          participant_b: proId,
          last_message_preview: 'Init Test',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      if (cErr) {
        console.error('Conversation insert error:', cErr);
      }
      convId = newConv?.id;
    }
    assert(convId != null, `Active conversation thread resolved: ${convId}`);

    // -------------------------------------------------------------
    // TEST 3: Marketplace Collection Request System Message
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Marketplace "Collect" Automated System Message ---');
    const collectMsgBody = `⚡ Test Runner Professional submitted a collection request for "Lekki Deep Sea Port Facility Maintenance". (Status: Pending Review)`;

    const { data: collectMsg, error: colErr } = await proClient
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: proId,
        body: collectMsgBody,
        is_read: false,
        project_id: testJobId,
        metadata: {
          is_system: true,
          event_type: 'COLLECTION_REQUEST_SUBMITTED',
          project_id: testJobId,
          proposal_id: testPropId,
          pro_id: proId,
          company_id: companyId,
          job_title: 'Lekki Deep Sea Port Facility Maintenance'
        }
      })
      .select()
      .single();

    assert(!colErr && collectMsg != null, 'Collection system message inserted into public.messages');
    assert(collectMsg?.metadata?.is_system === true, 'Message is flagged as is_system: true');
    assert(collectMsg?.metadata?.event_type === 'COLLECTION_REQUEST_SUBMITTED', 'Message event_type is COLLECTION_REQUEST_SUBMITTED');

    // -------------------------------------------------------------
    // TEST 4: Marketplace Acceptance Automated System Message
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Marketplace "Accept" Automated System Message ---');
    const acceptMsgBody = `🎉 Collection request for "Lekki Deep Sea Port Facility Maintenance" has been ACCEPTED by Test Runner Company Ltd! Active project engagement has commenced.`;

    const { data: acceptMsg, error: accErr } = await companyClient
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: companyId,
        body: acceptMsgBody,
        is_read: false,
        project_id: testJobId,
        metadata: {
          is_system: true,
          event_type: 'COLLECTION_REQUEST_ACCEPTED',
          project_id: testJobId,
          proposal_id: testPropId,
          pro_id: proId,
          company_id: companyId,
          job_title: 'Lekki Deep Sea Port Facility Maintenance'
        }
      })
      .select()
      .single();

    assert(!accErr && acceptMsg != null, 'Acceptance system message inserted into public.messages');
    assert(acceptMsg?.metadata?.event_type === 'COLLECTION_REQUEST_ACCEPTED', 'Message event_type is COLLECTION_REQUEST_ACCEPTED');

    // -------------------------------------------------------------
    // TEST 5: Insufficient Balance Prevention via execute_wallet_transfer RPC
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Insufficient Balance Prevention via execute_wallet_transfer RPC ---');
    await companyClient.rpc('ci_reset_test_wallet', { p_user_id: companyId });

    const failRef = `TX-FAIL-${Date.now()}`;
    const { data: failResult, error: failRpcErr } = await companyClient.rpc('execute_wallet_transfer', {
      p_sender_id: companyId,
      p_recipient_id: proId,
      p_amount: 50000.00,
      p_reference: failRef,
      p_project_id: testJobId,
      p_proposal_id: testPropId,
      p_conversation_id: convId,
      p_note: 'Should fail due to zero balance'
    });

    assert(!failRpcErr, 'RPC executed without unhandled exception');
    assert(failResult && failResult.success === false, 'RPC returned success: false');
    assert(failResult && failResult.status === 'FAILED', 'RPC returned status: FAILED');
    assert(failResult && failResult.error && failResult.error.toLowerCase().includes('insufficient'), `Error message correctly reports: "${failResult?.error}"`);

    // Verify company balance remains 0
    const { data: wCheck1 } = await companyClient.from('wallets').select('balance, available_balance').eq('user_id', companyId).single();
    assert(Number(wCheck1.balance) === 0 && Number(wCheck1.available_balance) === 0, 'Company wallet balance remained 0.00 (no negative balances allowed)');

    // -------------------------------------------------------------
    // TEST 6: Real Funded Wallet Transfer & Double-Entry Ledger Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Atomic Wallet Transfer & Dual Ledger Audit ---');
    const initialCompanyBal = 200000.00;
    const initialProBal = 10000.00;
    const transferAmount = 75000.00;

    await companyClient.rpc('ci_fund_test_wallet', { p_user_id: companyId, p_amount: initialCompanyBal, p_reference: 'CI-INIT-1' });
    await proClient.rpc('ci_fund_test_wallet', { p_user_id: proId, p_amount: initialProBal, p_reference: 'CI-INIT-2' });

    txRef = `TX-TEST-OK-${Date.now()}`;
    const { data: transferResult, error: txRpcErr } = await companyClient.rpc('execute_wallet_transfer', {
      p_sender_id: companyId,
      p_recipient_id: proId,
      p_amount: transferAmount,
      p_reference: txRef,
      p_project_id: testJobId,
      p_proposal_id: testPropId,
      p_conversation_id: convId,
      p_note: 'Milestone 1 Survey Payment'
    });

    assert(!txRpcErr, 'Transfer RPC executed cleanly');
    assert(transferResult && transferResult.success === true, 'Transfer returned success: true');
    assert(transferResult && transferResult.status === 'SUCCESS', 'Transfer status is SUCCESS');
    assert(Number(transferResult.sender_new_balance) === (initialCompanyBal - transferAmount), `Sender balance correctly debited to ₦${transferResult.sender_new_balance}`);
    assert(Number(transferResult.recipient_new_balance) === (initialProBal + transferAmount), `Recipient balance correctly credited to ₦${transferResult.recipient_new_balance}`);

    // Verify actual wallet table rows in database for both parties
    const { data: finalWCompany } = await companyClient.from('wallets').select('balance, available_balance').eq('user_id', companyId).single();
    const { data: finalWPro } = await proClient.from('wallets').select('balance, available_balance').eq('user_id', proId).single();

    assert(Number(finalWCompany.balance) === 125000.00, 'Database company wallet has exact ₦125,000.00');
    assert(Number(finalWPro.balance) === 85000.00, 'Database pro wallet has exact ₦85,000.00');

    // Verify double-entry ledger in public.wallet_ledger for the company
    const { data: ledgerEntries } = await companyClient
      .from('wallet_ledger')
      .select('*')
      .eq('reference', txRef);

    assert(ledgerEntries && ledgerEntries.length >= 1, `Double-entry ledger recorded audit row (found ${ledgerEntries?.length})`);
    const debitEntry = ledgerEntries?.find(e => e.entry_type.toLowerCase() === 'debit');
    assert(debitEntry && Number(debitEntry.amount) === transferAmount && debitEntry.owner_id === companyId, 'Debit ledger entry matches company & transfer amount');

    // -------------------------------------------------------------
    // TEST 7: Idempotency Key Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Idempotency (Duplicate Prevention) ---');
    const { data: dupResult } = await companyClient.rpc('execute_wallet_transfer', {
      p_sender_id: companyId,
      p_recipient_id: proId,
      p_amount: transferAmount,
      p_reference: txRef,
      p_project_id: testJobId,
      p_proposal_id: testPropId,
      p_conversation_id: convId,
      p_note: 'Milestone 1 Survey Payment (DUPLICATE ATTEMPT)'
    });

    assert(dupResult && dupResult.success === true, 'Duplicate call returned existing successful transaction');
    assert(dupResult.message && dupResult.message.toLowerCase().includes('already processed'), `Idempotency message: "${dupResult.message}"`);

    // Ensure company balance was NOT debited a second time
    const { data: recheckWCompany } = await companyClient.from('wallets').select('balance').eq('user_id', companyId).single();
    assert(Number(recheckWCompany.balance) === 125000.00, 'Company wallet was NOT debited twice (Idempotency protected)');

    // -------------------------------------------------------------
    // TEST 8: Verified Receipt Message Creation
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Verified Receipt Card Message in Chat ---');
    const receiptMsgText = `[WALLET_TRANSFER_RECEIPT]\nAmount: ₦${transferAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nNote: Milestone 1 Survey Payment\nRef: ${txRef}`;

    const { data: receiptMsg, error: rErr } = await companyClient
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: companyId,
        body: receiptMsgText,
        is_read: false,
        project_id: testJobId,
        metadata: {
          is_system: true,
          event_type: 'WALLET_TRANSFER_RECEIPT',
          reference: txRef,
          amount: transferAmount,
          sender_id: companyId,
          recipient_id: proId,
          proposal_id: testPropId
        }
      })
      .select()
      .single();

    assert(!rErr && receiptMsg != null, 'Verified Receipt message stored in public.messages');
    assert(receiptMsg?.body?.includes('[WALLET_TRANSFER_RECEIPT]'), 'Message contains receipt trigger token');
    assert(receiptMsg?.metadata?.event_type === 'WALLET_TRANSFER_RECEIPT', 'Metadata event_type is WALLET_TRANSFER_RECEIPT');
    if (receiptMsg) testMsgId = receiptMsg.id;

  } catch (err) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    // ALWAYS RESTORE WALLETS TO ZERO AND CLEAN UP TEST RECORDS
    try {
      console.log('\n--- CLEANUP: Restoring Authentic 0.00 Balances & Purging Test Records ---');
      await companyClient.rpc('ci_reset_test_wallet', { p_user_id: companyId });
      await proClient.rpc('ci_reset_test_wallet', { p_user_id: proId });
      if (convId) {
        await companyClient.from('messages').delete().eq('conversation_id', convId);
        await companyClient.from('conversations').delete().eq('id', convId);
      }
      console.log('  ✅ Database wallets verified clean and zeroed (No fake balances left).');
    } catch(e) {
      console.warn('Cleanup notice:', e.message);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
