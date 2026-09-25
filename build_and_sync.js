const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- SYNCING DIST & BUMPING ASSET CACHE TO v=109.0 ---');

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
  content = content.replace(/\?v=\d+\.\d+/g, '?v=109.0');
  fs.writeFileSync(filePath, content, 'utf8');
});
console.log(`Bumped cache version to ?v=109.0 across ${htmlFiles.length} root HTML files.`);

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
  'chart.js',
  'auth.js',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '_redirects',
  '_headers',
  'netlify.toml'
];

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

console.log('Synced files to dist/.');

// 3. Create dist.zip using PowerShell
try {
  execSync(`powershell -Command "Compress-Archive -Path dist/* -DestinationPath dist.zip -Force"`, { cwd: rootDir });
  console.log('Created dist.zip successfully.');
} catch(e) {
  console.warn('Zip creation warning:', e.message);
}
