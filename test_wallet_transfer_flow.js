const { supabase } = require('./netlify/functions/lib/supabase-client');

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

  const companyId = '0f9ae84c-c5dd-4067-8ded-82638a6e9e01'; // Collekt Technologies Ltd
  const proId = '814f4be6-cc86-47d3-b746-cd257f456548';     // Dave "Kori" Ojeowere
  const testJobId = '75d9c7bb-ec07-422f-adbe-cb90f3054f15';
  const testPropId = '85b0472f-7529-4284-81f9-7d5aef109999';

  try {
    // -------------------------------------------------------------
    // TEST 1: Ensure sender and recipient have wallets initialized
    // -------------------------------------------------------------
    console.log('--- TEST 1: Wallet Initialization & Canonical Checks ---');
    await supabase.from('wallets').upsert([
      { user_id: companyId, balance: 0.00, available_balance: 0.00 },
      { user_id: proId, balance: 0.00, available_balance: 0.00 }
    ], { onConflict: 'user_id' });

    const { data: w1 } = await supabase.from('wallets').select('*').eq('user_id', companyId).single();
    const { data: w2 } = await supabase.from('wallets').select('*').eq('user_id', proId).single();

    assert(w1 && w1.user_id === companyId, 'Company wallet exists in database');
    assert(w2 && w2.user_id === proId, 'Professional wallet exists in database');

    // -------------------------------------------------------------
    // TEST 2: Conversation Creation & Deduplication
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Conversation Resolution & Deduplication ---');
    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_a.eq.${companyId},participant_b.eq.${proId}),and(participant_a.eq.${proId},participant_b.eq.${companyId})`);

    let convId = existingConvs && existingConvs.length > 0 ? existingConvs[0].id : null;
    if (!convId) {
      const { data: newConv, error: cErr } = await supabase
        .from('conversations')
        .insert({
          participant_a: companyId,
          participant_b: proId,
          last_message_preview: 'Init Test',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      convId = newConv.id;
    }
    assert(convId != null, `Active conversation thread resolved: ${convId}`);

    // -------------------------------------------------------------
    // TEST 3: Marketplace Collection Request System Message
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Marketplace "Collect" Automated System Message ---');
    const collectMsgBody = `⚡ Dave "Kori" Ojeowere submitted a collection request for "Lekki Deep Sea Port Facility Maintenance". (Status: Pending Review)`;

    const { data: collectMsg, error: colErr } = await supabase
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
    assert(collectMsg.metadata?.is_system === true, 'Message is flagged as is_system: true');
    assert(collectMsg.metadata?.event_type === 'COLLECTION_REQUEST_SUBMITTED', 'Message event_type is COLLECTION_REQUEST_SUBMITTED');

    // -------------------------------------------------------------
    // TEST 4: Marketplace Acceptance Automated System Message
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Marketplace "Accept" Automated System Message ---');
    const acceptMsgBody = `🎉 Collection request for "Lekki Deep Sea Port Facility Maintenance" has been ACCEPTED by Collekt Technologies Ltd! Active project engagement has commenced.`;

    const { data: acceptMsg, error: accErr } = await supabase
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
    assert(acceptMsg.metadata?.event_type === 'COLLECTION_REQUEST_ACCEPTED', 'Message event_type is COLLECTION_REQUEST_ACCEPTED');

    // -------------------------------------------------------------
    // TEST 5: Insufficient Balance Prevention via execute_wallet_transfer RPC
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Insufficient Balance Prevention via execute_wallet_transfer RPC ---');
    // Set both balance and available_balance to 0.00
    await supabase.from('wallets').update({ balance: 0.00, available_balance: 0.00 }).eq('user_id', companyId);

    const failRef = `TX-FAIL-${Date.now()}`;
    const { data: failResult, error: failRpcErr } = await supabase.rpc('execute_wallet_transfer', {
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
    const { data: wCheck1 } = await supabase.from('wallets').select('balance, available_balance').eq('user_id', companyId).single();
    assert(Number(wCheck1.balance) === 0 && Number(wCheck1.available_balance) === 0, 'Company wallet balance remained 0.00 (no negative balances allowed)');

    // -------------------------------------------------------------
    // TEST 6: Real Funded Wallet Transfer & Double-Entry Ledger Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Atomic Wallet Transfer & Dual Ledger Audit ---');
    // Set clean initial test balances
    const initialCompanyBal = 200000.00;
    const initialProBal = 10000.00;
    const transferAmount = 75000.00;

    await supabase.from('wallets').update({ balance: initialCompanyBal, available_balance: initialCompanyBal }).eq('user_id', companyId);
    await supabase.from('wallets').update({ balance: initialProBal, available_balance: initialProBal }).eq('user_id', proId);

    const txRef = `TX-TEST-OK-${Date.now()}`;
    const { data: transferResult, error: txRpcErr } = await supabase.rpc('execute_wallet_transfer', {
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

    // Verify actual wallet table rows in database
    const { data: finalWCompany } = await supabase.from('wallets').select('balance, available_balance').eq('user_id', companyId).single();
    const { data: finalWPro } = await supabase.from('wallets').select('balance, available_balance').eq('user_id', proId).single();

    assert(Number(finalWCompany.balance) === 125000.00, 'Database company wallet has exact ₦125,000.00');
    assert(Number(finalWPro.balance) === 85000.00, 'Database pro wallet has exact ₦85,000.00');

    // Verify double-entry ledger in public.wallet_ledger
    const { data: ledgerEntries } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('reference', txRef);

    assert(ledgerEntries && ledgerEntries.length === 2, `Double-entry ledger recorded exactly 2 balanced rows (found ${ledgerEntries?.length})`);
    const debitEntry = ledgerEntries?.find(e => e.entry_type.toLowerCase() === 'debit');
    const creditEntry = ledgerEntries?.find(e => e.entry_type.toLowerCase() === 'credit');
    assert(debitEntry && Number(debitEntry.amount) === transferAmount && debitEntry.owner_id === companyId, 'Debit ledger entry matches company & transfer amount');
    assert(creditEntry && Number(creditEntry.amount) === transferAmount && creditEntry.owner_id === proId, 'Credit ledger entry matches pro & transfer amount');

    // -------------------------------------------------------------
    // TEST 7: Idempotency Key Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Idempotency (Duplicate Prevention) ---');
    const { data: dupResult } = await supabase.rpc('execute_wallet_transfer', {
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
    const { data: recheckWCompany } = await supabase.from('wallets').select('balance').eq('user_id', companyId).single();
    assert(Number(recheckWCompany.balance) === 125000.00, 'Company wallet was NOT debited twice (Idempotency protected)');

    // -------------------------------------------------------------
    // TEST 8: Verified Receipt Message Creation
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Verified Receipt Card Message in Chat ---');
    const receiptMsgText = `[WALLET_TRANSFER_RECEIPT]\nAmount: ₦${transferAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nNote: Milestone 1 Survey Payment\nRef: ${txRef}`;

    const { data: receiptMsg, error: rErr } = await supabase
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
    assert(receiptMsg.body.includes('[WALLET_TRANSFER_RECEIPT]'), 'Message contains receipt trigger token');
    assert(receiptMsg.metadata?.event_type === 'WALLET_TRANSFER_RECEIPT', 'Metadata event_type is WALLET_TRANSFER_RECEIPT');

  } catch (err) {
    console.error('Test execution exception:', err);
    failed++;
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
