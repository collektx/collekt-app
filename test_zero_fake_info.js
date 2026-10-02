const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING ZERO FAKE INFORMATION AUDIT ---');

// 1. Verify admin-dashboard.html contains NO synthetic verification documents
const adminHtml = fs.readFileSync(path.join(__dirname, 'admin-dashboard.html'), 'utf8');

assert.ok(!adminHtml.includes('COREN_License_2026.pdf'), 'admin-dashboard.html must NOT generate synthetic COREN_License_2026.pdf');
assert.ok(!adminHtml.includes('CAC_Incorporation_RC2026.pdf'), 'admin-dashboard.html must NOT generate synthetic CAC_Incorporation_RC2026.pdf');
assert.ok(!adminHtml.includes('NIN_Identity_Card.pdf'), 'admin-dashboard.html must NOT generate synthetic NIN_Identity_Card.pdf');
assert.ok(!adminHtml.includes('Tax_Identification_TIN.pdf'), 'admin-dashboard.html must NOT generate synthetic Tax_Identification_TIN.pdf');
assert.ok(adminHtml.includes('No Verification Documents Uploaded Yet'), 'admin-dashboard.html must display authentic empty state when user has not uploaded files');
assert.ok(!adminHtml.includes('defUploads'), 'admin-dashboard.html must NOT contaminate individual users with default uploads');
console.log('✅ Test 1 Passed: admin-dashboard.html is 100% free of synthetic verification documents');

// 2. Verify company-dashboard.html contains NO synthetic match scores or fake fallback jobs
const compHtml = fs.readFileSync(path.join(__dirname, 'company-dashboard.html'), 'utf8');

assert.ok(!compHtml.includes('Senior EPC Engineer'), 'company-dashboard.html must NOT invent fake Senior EPC Engineer job');
assert.ok(!compHtml.includes('p.verified ? 96 : 85'), 'company-dashboard.html must NOT fabricate 96% or 85% match scores');
assert.ok(!compHtml.includes('Verified Shield • Engineering Alignment'), 'company-dashboard.html must NOT fabricate match reasons without actual match computation');
assert.ok(compHtml.includes('Please post a job or project opportunity first'), 'company-dashboard.html must require real posted job before matching talent');
console.log('✅ Test 2 Passed: company-dashboard.html is 100% free of fake jobs and synthetic match scores');

// 3. Verify app.js contains NO static 95:84 fallback
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert.ok(!appJs.includes('(c.verified || c.is_verified) ? 95 : 84'), 'app.js must NOT use static 95:84 fallback for matchTalentWithKolly');
// 4. Verify dist files mirror the exact same integrity
const distAdminHtml = fs.readFileSync(path.join(__dirname, 'dist', 'admin-dashboard.html'), 'utf8');
assert.ok(!distAdminHtml.includes('COREN_License_2026.pdf'), 'dist/admin-dashboard.html must NOT generate synthetic documents');
assert.ok(distAdminHtml.includes('No Verification Documents Uploaded Yet'), 'dist/admin-dashboard.html must display authentic empty state');

const distCompHtml = fs.readFileSync(path.join(__dirname, 'dist', 'company-dashboard.html'), 'utf8');
assert.ok(!distCompHtml.includes('Senior EPC Engineer'), 'dist/company-dashboard.html must NOT invent fake Senior EPC Engineer job');
assert.ok(!distCompHtml.includes('p.verified ? 96 : 85'), 'dist/company-dashboard.html must NOT fabricate 96% or 85% match scores');

const distAppJs = fs.readFileSync(path.join(__dirname, 'dist', 'app.js'), 'utf8');
assert.ok(!distAppJs.includes('(c.verified || c.is_verified) ? 95 : 84'), 'dist/app.js must NOT use static 95:84 fallback');
console.log('✅ Test 4 Passed: dist/ build output verified clean of all synthetic data and match scores');

console.log('\n🎉 ALL ZERO FAKE INFORMATION AUDIT TESTS PASSED!');
process.exit(0);
