const assert = require('assert');

console.log('=== TEST SUITE: 60-DAY PROMO ACTIVATION & LIFECYCLE MILESTONES ===\n');

// 1. Math and Milestone Calculation Test
function calculateDaysPassed(nowMs, startMs) {
  const diffDays = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, diffDays);
}

const NOW = Date.now();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Test Day 1: newly activated
assert.strictEqual(calculateDaysPassed(NOW, NOW), 1, 'Day 1 should be 1');
assert.strictEqual(calculateDaysPassed(NOW, NOW - 12 * 3600 * 1000), 1, '12 hours in should still be Day 1');

// Test Day 15: 14 full days elapsed
assert.strictEqual(calculateDaysPassed(NOW, NOW - 14 * ONE_DAY_MS), 15, '14 days elapsed should be Day 15');
assert.strictEqual(calculateDaysPassed(NOW, NOW - 14.5 * ONE_DAY_MS), 15, '14.5 days elapsed should be Day 15');

// Test Day 30: 29 full days elapsed
assert.strictEqual(calculateDaysPassed(NOW, NOW - 29 * ONE_DAY_MS), 30, '29 days elapsed should be Day 30');

// Test Day 45: 44 full days elapsed
assert.strictEqual(calculateDaysPassed(NOW, NOW - 44 * ONE_DAY_MS), 45, '44 days elapsed should be Day 45');

// Test Day 59: 58 full days elapsed
assert.strictEqual(calculateDaysPassed(NOW, NOW - 58 * ONE_DAY_MS), 59, '58 days elapsed should be Day 59');

// Test Day 60: 59 full days elapsed
assert.strictEqual(calculateDaysPassed(NOW, NOW - 59 * ONE_DAY_MS), 60, '59 days elapsed should be Day 60');

console.log('PASS: Exact milestone day calculation passed for all lifecycle milestones (1, 15, 30, 45, 59, 60).\n');

// 2. Lifecycle Trigger Simulation Test
function simulateMilestoneCheck(daysPassed, triggeredMilestones) {
  const milestones = [15, 30, 45, 59, 60];
  const newNotifications = [];
  const updatedTriggered = [...triggeredMilestones];

  for (const m of milestones) {
    if (daysPassed >= m && !updatedTriggered.includes(m)) {
      updatedTriggered.push(m);
      if (m === 15 || m === 30 || m === 45) {
        newNotifications.push({
          type: 'trial_feedback',
          day: m,
          link: `#trial-feedback-day${m}`,
          title: `Day ${m} Check-In: How Is Your Collekt Experience?`
        });
      } else if (m === 59 || m === 60) {
        newNotifications.push({
          type: 'trial_renewal',
          day: m,
          link: `#trial-renewal-day${m}`,
          title: m === 60 ? 'Final Day of Free Trial: Maintain Your Premium Status' : 'Trial Ends Tomorrow: Keep Your Premium Access Active'
        });
      }
    }
  }

  return { updatedTriggered, newNotifications };
}

// Day 1: No milestone should trigger
let state = simulateMilestoneCheck(1, []);
assert.strictEqual(state.newNotifications.length, 0, 'No milestone notifications on Day 1');
assert.deepStrictEqual(state.updatedTriggered, []);

// Day 15: Day 15 feedback triggers
state = simulateMilestoneCheck(15, state.updatedTriggered);
assert.strictEqual(state.newNotifications.length, 1);
assert.strictEqual(state.newNotifications[0].type, 'trial_feedback');
assert.strictEqual(state.newNotifications[0].day, 15);
assert.strictEqual(state.newNotifications[0].link, '#trial-feedback-day15');
assert(state.updatedTriggered.includes(15));

// Next login on Day 16: Milestone 15 does not duplicate
let nextDayState = simulateMilestoneCheck(16, state.updatedTriggered);
assert.strictEqual(nextDayState.newNotifications.length, 0, 'Day 15 should not duplicate on Day 16');

// Day 30: Day 30 feedback triggers
state = simulateMilestoneCheck(30, state.updatedTriggered);
assert.strictEqual(state.newNotifications.length, 1);
assert.strictEqual(state.newNotifications[0].day, 30);
assert(state.updatedTriggered.includes(30));

// Day 45: Day 45 feedback triggers
state = simulateMilestoneCheck(45, state.updatedTriggered);
assert.strictEqual(state.newNotifications.length, 1);
assert.strictEqual(state.newNotifications[0].day, 45);
assert(state.updatedTriggered.includes(45));

// Day 59: Renewal reminder triggers
state = simulateMilestoneCheck(59, state.updatedTriggered);
assert.strictEqual(state.newNotifications.length, 1);
assert.strictEqual(state.newNotifications[0].type, 'trial_renewal');
assert.strictEqual(state.newNotifications[0].day, 59);
assert.strictEqual(state.newNotifications[0].link, '#trial-renewal-day59');
assert(state.updatedTriggered.includes(59));

// Day 60: Final renewal reminder triggers
state = simulateMilestoneCheck(60, state.updatedTriggered);
assert.strictEqual(state.newNotifications.length, 1);
assert.strictEqual(state.newNotifications[0].type, 'trial_renewal');
assert.strictEqual(state.newNotifications[0].day, 60);
assert.strictEqual(state.newNotifications[0].link, '#trial-renewal-day60');
assert(state.updatedTriggered.includes(60));

console.log('PASS: Milestone triggers accurately delivered feedback (15, 30, 45) and renewal reminders (59, 60).\n');

// 3. Test Netlify Feedback Submit Handler
const feedbackHandler = require('./netlify/functions/feedback-submit').handler;
async function testFeedbackEndpoint() {
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      userId: 'test_user_123',
      email: 'user@example.com',
      role: 'professional',
      milestoneDay: 15,
      rating: 5,
      sentiment: 'positive',
      tags: ['AI Matching', 'Platform Speed'],
      feedbackText: 'Platform has been seamless and escrow protects my payments.',
      promoCode: 'COLLEKT60'
    })
  };

  const response = await feedbackHandler(event, {});
  assert.strictEqual(response.statusCode, 200);
  const parsed = JSON.parse(response.body);
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.feedback.rating, 5);
  assert.strictEqual(parsed.feedback.milestone_day, 15);
  console.log('PASS: /api/feedback-submit successfully processed and logged feedback.\n');
}

testFeedbackEndpoint().then(() => {
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100% GREEN)');
}).catch(err => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
