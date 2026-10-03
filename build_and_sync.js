const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- SYNCING DIST & BUMPING ASSET CACHE TO v=138.0 ---');

const rootDir = __dirname;
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Files to bump version in
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\?v=\d+\.\d+/g, '?v=138.0');
  fs.writeFileSync(filePath, content, 'utf8');
});
console.log(`Bumped cache version to ?v=138.0 across ${htmlFiles.length} root HTML files.`);

// 2. Sync all static files to dist/
const filesToCopy = [
  ...htmlFiles,
  'app.js',
  'supabase.js',
  'style.css',
  'shared.css',
  'glass.css',
  'settings-popup.js',
  'upload-modal.js',
  'collekt-ai.js',
  'auth.js',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '_redirects',
  '_headers',
  'netlify.toml'
];

// Purge any sensitive internal markdown docs, test files, temp files, or legacy files from dist
[
  'DISASTER_RECOVERY_SLA.md',
  'FINAL_IT_AUDIT_ASSURANCE_REPORT.md',
  'chart.js',
  'test_marketplace_workflow.js',
  'test_view_as_profile.js',
  'test_zero_fake_profiles.js',
  '~WRL3106.tmp',
  '.push_batch.json',
  'Collekt revenue projection.docx',
  'Collekt_NG_Service_Level_Agreement_SLA.docx',
  'Collekt_Pitch_Deck.pdf',
  'b0427e10-4b36-4d3c-8fc8-a403bb9ef1fd.png',
  '3fb7d2b9-33d8-4a71-a591-753b6c58b9eb.png'
].forEach(f => {
  const p = path.join(distDir, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});


filesToCopy.forEach(f => {
  const src = path.join(rootDir, f);
  const dest = path.join(distDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Copy directories if present
['icons', 'images', 'assets', 'api', 'netlify'].forEach(d => {
  const src = path.join(rootDir, d);
  const dest = path.join(distDir, d);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
});

// Purge any sensitive internal markdown docs, test files, temp files, heavy docs & marketing campaign assets from dist
[
  'DISASTER_RECOVERY_SLA.md',
  'FINAL_IT_AUDIT_ASSURANCE_REPORT.md',
  'chart.js',
  'test_marketplace_workflow.js',
  'test_view_as_profile.js',
  '~WRL3106.tmp',
  '.push_batch.json',
  'Collekt revenue projection.docx',
  'Collekt_NG_Service_Level_Agreement_SLA.docx',
  'Collekt_Pitch_Deck.pdf',
  'b0427e10-4b36-4d3c-8fc8-a403bb9ef1fd.png',
  '3fb7d2b9-33d8-4a71-a591-753b6c58b9eb.png',
  'images/how-collekt-works',
  'images/kolly-story',
  'images/whatsapp-campaign',
  'images/zero-stories-campaign',
  'assets/campaigns'
].forEach(f => {
  const p = path.join(distDir, f);
  if (fs.existsSync(p)) {
    const s = fs.statSync(p);
    if (s.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  }
});

console.log('Synced files to dist/.');

// 3. Create dist.zip using PowerShell
try {
  execSync(`powershell -Command "Compress-Archive -Path dist/* -DestinationPath dist.zip -Force"`, { cwd: rootDir });
  console.log('Created dist.zip successfully.');
} catch(e) {
  console.warn('Zip creation warning:', e.message);
}
