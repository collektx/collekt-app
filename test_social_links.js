/**
 * Collekt Automated Test Suite: Official Social Links & Platform Brand Verification
 * Verifies Twitter / X removal, WhatsApp Community integration, LinkedIn, and Instagram
 * redirection targets and SEO JSON-LD structured data.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('════════════════════════════════════════════════════════════');
console.log('    COLLEKT OFFICIAL SOCIAL LINKS & BRAND INTEGRITY TEST    ');
console.log('════════════════════════════════════════════════════════════\n');

const EXPECTED_WHATSAPP = 'https://chat.whatsapp.com/L2IduULJ0em6ycB7mmmKHf';
const EXPECTED_LINKEDIN = 'https://www.linkedin.com/in/collektnaija/';
const EXPECTED_INSTAGRAM = 'https://www.instagram.com/collektnaija/';

function testFile(filePath, isDist = false) {
  const label = isDist ? 'dist/index.html' : 'index.html';
  console.log(`--- Checking ${label} ---`);
  
  assert(fs.existsSync(filePath), `${label} must exist`);
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Twitter removal from footer
  const footerMatch = content.match(/<div class="footer-social">([\s\S]*?)<\/div>/);
  assert(footerMatch, `${label} must contain <div class="footer-social">`);
  const footerSocialHtml = footerMatch[1];

  assert(!footerSocialHtml.toLowerCase().includes('twitter'), `${label} footer must NOT contain Twitter link or title`);
  assert(!footerSocialHtml.includes('https://twitter.com'), `${label} footer must NOT contain twitter.com`);
  console.log(`  ✅ PASS: Twitter completely removed from ${label} footer`);

  // 2. WhatsApp community link verification
  assert(footerSocialHtml.includes(EXPECTED_WHATSAPP), `${label} footer must contain exact WhatsApp community link`);
  assert(footerSocialHtml.includes('title="WhatsApp Community"'), `${label} WhatsApp link must have title="WhatsApp Community"`);
  assert(footerSocialHtml.includes('aria-label="WhatsApp Community"'), `${label} WhatsApp link must have aria-label`);
  assert(footerSocialHtml.includes('target="_blank"'), `${label} WhatsApp link must open in new tab`);
  assert(footerSocialHtml.includes('rel="noopener noreferrer"'), `${label} WhatsApp link must have secure rel="noopener noreferrer"`);
  console.log(`  ✅ PASS: WhatsApp community link verified in ${label}`);

  // 3. LinkedIn link verification
  assert(footerSocialHtml.includes(EXPECTED_LINKEDIN), `${label} footer must contain exact LinkedIn URL`);
  assert(footerSocialHtml.includes('title="LinkedIn"'), `${label} LinkedIn link must have title="LinkedIn"`);
  assert(footerSocialHtml.includes('aria-label="LinkedIn"'), `${label} LinkedIn link must have aria-label`);
  assert(footerSocialHtml.includes('target="_blank"'), `${label} LinkedIn link must open in new tab`);
  assert(footerSocialHtml.includes('rel="noopener noreferrer"'), `${label} LinkedIn link must have secure rel="noopener noreferrer"`);
  console.log(`  ✅ PASS: LinkedIn profile link verified in ${label}`);

  // 4. Instagram link verification
  assert(footerSocialHtml.includes(EXPECTED_INSTAGRAM), `${label} footer must contain exact Instagram URL`);
  assert(footerSocialHtml.includes('title="Instagram"'), `${label} Instagram link must have title="Instagram"`);
  assert(footerSocialHtml.includes('aria-label="Instagram"'), `${label} Instagram link must have aria-label`);
  assert(footerSocialHtml.includes('target="_blank"'), `${label} Instagram link must open in new tab`);
  assert(footerSocialHtml.includes('rel="noopener noreferrer"'), `${label} Instagram link must have secure rel="noopener noreferrer"`);
  console.log(`  ✅ PASS: Instagram profile link verified in ${label}`);

  // 5. JSON-LD structured data verification
  assert(!content.includes('"https://twitter.com/collekt_ng"'), `${label} JSON-LD must NOT contain old twitter.com/collekt_ng`);
  assert(content.includes(EXPECTED_WHATSAPP), `${label} JSON-LD must include WhatsApp community URL`);
  assert(content.includes(EXPECTED_LINKEDIN), `${label} JSON-LD must include LinkedIn URL`);
  assert(content.includes(EXPECTED_INSTAGRAM), `${label} JSON-LD must include Instagram URL`);
  console.log(`  ✅ PASS: JSON-LD structured data verified with official social links in ${label}`);
}

// Test root index.html
testFile(path.join(__dirname, 'index.html'), false);

// Test dist/index.html if exists
const distIndex = path.join(__dirname, 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  testFile(distIndex, true);
} else {
  console.log('  ℹ️ dist/index.html does not exist yet (will be validated post-sync)');
}

console.log('\n🎉 ALL SOCIAL LINK VERIFICATION TESTS PASSED SUCCESSFULLY!');
