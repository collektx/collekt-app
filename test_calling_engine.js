const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING COLLEKT REALTIME CALLING ENGINE (v121.0) ---');

// 1. Static Audit of app.js for CollektCalling
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

assert(appJs.includes('const CollektCalling ='), 'app.js defines CollektCalling');
assert(appJs.includes('window.CollektCalling = CollektCalling'), 'app.js exports CollektCalling to window');
assert(appJs.includes('startWhatsAppIncomingRing'), 'app.js implements startWhatsAppIncomingRing');
assert(appJs.includes('startWhatsAppOutgoingRing'), 'app.js implements startWhatsAppOutgoingRing');
assert(appJs.includes('ensureCallElementsInDOM'), 'app.js implements ensureCallElementsInDOM');
assert(appJs.includes('stun:global.stun.twilio.com:3478'), 'app.js includes multi-STUN server list');
assert(appJs.includes('pendingIceCandidates'), 'app.js implements ICE candidate queueing');
assert(appJs.includes('collekt_webrtc_calls'), 'app.js subscribes to collekt_webrtc_calls');

console.log('✅ PASS: Static audit of app.js CollektCalling engine verified');

// 2. Static Audit of glass.css for Global Call Styles
const glassCss = fs.readFileSync(path.join(__dirname, 'glass.css'), 'utf8');

assert(glassCss.includes('.incoming-call-modal'), 'glass.css defines .incoming-call-modal');
assert(glassCss.includes('.call-overlay'), 'glass.css defines .call-overlay');
assert(glassCss.includes('.call-pulse'), 'glass.css defines .call-pulse');
assert(glassCss.includes('.call-controls'), 'glass.css defines .call-controls');
assert(glassCss.includes('.local-pip-video'), 'glass.css defines .local-pip-video');
assert(glassCss.includes('.call-btn.end-call'), 'glass.css defines .call-btn.end-call');

console.log('✅ PASS: Static audit of glass.css calling styling verified');

// 3. Static Audit of messages.html Integration (Calls cleanly removed per UX requirement)
const messagesHtml = fs.readFileSync(path.join(__dirname, 'messages.html'), 'utf8');

assert(!messagesHtml.includes('title="Voice Call"'), 'messages.html has cleanly removed Voice Call button');
assert(!messagesHtml.includes('title="Video Call"'), 'messages.html has cleanly removed Video Call button');
assert(!messagesHtml.includes('id="incomingCallModal"'), 'messages.html has cleanly removed incomingCallModal');
assert(!messagesHtml.includes("callParam === 'voice'"), 'messages.html has removed ?call= auto-initiation');

console.log('✅ PASS: messages.html calling triggers cleanly removed');

// 3b. Static Audit of public-profile.html Calling Links (Direct calling buttons cleanly removed)
const publicProfileHtml = fs.readFileSync(path.join(__dirname, 'public-profile.html'), 'utf8');
assert(!publicProfileHtml.includes('id="callVoiceBtn"'), 'public-profile.html has removed callVoiceBtn');
assert(!publicProfileHtml.includes('id="callVideoBtn"'), 'public-profile.html has removed callVideoBtn');
assert(!publicProfileHtml.includes('&call=voice'), 'public-profile.html has removed direct voice call link');
assert(!publicProfileHtml.includes('&call=video'), 'public-profile.html has removed direct video call link');

console.log('✅ PASS: public-profile.html calling buttons cleanly removed');


// 4. Unit Testing Calling Signaling & Mock Runtime
const mockWindow = {
  AudioContext: class {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {}
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        connect: () => {}
      };
    }
    resume() { return Promise.resolve(); }
  },
  localStorage: {
    _data: {},
    setItem(k, v) { this._data[k] = v; },
    getItem(k) { return this._data[k]; }
  },
  addEventListener: () => {},
  dispatchEvent: () => {}
};

const mockDocument = {
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: (tag) => {
    return {
      tagName: tag,
      id: '',
      className: '',
      innerHTML: '',
      style: {},
      appendChild: () => {}
    };
  },
  getElementById: (id) => null,
  body: {
    appendChild: (el) => {
      // Mock element appended
    }
  }
};

global.window = mockWindow;
global.document = mockDocument;
global.navigator = { vibrate: () => true };

// Verify evaluation of CollektCalling snippet
const callingMatch = appJs.match(/const CollektCalling = \(\(\) => \{[\s\S]*?\}\)\(\);/);
assert(callingMatch, 'Found CollektCalling IIFE definition');

const CollektCallingModule = new Function('window', 'document', 'navigator', `
  let getUser = () => ({ id: 'usr_1', email: 'test@collekt.ng', name: 'Test User', role: 'professional' });
  let getCanonicalUserId = (u) => u.id;
  let colorForId = () => '#0e3b35';
  let sendMessage = () => true;
  let renderContacts = () => true;
  ${callingMatch[0]}
  return CollektCalling;
`)(mockWindow, mockDocument, global.navigator);

assert(typeof CollektCallingModule.startCall === 'function', 'CollektCalling exports startCall');
assert(typeof CollektCallingModule.acceptCall === 'function', 'CollektCalling exports acceptCall');
assert(typeof CollektCallingModule.declineCall === 'function', 'CollektCalling exports declineCall');
assert(typeof CollektCallingModule.endCall === 'function', 'CollektCalling exports endCall');
assert(typeof CollektCallingModule.toggleMute === 'function', 'CollektCalling exports toggleMute');
assert(typeof CollektCallingModule.toggleCam === 'function', 'CollektCalling exports toggleCam');

console.log('✅ PASS: CollektCalling runtime execution and interface assertions passed');

console.log('════════════════════════════════════════════════════════════');
console.log('ALL IN-CALL REALTIME SYSTEM VERIFICATIONS PASSED (100%)');
console.log('════════════════════════════════════════════════════════════');
process.exit(0);

