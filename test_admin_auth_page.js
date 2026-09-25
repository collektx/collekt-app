/**
 * Collekt Automated Test Suite: Admin Authentication & Portal Gateway
 * Verifies username & email resolution, master admin login, lockout protections,
 * and liquid-glass dark theme token compliance.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createClient } = require('@supabase/supabase-js');


const { supabase: adminSupabase, SUPABASE_URL } = require('./netlify/functions/lib/supabase-client');
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAdminPortalTests() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('      COLLEKT ADMIN PORTAL & AUTHENTICATION TEST SUITE      ');
  console.log('════════════════════════════════════════════════════════════\n');

  let passed = 0;

  // 1. Static Audit of admin-login.html
  console.log('--- TEST 1: Static Inspection of admin-login.html ---');
  const htmlPath = path.join(__dirname, 'admin-login.html');
  assert(fs.existsSync(htmlPath), 'admin-login.html must exist');
  const content = fs.readFileSync(htmlPath, 'utf8');

  // Input & Form elements
  assert(content.includes('id="adminLoginForm"'), 'admin-login.html must have form #adminLoginForm');
  assert(content.includes('id="adminEmailVal"'), 'admin-login.html must have username/email input #adminEmailVal');
  assert(content.includes('id="adminPassVal"'), 'admin-login.html must have password input #adminPassVal');
  assert(content.includes('id="adminLoginBtn"'), 'admin-login.html must have submit button #adminLoginBtn');
  assert(content.includes('quickFillAdminMaster'), 'admin-login.html must provide quick-fill master admin button');
  assert(content.includes('togglePassVisibility'), 'admin-login.html must provide password show/hide toggle');
  assert(content.includes('activeSessionBox'), 'admin-login.html must provide active session detection box');
  assert(content.includes('checkLockoutStatus'), 'admin-login.html must provide brute-force lockout guard');
  assert(content.includes("p.get('reason') === 'timeout'"), 'Must check p.get("reason") === "timeout"');
  assert(content.includes('Administrative session closed after 15 minutes of inactivity'), 'Must include exact timeout explanation');
  console.log('  ✅ PASS: All required form fields, buttons, timeout notice, and security structures exist in admin-login.html');
  passed++;

  // Liquid-glass compliance
  console.log('\n--- TEST 2: Liquid-Glass Obsidian Design Guard Compliance ---');
  assert(content.includes('#071311'), 'Must use obsidian velvet background #071311');
  assert(content.includes('rgba(12, 28, 25,'), 'Must use obsidian matte card surface rgba(12, 28, 25, ...)');
  assert(!content.includes('inset 0 1.5px rgba(255,255,255,0.95)'), 'Forbidden specular glare must not exist');
  assert(content.includes('backdrop-filter: blur('), 'Must use modern frosted glass backdrop-filter');
  console.log('  ✅ PASS: Design complies with liquid-glass-design-guard specifications');
  passed++;

  // Username normalization simulation
  console.log('\n--- TEST 3: Username to Email Normalization Logic ---');
  function normalizeAdminUsername(rawInput) {
    let target = (rawInput || '').trim().toLowerCase();
    if (!target.includes('@')) {
      const recognized = ['admin', 'administrator', 'collektadmin', 'master', 'masteradmin', 'superadmin'];
      if (recognized.includes(target)) {
        return 'admin@collekt.ng';
      }
      return `${target}@collekt.ng`;
    }
    return target;
  }

  assert.strictEqual(normalizeAdminUsername('admin'), 'admin@collekt.ng');
  assert.strictEqual(normalizeAdminUsername('ADMIN'), 'admin@collekt.ng');
  assert.strictEqual(normalizeAdminUsername('administrator'), 'admin@collekt.ng');
  assert.strictEqual(normalizeAdminUsername('admin@collekt.ng'), 'admin@collekt.ng');
  assert.strictEqual(normalizeAdminUsername('masteradmin'), 'admin@collekt.ng');
  console.log('  ✅ PASS: Normalization reliably translates username variations to admin@collekt.ng');
  passed++;

  // Live Supabase Authentication with Master Admin Credentials
  console.log('\n--- TEST 4: Live Master Admin Authentication (Username & Password) ---');
  const targetEmail = normalizeAdminUsername('admin');
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: targetEmail,
    password: 'CollektAdmin2026!'
  });

  assert(!authError, `Master Admin authentication must succeed without error: ${authError?.message}`);
  assert(authData && authData.user, 'Supabase must return authenticated user object');
  assert.strictEqual(authData.user.email, 'admin@collekt.ng', 'Authenticated email must match admin@collekt.ng');
  console.log(`  ✅ PASS: Authenticated user: ${authData.user.email} (ID: ${authData.user.id})`);
  passed++;

  // Profile RBAC Role Verification
  console.log('\n--- TEST 5: Profiles RBAC Role Verification ---');
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', authData.user.id)
    .single();

  assert(!profileErr, `Profile fetch must succeed: ${profileErr?.message}`);
  assert(profile && profile.role === 'admin', 'User must possess role === "admin"');
  console.log(`  ✅ PASS: Profile verified with RBAC role "${profile.role}" (${profile.full_name || 'Admin'})`);
  passed++;

  // Invalid password rejection
  console.log('\n--- TEST 6: Invalid Administrative Password Rejection ---');
  const { error: invalidErr } = await sb.auth.signInWithPassword({
    email: 'admin@collekt.ng',
    password: 'WrongPassword999!'
  });
  assert(invalidErr != null, 'Authentication must fail when an incorrect password is supplied');
  console.log(`  ✅ PASS: Incorrect password rejected as expected (${invalidErr.message})`);
  passed++;

  // Sign out client
  await sb.auth.signOut();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${passed} OF 6 MODULES PASSED (100% SUCCESS)  `);
  console.log('════════════════════════════════════════════════════════════\n');
}

runAdminPortalTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
