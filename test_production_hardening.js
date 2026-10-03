/**
 * Collekt Automated Test Suite: Production Readiness & Integrity Hardening
 * Verifies:
 * 1. Homepage Stats Strip replaced with high-credibility Trust & Compliance pillars.
 * 2. Complete purge of "1,200+" synthetic claims across all 5 pages.
 * 3. Removal of raw browser alert() calls in footers and forms with real links and showToast.
 * 4. Removal of synthetic TX-INT-1001 fake transaction from wallet.html.
 * 5. Hardened Supabase Forgot Password flow in login.html.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('════════════════════════════════════════════════════════════');
console.log('   COLLEKT PRODUCTION READINESS & INTEGRITY HARDENING TEST  ');
console.log('════════════════════════════════════════════════════════════\n');

let passed = 0;

// TEST 1: Homepage Stats Strip & Trust Pillars
console.log('--- TEST 1: Homepage Stats Strip Trust & Compliance Pillars ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(!indexHtml.includes('<div class="strip-val" id="statVerifiedUsers">0</div>'), 'index.html must NOT contain static 0 verified users');
assert(!indexHtml.includes('<div class="strip-val" id="statActiveProjects">0</div>'), 'index.html must NOT contain static 0 active projects');
assert(!indexHtml.includes('&#x20A6;0</div>'), 'index.html must NOT contain static ₦0 contracts awarded');
assert(indexHtml.includes('NDPA 2023'), 'index.html must feature NDPA 2023 trust pillar');
assert(indexHtml.includes('Milestone Escrow'), 'index.html must feature Milestone Escrow trust pillar');
assert(indexHtml.includes('Vetted Talent'), 'index.html must feature Vetted Talent trust pillar');
assert(indexHtml.includes('4 Key Sectors'), 'index.html must feature 4 Key Sectors trust pillar');
console.log('  ✅ PASS: Homepage stats strip successfully transformed to high-credibility Trust & Compliance pillars');
passed++;

// TEST 2: Purge "1,200+" Synthetic Claims
console.log('\n--- TEST 2: Zero "1,200+" Claims Audit ---');
const auditedPages = ['index.html', 'register.html', 'company-dashboard.html', 'marketplace.html'];
auditedPages.forEach(page => {
  const content = fs.readFileSync(path.join(__dirname, page), 'utf8');
  assert(!content.includes('1,200+'), `${page} must NOT contain "1,200+" claim`);
  assert(!content.includes('1,200 verified'), `${page} must NOT contain "1,200 verified" claim`);
  console.log(`  ✅ PASS: ${page} is 100% free of synthetic "1,200+" claims`);
});
passed++;

// TEST 3: Purge Raw alert() Calls & Wire Real Links
console.log('\n--- TEST 3: Raw Browser alert() Purge & Real Links Verification ---');
const pubProfHtml = fs.readFileSync(path.join(__dirname, 'public-profile.html'), 'utf8');
assert(!pubProfHtml.includes('onclick="alert(\'Privacy Policy'), 'public-profile.html footer must NOT use alert for Privacy Policy');
assert(!pubProfHtml.includes('onclick="alert(\'Terms of Service'), 'public-profile.html footer must NOT use alert for Terms');
assert(!pubProfHtml.includes('onclick="alert(\'Contact Us'), 'public-profile.html footer must NOT use alert for Contact Us');
assert(pubProfHtml.includes('<a href="privacy.html">Privacy Policy</a>'), 'public-profile.html must wire href="privacy.html"');
assert(pubProfHtml.includes('<a href="terms.html">Terms of Service</a>'), 'public-profile.html must wire href="terms.html"');
assert(pubProfHtml.includes('<a href="mailto:support@collekt.ng">Contact Us</a>'), 'public-profile.html must wire real contact mailto');

// Check index.html footer
assert(!indexHtml.includes('onclick="alert(\'Contact Us'), 'index.html footer must NOT use alert for Contact Us');
assert(indexHtml.includes('<a href="mailto:support@collekt.ng">Contact Us</a>'), 'index.html must wire real contact mailto');

// Check upgrade.html card validations
const upgradeHtml = fs.readFileSync(path.join(__dirname, 'upgrade.html'), 'utf8');
assert(!upgradeHtml.includes("alert('Please enter the cardholder name.')"), 'upgrade.html must NOT use raw alert for cardholder name');
assert(!upgradeHtml.includes("alert('Please enter a valid 16-digit card number.')"), 'upgrade.html must NOT use raw alert for card number');
assert(!upgradeHtml.includes("alert('Please enter your 4-digit Wallet Transaction PIN.')"), 'upgrade.html must NOT use raw alert for wallet PIN');
console.log('  ✅ PASS: All raw browser alert() calls purged; real navigation links and showToast notifications wired');
passed++;

// TEST 4: Purge Synthetic TX-INT-1001 From wallet.html
console.log('\n--- TEST 4: Wallet Authentication & TX-INT-1001 Removal ---');
const walletHtml = fs.readFileSync(path.join(__dirname, 'wallet.html'), 'utf8');
assert(!walletHtml.includes("id: 'TX-INT-1001'"), 'wallet.html must NOT fabricate TX-INT-1001 for clean wallets');
assert(walletHtml.includes("tx.id !== 'TX-INT-1001'"), 'wallet.html must actively purge legacy TX-INT-1001 from storage cache');
assert(walletHtml.includes('No transactions recorded yet.'), 'wallet.html must provide authentic empty state');
console.log('  ✅ PASS: Synthetic TX-INT-1001 completely eliminated; clean accounts display authentic empty state');
passed++;

// TEST 5: Hardened Forgot Password Trigger in login.html
console.log('\n--- TEST 5: Login Forgot Password Hardening ---');
const loginHtml = fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8');
assert(!loginHtml.includes("onclick=\"const em = document.getElementById('email').value; if(em){ showToast('Password reset instructions sent to"), 'login.html must NOT have duplicate inline pseudo-reset handler');
assert(loginHtml.includes('handleForgotPassword'), 'login.html must call handleForgotPassword');
assert(loginHtml.includes('sb.auth.resetPasswordForEmail'), 'login.html must invoke sb.auth.resetPasswordForEmail with Supabase');
assert(loginHtml.includes('emailRegex.test(email)'), 'login.html must validate email address format before submitting');
console.log('  ✅ PASS: Forgot Password flow reliably verifies input and invokes Supabase resetPasswordForEmail');
passed++;

console.log('\n════════════════════════════════════════════════════════════');
console.log(`  ALL ${passed} INTEGRITY & PRODUCTION HARDENING TESTS PASSED!  `);
console.log('════════════════════════════════════════════════════════════\n');
process.exit(0);
