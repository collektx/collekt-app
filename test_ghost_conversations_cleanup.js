const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING GHOST CONVERSATION CLEANUP & HEADER FIXES ---');

// 1. Verify messages.html header doesn't contain AI Draft or Transfer to Wallet in chat-actions
const messagesHtml = fs.readFileSync(path.join(__dirname, 'messages.html'), 'utf8');

// Ensure chat-actions does not contain AI Draft or Transfer to Wallet buttons
const chatActionsMatch = messagesHtml.match(/<div class="chat-actions"[^>]*>([\s\S]*?)<\/div>/);
assert.ok(chatActionsMatch, 'chat-actions div must be present in messages.html');
const chatActionsInner = chatActionsMatch[1];
assert.ok(!chatActionsInner.includes('AI Draft'), 'chat-actions header must NOT contain "AI Draft" button');
assert.ok(!chatActionsInner.includes('Transfer to Wallet'), 'chat-actions header must NOT contain "Transfer to Wallet" button');
assert.ok(!chatActionsInner.includes('Voice Call'), 'chat-actions must NOT contain Voice Call');
assert.ok(!chatActionsInner.includes('Video Call'), 'chat-actions must NOT contain Video Call');
assert.ok(chatActionsInner.includes('Delete Entire Conversation'), 'chat-actions must retain Delete Entire Conversation');
console.log('✅ Test 1 Passed: Chat header cleanly stripped of "AI Draft", "Transfer to Wallet", and call buttons');

// 2. Verify renderContacts empty-state does not dump directory users
assert.ok(!messagesHtml.includes('Select an active member below to start messaging instantly:'), 'renderContacts must NOT dump directory members on empty state');
assert.ok(messagesHtml.includes('No conversations yet'), 'renderContacts must show clean "No conversations yet" state');
assert.ok(messagesHtml.includes('openNewConversationModal()'), 'renderContacts must offer explicit "New Message" button');
console.log('✅ Test 2 Passed: Empty inbox displays clean empty state without leaking uncontacted directory members');

// 2b. Verify waAttachPopup doesn't contain Transfer to Wallet, Camera & Video Note, or Voice Note
const waAttachStart = messagesHtml.indexOf('id="waAttachPopup"');
const waAttachEnd = messagesHtml.indexOf('id="chatFileInput"');
assert.ok(waAttachStart !== -1 && waAttachEnd !== -1, 'waAttachPopup and chatFileInput must exist');
const waAttachInner = messagesHtml.slice(waAttachStart, waAttachEnd);
assert.ok(!waAttachInner.includes('Transfer to Wallet'), 'wa-attach-popup must NOT contain Transfer to Wallet');
assert.ok(!waAttachInner.includes('Camera & Video Note') && !waAttachInner.includes('Camera &amp; Video Note'), 'wa-attach-popup must NOT contain Camera & Video Note');
assert.ok(!waAttachInner.includes('Voice Note'), 'wa-attach-popup must NOT contain Voice Note');
assert.ok(waAttachInner.includes('Document'), 'wa-attach-popup must retain Document');
assert.ok(waAttachInner.includes('Photos &amp; videos') || waAttachInner.includes('Photos & videos'), 'wa-attach-popup must retain Photos & videos');
console.log('✅ Test 2b Passed: wa-attach-popup only contains Document and Photos & videos (unmarked items)');


// 3. Test getMyConversations() logic with ghost conversations
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

let store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.window = {
  location: { pathname: '/messages.html', search: '', hash: '' },
  dispatchEvent: () => {},
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} })
};
const mockEl = () => ({ style: {}, classList: { add: ()=>{}, remove: ()=>{}, contains: ()=>false }, setAttribute: ()=>{}, appendChild: ()=>{} });
global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  cookie: '',
  documentElement: mockEl(),
  head: mockEl(),
  body: mockEl(),
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: mockEl
};

eval(appJs);

// Set current logged-in company user
const companyUser = {
  id: '467c002d-124e-4a05-a62f-1cd7b11f666c',
  email: 'collektng@gmail.com',
  name: 'Collekt NG',
  role: 'company'
};
store['collekt_user'] = JSON.stringify(companyUser);

// Ghost conversation with Mike Chimezie (0 messages, empty preview)
const ghostConv = {
  id: 'conv_ghost_mike_chimezie',
  participants: ['467c002d-124e-4a05-a62f-1cd7b11f666c', '63b0edc5-1e8d-46b9-9ae8-d1800b817ee6'],
  created_at: new Date().toISOString(),
  last_message: '',
  last_at: new Date().toISOString()
};

// Real conversation with Dave Ojeowere (has real messages)
const realConv = {
  id: 'conv_real_dave_ojeowere',
  participants: ['467c002d-124e-4a05-a62f-1cd7b11f666c', 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91'],
  created_at: new Date().toISOString(),
  last_message: 'is this something you can do?',
  last_at: new Date().toISOString()
};

store['collekt_conversations'] = JSON.stringify([ghostConv, realConv]);
store['collekt_all_messages'] = JSON.stringify([
  {
    id: 'msg_1',
    conversation_id: 'conv_real_dave_ojeowere',
    sender_id: '467c002d-124e-4a05-a62f-1cd7b11f666c',
    body: 'hello',
    created_at: new Date().toISOString(),
    status: 'delivered'
  },
  {
    id: 'msg_2',
    conversation_id: 'conv_real_dave_ojeowere',
    sender_id: 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91',
    body: 'How can i help you?',
    created_at: new Date().toISOString(),
    status: 'read'
  }
]);

const myConvs = getMyConversations();
console.log('Conversations returned by getMyConversations():', myConvs.map(c => c.id));
assert.strictEqual(myConvs.length, 1, 'Only real conversation must be returned');
assert.strictEqual(myConvs[0].id, 'conv_real_dave_ojeowere', 'Real conversation must match');
assert.ok(!myConvs.some(c => c.id === 'conv_ghost_mike_chimezie'), 'Ghost conversation with Mike Chimezie must be completely excluded');
console.log('✅ Test 3 Passed: getMyConversations() strictly excludes ghost conversations with Mike Chimezie');

// 4. Test when no messages exist at all
store['collekt_all_messages'] = JSON.stringify([]);
store['collekt_conversations'] = JSON.stringify([ghostConv]);
const emptyConvs = getMyConversations();
assert.strictEqual(emptyConvs.length, 0, 'Must return 0 conversations when no messages sent');
console.log('✅ Test 4 Passed: Returns empty array when user has not sent or received any messages');

console.log('\n🎉 ALL GHOST CONVERSATION & HEADER CLEANUP TESTS PASSED!');
process.exit(0);
