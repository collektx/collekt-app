const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: INSTANT PROFILE PRE-HYDRATION & ZERO PLACEHOLDER FLASH ===\n');

// 1. Inspect profile.html
const profileHtml = fs.readFileSync('profile.html', 'utf8');

// Assert no hardcoded placeholder defaults
assert(!profileHtml.includes('<div class="profile-name" id="profileName">Professional User</div>'), 'profile.html must not hardcode Professional User');
assert(!profileHtml.includes('<div class="profile-title" id="profileTitle">Senior Proposal Manager</div>'), 'profile.html must not hardcode Senior Proposal Manager');
assert(!profileHtml.includes('<div class="profile-location">&#x1F4CD; Lagos, Nigeria</div>'), 'profile.html must not hardcode Lagos, Nigeria');
assert(!profileHtml.includes('>U</div>'), 'profile.html avatarInner must not hardcode U');

console.log('PASS: Static profile.html contains ZERO hardcoded dummy profile text.');

// Assert instant pre-hydration script exists
assert(profileHtml.includes('var raw = localStorage.getItem(\'collekt_user\');'), 'profile.html must include parse-time synchronous pre-hydration script');
assert(profileHtml.includes('nameEl.innerHTML = \'<span style="vertical-align:middle;">\' + name + \'</span>\' + badgeHtml;'), 'profile.html pre-hydration script must set real name and badge');

console.log('PASS: Synchronous parse-time pre-hydration script is embedded.');

// Assert DOMContentLoaded runs _applyProfile before awaiting syncUser
const domLoadedIndex = profileHtml.indexOf("document.addEventListener('DOMContentLoaded'");
const applyProfileIndex = profileHtml.indexOf("_applyProfile(user);", domLoadedIndex);
const syncUserIndex = profileHtml.indexOf("await syncUser();", domLoadedIndex);

assert(domLoadedIndex !== -1, 'DOMContentLoaded listener must exist');
assert(applyProfileIndex !== -1, '_applyProfile(user) must exist in DOMContentLoaded');
assert(syncUserIndex !== -1, 'await syncUser() must exist');
assert(applyProfileIndex < syncUserIndex, '_applyProfile(user) must execute BEFORE await syncUser() to eliminate network delay');

console.log('PASS: DOMContentLoaded applies cached profile data synchronously BEFORE background syncUser.');

// 2. Inspect company-profile.html
const companyHtml = fs.readFileSync('company-profile.html', 'utf8');

assert(!companyHtml.includes('<div class="profile-name" id="coProfileName">Company Account</div>'), 'company-profile.html must not hardcode Company Account');
assert(!companyHtml.includes('<div style="font-size:14px; color:var(--muted); margin-bottom:10px; font-weight:600;" id="coSubIndustry">Energy Enterprise</div>'), 'company-profile.html must not hardcode Energy Enterprise');
assert(companyHtml.includes('var raw = localStorage.getItem(\'collekt_user\');'), 'company-profile.html must include instant pre-hydration script');

console.log('PASS: company-profile.html is free of dummy defaults and includes instant pre-hydration.');

console.log('\nALL CHECKS PASSED (100% GREEN) - ZERO PLACEHOLDER FLASH CONFIRMED!');
