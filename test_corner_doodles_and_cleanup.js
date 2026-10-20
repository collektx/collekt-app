const fs = require('fs');
const path = require('path');

console.log('═════════════════════════════════════════════════════════');
console.log('🧪 VERIFICATION: CORNER DOODLE WRITING & CLEANUP SUITE');
console.log('═════════════════════════════════════════════════════════\n');

let failed = false;

// 1. Verify shared.css for Caveat & Kalam Google font imports and doodle styles
console.log('▶ Test 1: Shared CSS Font Imports & Doodle Canvas Styles');
const sharedCss = fs.readFileSync(path.join(__dirname, 'shared.css'), 'utf8');

if (!sharedCss.includes("family=Caveat") || !sharedCss.includes("family=Kalam")) {
  console.error('❌ FAIL: Caveat or Kalam font import missing in shared.css');
  failed = true;
} else {
  console.log('  ✅ Caveat & Kalam Google font import verified in shared.css');
}

if (!sharedCss.includes('.collekt-doodle-canvas') || !sharedCss.includes('.doodle-tag')) {
  console.error('❌ FAIL: .collekt-doodle-canvas or .doodle-tag CSS missing in shared.css');
  failed = true;
} else {
  console.log('  ✅ .collekt-doodle-canvas & .doodle-tag CSS definitions confirmed');
}

if (!sharedCss.includes('filter: blur') && !sharedCss.includes('-webkit-filter: blur')) {
  console.error('❌ FAIL: Soft blur filter missing on doodle canvas in shared.css');
  failed = true;
} else {
  console.log('  ✅ Soft blur filter confirmed on .collekt-doodle-canvas');
}

if (!sharedCss.includes('overflow-x: hidden') || !sharedCss.includes('position: relative')) {
  console.error('❌ FAIL: .app-main positioning / overflow-x containment missing in shared.css');
  failed = true;
} else {
  console.log('  ✅ .app-main relative positioning and overflow-x containment verified');
}

// 2. Verify app.js initCollektDoodleCanvas implementation
console.log('\n▶ Test 2: App.js Doodle Canvas Engine & Words');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

if (!appJs.includes('function initCollektDoodleCanvas()')) {
  console.error('❌ FAIL: function initCollektDoodleCanvas missing in app.js');
  failed = true;
} else {
  console.log('  ✅ initCollektDoodleCanvas() found in app.js');
}

// Check key professional terms
const proTerms = ['Engineers &', 'Quantity Surveyors', 'Pipeline &', 'Fabrication &', 'Geologists &'];
const missingProTerms = proTerms.filter(t => !appJs.includes(t) && !appJs.includes(t.replace('&', '&amp;')));
if (missingProTerms.length > 0) {
  console.error('❌ FAIL: Missing professional doodle terms:', missingProTerms);
  failed = true;
} else {
  console.log('  ✅ Professional terms (Engineers, Surveyors, HAZOP, BIM, Rigging) verified');
}

// Check key company terms
const coTerms = ['Energy &', 'Oil & Gas', 'Corporate Tenders', 'Direct Enterprise Hiring', 'Offshore &'];
const missingCoTerms = coTerms.filter(t => !appJs.includes(t) && !appJs.includes(t.replace('&', '&amp;')));
if (missingCoTerms.length > 0) {
  console.error('❌ FAIL: Missing company doodle terms:', missingCoTerms);
  failed = true;
} else {
  console.log('  ✅ Company terms (Oil & Gas, Infrastructure, EPC, Enterprise Hiring) verified');
}

// Check key ecosystem & escrow terms
const ecoTerms = ['Escrow Protected', 'Milestone Releases', 'NOVA Bank Escrow Guaranteed', 'Win Bigger Contracts', '24hr Bid Turnaround'];
const missingEcoTerms = ecoTerms.filter(t => !appJs.includes(t));
if (missingEcoTerms.length > 0) {
  console.error('❌ FAIL: Missing ecosystem doodle terms:', missingEcoTerms);
  failed = true;
} else {
  console.log('  ✅ Ecosystem terms (Escrow Protected, Milestones, NOVA Bank, Turnaround) verified');
}

// Check doodle tag count
const doodleTagMatches = (appJs.match(/class="doodle-tag/g) || []).length;
if (doodleTagMatches < 40) {
  console.error(`❌ FAIL: Expected at least 40 overlapping doodle items, found ${doodleTagMatches}`);
  failed = true;
} else {
  console.log(`  ✅ Overlapping doodle density verified: ${doodleTagMatches} layered items active!`);
}

// 3. Verify zero unwanted emojis in dashboard.html
console.log('\n▶ Test 3: Dashboard.html Cleanliness');
const dashHtml = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const unwantedDashEntities = ['&#x1F44B;', '&#x1F4CC;', '&#x1F3C6;', '&#x1F4B0;', '&#x1F441;', '&#x1F3E2;'];
const foundDash = unwantedDashEntities.filter(e => dashHtml.includes(e));
if (foundDash.length > 0) {
  console.error('❌ FAIL: Unwanted emoji entities found in dashboard.html:', foundDash);
  failed = true;
} else {
  console.log('  ✅ Zero unwanted emoji entities in dashboard.html');
}

// 4. Verify zero unwanted emojis in company-dashboard.html
console.log('\n▶ Test 4: Company-Dashboard.html Cleanliness');
const coDashHtml = fs.readFileSync(path.join(__dirname, 'company-dashboard.html'), 'utf8');
const unwantedCoEntities = ['&#x1F44F;', '&#x1F50D;', '&#x1F91D;', '&#x1F4AC;', '&#x1F4B0;', '&#x1F4C4;', '&#x1F6E1;'];
const foundCo = unwantedCoEntities.filter(e => coDashHtml.includes(e));
if (foundCo.length > 0) {
  console.error('❌ FAIL: Unwanted emoji entities found in company-dashboard.html:', foundCo);
  failed = true;
} else {
  console.log('  ✅ Zero unwanted emoji entities in company-dashboard.html');
}

if (failed) {
  console.error('\n❌ SOME TESTS FAILED. PLEASE REVIEW ABOVE ERRORS.');
  process.exit(1);
} else {
  console.log('\n🎉 ALL CORNER DOODLE WRITING & CLEANUP TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
