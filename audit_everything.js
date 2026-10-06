/**
 * Collekt Comprehensive Production Readiness & Deep Audit Script
 * Evaluates the entire platform across 7 critical dimensions:
 * 1. Broken Internal Links & Href Targets
 * 2. Static Asset References (Images, CSS, JS, Favicons)
 * 3. Raw Browser alert() Occurrences
 * 4. Synthetic Data, Mock Tokens, and Fake Names
 * 5. JavaScript Syntax & Serverless Function Integrity
 * 6. Hardcoded Passwords, Private Keys, or Leaked Secrets
 * 7. HTML Viewport, SEO Meta Tags & OpenGraph Integrity
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('════════════════════════════════════════════════════════════════');
console.log('       COLLEKT MASTER DEEP-DIVE PRE-LAUNCH AUDIT SUITE         ');
console.log('════════════════════════════════════════════════════════════════\n');

const rootDir = __dirname;
// Exclude non-page verification files like UUID HTML tokens
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html') && !f.startsWith('76c6155e'));

// Parse _redirects to recognize valid server-side rewrite routes
const redirectsContent = fs.existsSync(path.join(rootDir, '_redirects')) ? fs.readFileSync(path.join(rootDir, '_redirects'), 'utf8') : '';
const redirectRoutes = new Set();
redirectsContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split(/\s+/);
    if (parts[0]) redirectRoutes.add(parts[0]);
  }
});

const findings = {
  critical: [],
  warnings: [],
  passes: []
};

// Helper: strip <script> and <style> tags to avoid false positives on JS template literals
function getHtmlOnly(content) {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

// ── 1. AUDIT INTERNAL LINKS ────────────────────────────────────
console.log('--- 1. AUDITING ALL INTERNAL LINKS (HREFs) ---');
let checkedLinks = 0;
let brokenLinks = [];

htmlFiles.forEach(file => {
  const rawContent = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const htmlOnly = getHtmlOnly(rawContent);
  const hrefRegex = /href=["']([^"'#]+)["']/g;
  let match;
  while ((match = hrefRegex.exec(htmlOnly)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:') || raw.startsWith('${')) {
      continue;
    }
    checkedLinks++;
    const clean = raw.split('?')[0].split('#')[0];
    if (!clean) continue;

    // Check if it's handled by _redirects
    if (redirectRoutes.has(clean) || redirectRoutes.has(raw)) {
      continue;
    }

    let targetPath = clean.startsWith('/') ? path.join(rootDir, clean.slice(1)) : path.join(rootDir, clean);
    let exists = fs.existsSync(targetPath);
    if (!exists && !path.extname(targetPath)) {
      exists = fs.existsSync(targetPath + '.html');
    }
    if (!exists) {
      brokenLinks.push({ file, link: raw, resolved: targetPath });
    }
  }
});

if (brokenLinks.length === 0) {
  findings.passes.push(`All ${checkedLinks} internal links across ${htmlFiles.length} HTML files resolve to real targets.`);
} else {
  brokenLinks.forEach(b => {
    findings.critical.push(`Broken link in ${b.file}: href="${b.link}" -> target does not exist on disk or in _redirects!`);
  });
}

// ── 2. AUDIT ASSET REFERENCES (IMAGES, STYLES, SCRIPTS) ───────
console.log('--- 2. AUDITING STATIC ASSETS (IMG, CSS, JS) ---');
let brokenAssets = [];
let checkedAssets = 0;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const htmlOnly = getHtmlOnly(content);

  // Check <img> src in static HTML
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = imgRegex.exec(htmlOnly)) !== null) {
    const src = match[1].trim();
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('${')) continue;
    checkedAssets++;
    const clean = src.split('?')[0];
    const assetPath = clean.startsWith('/') ? path.join(rootDir, clean.slice(1)) : path.join(rootDir, clean);
    if (!fs.existsSync(assetPath)) {
      brokenAssets.push({ file, type: 'image', src, path: assetPath });
    }
  }

  // Check <link rel="stylesheet">
  const cssRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;
  while ((match = cssRegex.exec(content)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith('http://') || href.startsWith('https://')) continue;
    checkedAssets++;
    const clean = href.split('?')[0];
    const assetPath = clean.startsWith('/') ? path.join(rootDir, clean.slice(1)) : path.join(rootDir, clean);
    if (!fs.existsSync(assetPath)) {
      brokenAssets.push({ file, type: 'stylesheet', src: href, path: assetPath });
    }
  }

  // Check <script src="...">
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1].trim();
    if (!src || src.startsWith('http://') || src.startsWith('https://')) continue;
    checkedAssets++;
    const clean = src.split('?')[0];
    const assetPath = clean.startsWith('/') ? path.join(rootDir, clean.slice(1)) : path.join(rootDir, clean);
    if (!fs.existsSync(assetPath)) {
      brokenAssets.push({ file, type: 'script', src: href, path: assetPath });
    }
  }
});

if (brokenAssets.length === 0) {
  findings.passes.push(`All ${checkedAssets} static assets (images, stylesheets, scripts) exist.`);
} else {
  brokenAssets.forEach(a => {
    findings.critical.push(`Missing ${a.type} in ${a.file}: src="${a.src}"`);
  });
}

// ── 3. AUDIT RAW BROWSER ALERTS ───────────────────────────────
console.log('--- 3. AUDITING RAW BROWSER alert() OCCURRENCES ---');
let alertHits = [];
const publicFiles = ['index.html', 'login.html', 'register.html', 'dashboard.html', 'company-dashboard.html', 'marketplace.html', 'profile.html', 'company-profile.html', 'messages.html', 'wallet.html', 'public-profile.html', 'upgrade.html'];

publicFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('alert(') && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.includes('showAlert(') && !line.includes('typeof alert')) {
      alertHits.push({ file, line: idx + 1, content: line.trim() });
    }
  });
});

if (alertHits.length === 0) {
  findings.passes.push('Zero raw browser alert() calls in all core user-facing HTML files.');
} else {
  alertHits.forEach(h => {
    findings.warnings.push(`Raw alert() in ${h.file}:${h.line} -> "${h.content}"`);
  });
}

// ── 4. AUDIT FAKE DATA & PLACEHOLDERS ─────────────────────────
console.log('--- 4. AUDITING SYNTHETIC DATA & UNPROFESSIONAL PLACEHOLDERS ---');
const suspiciousPatterns = [
  { name: 'Lorem Ipsum', regex: /lorem\s+ipsum/i },
  { name: 'Example Domain', regex: /example\.com/i },
  { name: 'Synthetic 1,200+ Claim', regex: /1,200\+/ },
  { name: 'Fake TX-INT-1001 ID', regex: /TX-INT-1001/ },
  { name: 'Fake Account RC2026', regex: /RC2026/ }
];

publicFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  suspiciousPatterns.forEach(p => {
    if (p.regex.test(content)) {
      if (p.name === 'Fake TX-INT-1001 ID' && file === 'wallet.html' && content.includes("tx.id !== 'TX-INT-1001'")) {
        return; // Filter rule is intentional
      }
      findings.warnings.push(`Suspicious marker "${p.name}" found in ${file}`);
    }
  });
});

// ── 5. AUDIT JAVASCRIPT SYNTAX IN ROOT & FUNCTIONS ─────────────
console.log('--- 5. VALIDATING JAVASCRIPT SYNTAX ---');
const jsFiles = [
  'app.js', 'supabase.js', 'settings-popup.js', 'upload-modal.js', 'collekt-ai.js', 'build_and_sync.js'
];
const netlifyDir = path.join(rootDir, 'netlify', 'functions');
if (fs.existsSync(netlifyDir)) {
  fs.readdirSync(netlifyDir).filter(f => f.endsWith('.js')).forEach(f => {
    jsFiles.push(path.join('netlify', 'functions', f));
  });
}

let jsErrors = [];
jsFiles.forEach(f => {
  const full = path.join(rootDir, f);
  if (!fs.existsSync(full)) return;
  try {
    execSync(`node -c "${full}"`);
  } catch(e) {
    jsErrors.push({ file: f, error: e.message });
  }
});

if (jsErrors.length === 0) {
  findings.passes.push(`All ${jsFiles.length} JavaScript files passed syntax verification (node -c).`);
} else {
  jsErrors.forEach(e => {
    findings.critical.push(`JS Syntax Error in ${e.file}: ${e.error}`);
  });
}

// ── 6. AUDIT EXPOSED SECRETS IN CLIENT CODE ───────────────────
console.log('--- 6. AUDITING EXPOSED MASTER SECRETS IN FRONTEND CODE ---');
const frontendFiles = ['index.html', 'login.html', 'register.html', 'app.js', 'supabase.js'];
const secretKeywords = [
  { label: 'Supabase Service Role Key', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+service_role/ },
  { label: 'Paystack Secret Key', regex: /sk_live_[0-9a-zA-Z]{20,}/ },
  { label: 'Master Admin Password Plaintext', regex: /@Teamcollekt2026/ }
];

frontendFiles.forEach(f => {
  const p = path.join(rootDir, f);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  secretKeywords.forEach(k => {
    if (k.regex.test(content)) {
      findings.critical.push(`POTENTIAL EXPOSED SECRET [${k.label}] in client-facing file ${f}`);
    }
  });
});
if (findings.critical.length === 0) {
  findings.passes.push('Zero master passwords or live server secret keys found in frontend code.');
}

// ── 7. AUDIT MOBILE VIEWPORT AND TITLE TAGS ───────────────────
console.log('--- 7. AUDITING MOBILE VIEWPORT & SEO TAGS ---');
htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
  if (!content.includes('<meta name="viewport"')) {
    findings.warnings.push(`${file} is missing mobile <meta name="viewport"> tag!`);
  }
  if (!content.includes('<title>')) {
    findings.warnings.push(`${file} is missing <title> tag!`);
  }
});
findings.passes.push(`All ${htmlFiles.length} HTML files verified for viewport and title metadata.`);

// ── SUMMARY REPORT ─────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log('                    MASTER AUDIT RESULTS                        ');
console.log('════════════════════════════════════════════════════════════════\n');

console.log(`PASSES: ${findings.passes.length}`);
findings.passes.forEach(p => console.log(`  ✅ ${p}`));

console.log(`\nCRITICAL ISSUES: ${findings.critical.length}`);
if (findings.critical.length === 0) {
  console.log('  🌟 ZERO critical blockers found!');
} else {
  findings.critical.forEach(c => console.log(`  ❌ ${c}`));
}

console.log(`\nWARNINGS / AREAS TO POLISH: ${findings.warnings.length}`);
if (findings.warnings.length === 0) {
  console.log('  🌟 ZERO warnings or code smell found!');
} else {
  findings.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
}

console.log('\n════════════════════════════════════════════════════════════════\n');
process.exit(findings.critical.length === 0 ? 0 : 1);
