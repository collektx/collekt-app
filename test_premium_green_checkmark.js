const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('=== TEST SUITE: PREMIUM SUBSCRIBER GREEN CHECK MARK ===\n');

// Mock browser environment for app.js
const mockWindow = {
  location: { pathname: '/profile.html', search: '', hash: '' },
  addEventListener: () => {},
  document: {
    documentElement: { classList: { add: () => {}, remove: () => {}, contains: () => false }, style: {} },
    head: { appendChild: () => {}, querySelector: () => null },
    createElement: () => ({ setAttribute: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } }),
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { appendChild: () => {}, removeChild: () => {} }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

const appCode = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({
  window: mockWindow,
  document: mockWindow.document,
  localStorage: mockWindow.localStorage,
  sessionStorage: mockWindow.sessionStorage,
  location: mockWindow.location,
  navigator: { userAgent: 'node' },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Date: Date,
  Math: Math,
  JSON: JSON,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Array: Array,
  Set: Set,
  Map: Map
});

vm.runInContext(appCode, context);

const isUserPremiumSubscriber = context.isUserPremiumSubscriber;
const getShieldBadgeHTML = context.getShieldBadgeHTML;

assert(typeof isUserPremiumSubscriber === 'function', 'isUserPremiumSubscriber must be defined');
assert(typeof getShieldBadgeHTML === 'function', 'getShieldBadgeHTML must be defined');

const NOW = Date.now();
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

// Test 1: User with promo code active trial (Founding Member)
const promoUser = {
  id: 'usr_promo_1',
  name: 'Amina Bello',
  role: 'professional',
  is_premium: true,
  subscription_status: 'active_trial',
  promo_code_used: 'COLLEKT60',
  trial_started_at: new Date(NOW - 10 * 24 * 3600 * 1000).toISOString(),
  trial_ends_at: new Date(NOW + 50 * 24 * 3600 * 1000).toISOString()
};

assert.strictEqual(isUserPremiumSubscriber(promoUser), true, 'Promo code trial user must be recognized as subscribed');
const promoBadge = getShieldBadgeHTML(22, promoUser);
assert(promoBadge.includes('stroke="#16a34a"'), 'Promo user badge must contain green stroke #16a34a');
assert(promoBadge.includes('collekt-verified-check'), 'Promo user badge must contain collekt-verified-check class');
assert(promoBadge.includes('svg width="22"'), 'Promo user badge must have size 22');
console.log('PASS: Promo code subscriber successfully receives green check mark.');

// Test 2: User paying for premium (Professional Plus)
const paidProUser = {
  id: 'usr_paid_pro',
  name: 'Chidi Okonkwo',
  role: 'professional',
  is_premium: true,
  subscription_status: 'active',
  subscription_tier: 'pro_plus',
  subscription_expiry: new Date(NOW + 25 * 24 * 3600 * 1000).toISOString()
};

assert.strictEqual(isUserPremiumSubscriber(paidProUser), true, 'Paid pro user must be recognized as subscribed');
const paidProBadge = getShieldBadgeHTML(20, paidProUser);
assert(paidProBadge.includes('stroke="#16a34a"'), 'Paid pro badge must contain green stroke');
console.log('PASS: Paying professional subscriber successfully receives green check mark.');

// Test 3: Company paying for enterprise tier
const paidCoUser = {
  id: 'usr_paid_co',
  name: 'Dangote EPC Logistics',
  role: 'company',
  is_premium: true,
  subscription_status: 'active',
  subscription_tier: 'company_enterprise',
  subscription_expiry: new Date(NOW + 30 * 24 * 3600 * 1000).toISOString()
};

assert.strictEqual(isUserPremiumSubscriber(paidCoUser), true, 'Paid company enterprise must be recognized as subscribed');
const paidCoBadge = getShieldBadgeHTML(22, paidCoUser);
assert(paidCoBadge.includes('stroke="#16a34a"'), 'Paid company badge must contain green stroke');
console.log('PASS: Paying company subscriber successfully receives green check mark.');

// Test 4: Free tier user (NOT subscribed)
const freeUser = {
  id: 'usr_free',
  name: 'Emeka Non-Subscriber',
  role: 'professional',
  is_premium: false,
  subscription_status: 'free',
  verification_status: 'verified', // Even if KYC is verified!
  is_verified: true
};

assert.strictEqual(isUserPremiumSubscriber(freeUser), false, 'Non-subscriber must NOT be recognized as subscribed');
const freeBadge = getShieldBadgeHTML(22, freeUser);
assert.strictEqual(freeBadge, '', 'Non-subscriber badge MUST be empty string');
console.log('PASS: Non-subscriber strictly receives NO check mark (empty string).');

// Test 5: User whose promo trial has expired and did not renew
const expiredTrialUser = {
  id: 'usr_expired',
  name: 'Expired Trial User',
  role: 'professional',
  is_premium: false,
  subscription_status: 'active_trial',
  promo_code_used: 'COLLEKT60',
  trial_started_at: new Date(NOW - 65 * 24 * 3600 * 1000).toISOString(),
  trial_ends_at: new Date(NOW - 5 * 24 * 3600 * 1000).toISOString() // 5 days in past!
};

assert.strictEqual(isUserPremiumSubscriber(expiredTrialUser), false, 'Expired trial must NOT be recognized as subscribed');
const expiredBadge = getShieldBadgeHTML(22, expiredTrialUser);
assert.strictEqual(expiredBadge, '', 'Expired trial user badge MUST be empty string');
console.log('PASS: Expired trial user strictly receives NO check mark.');

// Test 6: Null or undefined user
assert.strictEqual(isUserPremiumSubscriber(null), false);
assert.strictEqual(getShieldBadgeHTML(22, null), '');
console.log('PASS: Null user returns empty string.');

console.log('\nALL 6/6 UNIT & BEHAVIORAL TESTS PASSED SUCCESSFULLY (100% GREEN)');
