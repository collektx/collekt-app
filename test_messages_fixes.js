const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING MESSAGING ENGINE & UI TESTS ---');

// 1. Test deduplication logic from app.js
const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Extract deduplicateMessages function
const fnMatch = appJsContent.match(/function deduplicateMessages\([\s\S]*?\n\}/);
if (!fnMatch) {
  throw new Error('Could not find deduplicateMessages in app.js');
}

const deduplicateMessages = new Function(`${fnMatch[0]}; return deduplicateMessages;`)();

// Test A: Deduplicate optimistic client msg with Supabase confirmed msg
const clientMsg = {
  id: 'msg_1720000000_abc123',
  client_msg_id: 'msg_1720000000_abc123',
  conversation_id: 'conv_1',
  sender_id: 'usr_user1',
  body: 'Hello there!',
  created_at: new Date('2026-09-20T12:00:00Z').toISOString(),
  status: 'sent',
  read: false
};

const sbMsg = {
  id: 'b2c3d4e5-0000-0000-0000-000000000001',
  conversation_id: 'conv_1',
  sender_id: 'usr_user1',
  body: 'Hello there!',
  created_at: new Date('2026-09-20T12:00:01Z').toISOString(),
  status: 'delivered',
  read: false
};

const deduped1 = deduplicateMessages([clientMsg, sbMsg]);
assert.strictEqual(deduped1.length, 1, 'Should deduplicate optimistic msg and Supabase msg into 1 item');
assert.strictEqual(deduped1[0].id, 'b2c3d4e5-0000-0000-0000-000000000001', 'Should preserve Supabase UUID as id');
assert.strictEqual(deduped1[0].status, 'delivered', 'Should upgrade status to delivered');
console.log('✅ Test 1 Passed: Client message smoothly deduped and upgraded to Supabase UUID and delivered status');

// Test B: Read status preservation
const readMsg = {
  id: 'b2c3d4e5-0000-0000-0000-000000000001',
  conversation_id: 'conv_1',
  sender_id: 'usr_user1',
  body: 'Hello there!',
  created_at: new Date('2026-09-20T12:00:01Z').toISOString(),
  status: 'read',
  read: true
};

const deduped2 = deduplicateMessages([deduped1[0], readMsg]);
assert.strictEqual(deduped2.length, 1, 'Should still have exactly 1 message');
assert.strictEqual(deduped2[0].status, 'read', 'Status should be read');
assert.strictEqual(deduped2[0].read, true, 'Read should be true');
console.log('✅ Test 2 Passed: Read status preserved correctly');

// 2. Test renderMessageStatusIcon in messages.html
const messagesHtml = fs.readFileSync(path.join(__dirname, 'messages.html'), 'utf8');
const iconFnMatch = messagesHtml.match(/function renderMessageStatusIcon\([\s\S]*?\n  \}/);
if (!iconFnMatch) {
  throw new Error('Could not find renderMessageStatusIcon in messages.html');
}

const renderMessageStatusIcon = new Function(`${iconFnMatch[0]}; return renderMessageStatusIcon;`)();

const sendingSvg = renderMessageStatusIcon({ status: 'sending' });
assert.ok(sendingSvg.includes('circle') || sendingSvg.includes('Sending'), 'Sending status should return clock/spinner');

const sentSvg = renderMessageStatusIcon({ status: 'sent', read: false });
assert.ok(sentSvg.includes('#8696a0'), 'Sent status should be grey (#8696a0)');
assert.strictEqual((sentSvg.match(/<path/g) || []).length, 1, 'Sent status must have exactly 1 swoosh/tick');

const deliveredSvg = renderMessageStatusIcon({ status: 'delivered', read: false });
assert.ok(deliveredSvg.includes('#8696a0'), 'Delivered status should be grey (#8696a0)');
assert.strictEqual((deliveredSvg.match(/<path/g) || []).length, 2, 'Delivered status must have exactly 2 swooshes/ticks');

const readSvg = renderMessageStatusIcon({ status: 'delivered', read: true });
assert.ok(readSvg.includes('#53bdeb'), 'Read status should be WhatsApp cyan-blue (#53bdeb)');
assert.strictEqual((readSvg.match(/<path/g) || []).length, 2, 'Read status must have exactly 2 swooshes/ticks');

console.log('✅ Test 3 Passed: WhatsApp ticks parity verified (1 grey tick for sent, 2 grey ticks for delivered, 2 blue ticks for read)');

// 3. Test Bubble CSS compactness
assert.ok(messagesHtml.includes('padding: 4px 8px 4px 8px;'), 'messages.html must have compact bubble padding');
assert.ok(messagesHtml.includes('.bubble.sent .bubble-meta { color: #667781; }'), 'messages.html timestamp must remain neutral grey on sent messages');
console.log('✅ Test 4 Passed: Message bubble CSS is compact and timestamp colors are neutral');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
