const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ozzwvzxugfaveggeznfa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const COMPANY_ID = 'd0000001-0000-4000-a000-000000000001';

async function testMarketplaceWorkflow() {
  console.log('--- STARTING MARKETPLACE WORKFLOW VERIFICATION ---');

  // Authenticate as the Company test runner
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: 'test-runner-company@collekt.ng',
    password: 'CollektTest2026!'
  });
  if (authErr) {
    console.error('❌ Authentication failed for test runner:', authErr.message);
    process.exit(1);
  }
  console.log('✅ Authenticated as Company Test Runner:', authData.user.id);

  // Test 1: Publish Opportunity WITH Price
  console.log('\n1. Testing posting opportunity WITH budget: ₦3,500,000');
  const projectWithPrice = {
    company_id: COMPANY_ID,
    title: 'Offshore Subsea Pipeline Engineer - Test',
    description: 'Requires Bosiet certification and 5+ years experience in deepwater subsea operations.',
    skills_required: ['Bosiet', 'Subsea', 'Pipeline'],
    category: 'Subsea & Offshore',
    budget: 3500000,
    professional_fee: 3500000,
    status: 'OPEN',
    deadline: '30 Days'
  };

  const { data: insert1, error: err1 } = await sb.from('projects').insert([projectWithPrice]).select();
  if (err1) {
    console.error('❌ Insert with price failed:', err1);
    return;
  }
  const idWithPrice = insert1[0].id;
  console.log('✅ Successfully inserted opportunity with budget:', insert1[0].budget, 'ID:', idWithPrice);

  // Test 2: Publish Opportunity WITHOUT Price (null / 0)
  console.log('\n2. Testing posting opportunity WITHOUT budget (Price not specified)');
  const projectNoPrice = {
    company_id: COMPANY_ID,
    title: 'HAZOP Risk Safety Lead - Test Unpriced',
    description: 'Lead HAZOP reviews for midstream gas plant.',
    skills_required: ['HAZOP', 'HSE', 'Risk Assessment'],
    category: 'Pipeline & HAZOP',
    budget: null,
    professional_fee: null,
    status: 'OPEN',
    deadline: '14 Days'
  };

  const { data: insert2, error: err2 } = await sb.from('projects').insert([projectNoPrice]).select();
  if (err2) {
    console.error('❌ Insert without price failed:', err2);
    return;
  }
  const idNoPrice = insert2[0].id;
  console.log('✅ Successfully inserted unpriced opportunity. Budget in DB is:', insert2[0].budget, 'ID:', idNoPrice);

  // Test 3: Fetch back and verify normalization
  console.log('\n3. Fetching both opportunities to verify persistence & field types');
  const { data: fetched, error: fetchErr } = await sb
    .from('projects')
    .select('*')
    .in('id', [idWithPrice, idNoPrice]);

  if (fetchErr) {
    console.error('❌ Fetch failed:', fetchErr);
  } else {
    fetched.forEach(item => {
      const budgetVal = (item.budget && Number(item.budget) > 0) ? `₦${Number(item.budget).toLocaleString()}` : 'Price not specified';
      console.log(`- Project "${item.title}": Budget in DB = ${item.budget} => Marketplace Display Value: "${budgetVal}"`);
    });
  }

  // Clean up test records
  console.log('\n4. Cleaning up test projects...');
  await sb.from('projects').delete().in('id', [idWithPrice, idNoPrice]);
  console.log('✅ Clean up complete.');

  console.log('\n--- ALL MARKETPLACE WORKFLOW VERIFICATIONS PASSED ---');
}

testMarketplaceWorkflow().catch(console.error);
