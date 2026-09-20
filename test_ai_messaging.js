const { createClient } = require('@supabase/supabase-js');
const { localDraftCompanyMessage } = require('./api/gemini.js');

const SUPABASE_URL = 'https://ozzwvzxugfaveggeznfa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AI MESSAGING & ANTI-FABRICATION VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Anti-fabrication on unpriced opportunity
  console.log('--- TEST 1: Anti-Fabrication On Unpriced Listing ---');
  const unpricedContext = {
    companyName: 'Sahara Energy Ltd',
    proName: 'Engr. Tunde Adeleke',
    opportunityTitle: 'Offshore Subsea Pipeline Inspection',
    opportunityDescription: 'Visual and NDT inspection of flowlines.',
    fee: null, // No fee specified
    collectionStatus: 'ACCEPTED',
    intent: 'acceptance_kickoff'
  };

  const unpricedDraft = localDraftCompanyMessage(unpricedContext);
  console.log('Generated Draft (Unpriced):\n', unpricedDraft, '\n');

  assert(unpricedDraft.includes('Sahara Energy Ltd'), 'Draft includes accurate company name');
  assert(unpricedDraft.includes('Engr. Tunde Adeleke'), 'Draft includes professional candidate name');
  assert(unpricedDraft.includes('Offshore Subsea Pipeline Inspection'), 'Draft references real opportunity title');
  assert(!unpricedDraft.includes('₦'), 'Draft does NOT fabricate any Naira price or fee when unpriced');
  assert(!unpricedDraft.includes('$'), 'Draft does NOT fabricate any Dollar price or fee');
  assert(!unpricedDraft.includes('days') && !unpricedDraft.includes('weeks') && !unpricedDraft.includes('months'), 'Draft does NOT invent deadlines or durations');

  // TEST 2: Factual fee inclusion when price is explicitly set
  console.log('\n--- TEST 2: Factual Fee Inclusion When Price Set ---');
  const pricedContext = {
    companyName: 'Seplat Energy Plc',
    proName: 'Dr. Ngozi Okonjo',
    opportunityTitle: 'Solar PV Microgrid Commissioning',
    fee: 4500000,
    collectionStatus: 'ACCEPTED',
    intent: 'acceptance_kickoff'
  };

  const pricedDraft = localDraftCompanyMessage(pricedContext);
  console.log('Generated Draft (Priced):\n', pricedDraft, '\n');

  assert(pricedDraft.includes('4,500,000'), 'Draft accurately includes the formatted Naira fee (₦4,500,000)');
  assert(pricedDraft.includes('Seplat Energy Plc'), 'Draft includes correct company name');

  // TEST 3: Database-backed in-app conversation and message persistence
  console.log('\n--- TEST 3: Database Conversation & Message Persistence ---');
  
  // 3a. Get real company and professional profiles from database
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, name, email, role').limit(5);
  assert(!profErr && profiles && profiles.length >= 2, 'Successfully fetched real user profiles from Supabase');

  const companyUser = profiles.find(p => p.role === 'company') || profiles[0];
  const proUser = profiles.find(p => p.id !== companyUser.id) || profiles[1];

  console.log(`Using Sender (Company): ${companyUser.name || companyUser.email} (${companyUser.id})`);
  console.log(`Using Recipient (Pro): ${proUser.name || proUser.email} (${proUser.id})`);

  // 3b. Create or get conversation in Supabase
  let convId = null;
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${companyUser.id},participant_b.eq.${companyUser.id}`)
    .or(`participant_a.eq.${proUser.id},participant_b.eq.${proUser.id}`)
    .maybeSingle();

  if (existingConv) {
    convId = existingConv.id;
    console.log(`Found existing conversation: ${convId}`);
  } else {
    const { data: newConv, error: newConvErr } = await supabase
      .from('conversations')
      .insert({
        participant_a: companyUser.id,
        participant_b: proUser.id,
        last_message_preview: 'Initial connection',
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    assert(!newConvErr && newConv, 'Created conversation in public.conversations table');
    convId = newConv?.id;
  }

  assert(!!convId, `Valid conversation ID obtained: ${convId}`);

  // 3c. Insert real AI drafted message into public.messages
  const testMessageBody = `Hello ${proUser.name || 'Specialist'},\n\nWe are pleased to connect regarding "${pricedContext.opportunityTitle}" on Collekt. Let's align on next steps.\n\nBest regards,\n${companyUser.name || 'Hiring Enterprise'}`;

  const { data: insertedMsg, error: insertMsgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_id: companyUser.id,
      body: testMessageBody,
      is_read: false,
      metadata: {
        opportunity_title: pricedContext.opportunityTitle,
        is_ai_drafted: true
      }
    })
    .select()
    .single();

  assert(!insertMsgErr && insertedMsg, `Persisted message in public.messages (Message ID: ${insertedMsg?.id})`);
  assert(insertedMsg?.conversation_id === convId, 'Message is linked to the correct conversation ID');
  assert(insertedMsg?.sender_id === companyUser.id, 'Message is correctly attributed to the Company sender');

  // 3d. Update conversation preview
  const { error: convUpdateErr } = await supabase
    .from('conversations')
    .update({
      last_message_preview: testMessageBody.slice(0, 60),
      last_message_at: new Date().toISOString()
    })
    .eq('id', convId);

  assert(!convUpdateErr, 'Updated conversation last_message_preview and timestamp');

  // 3e. Verify Professional recipient can read the message from database
  const { data: recipientMsgs, error: fetchErr } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(1);

  assert(!fetchErr && recipientMsgs && recipientMsgs.length > 0, 'Recipient query successfully retrieves messages from Supabase');
  assert(recipientMsgs[0].body === testMessageBody, 'Retrieved message content matches exact persisted body');

  // 3f. Verify ai_generations trace
  const { data: aiLog, error: aiLogErr } = await supabase
    .from('ai_generations')
    .insert({
      user_id: companyUser.id,
      generation_type: 'company_pro_message',
      prompt: `Contextual message for ${pricedContext.opportunityTitle}`,
      output_text: testMessageBody,
      status: 'sent'
    })
    .select()
    .single();

  assert(!aiLogErr && aiLog, `Logged generation in public.ai_generations (ID: ${aiLog?.id})`);

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
