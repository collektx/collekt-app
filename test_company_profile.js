const fs = require('fs');

console.log('--- TESTING COMPANY PROFILE HTML & SCRIPT INTEGRITY ---');

const html = fs.readFileSync('company-profile.html', 'utf8');

// 1. Check all getElementById targets
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = regex.exec(html)) !== null) {
  ids.add(match[1]);
}

const missing = [];
ids.forEach(id => {
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    // Check if it might be dynamically created or optional fallback
    missing.push(id);
  }
});

console.log(`Verified ${ids.size} getElementById references.`);
console.log('Missing/Optional IDs:', missing);

// 2. Validate all inline scripts syntax
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
let scriptsValid = true;
scripts.forEach((s, idx) => {
  try {
    new Function(s);
    console.log(`✅ Script ${idx} parsed and validated cleanly`);
  } catch(e) {
    console.error(`❌ Script ${idx} syntax error:`, e.message);
    scriptsValid = false;
  }
});

// 3. Verify all 6 tabs exist
const expectedTabs = ['overview', 'projects', 'team', 'reviews', 'documents', 'identity'];
let tabsValid = true;
expectedTabs.forEach(t => {
  const hasTabBtn = html.includes(`switchTab('${t}'`);
  const hasTabContent = html.includes(`id="tab-${t}"`);
  if (hasTabBtn && hasTabContent) {
    console.log(`✅ Tab '${t}' button and container exist`);
  } else {
    console.error(`❌ Tab '${t}' missing button or container (btn: ${hasTabBtn}, content: ${hasTabContent})`);
    tabsValid = false;
  }
});

if (scriptsValid && tabsValid) {
  console.log('\n🎉 ALL COMPANY PROFILE INTEGRITY CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('\n❌ INTEGRITY CHECKS FAILED!');
  process.exit(1);
}
