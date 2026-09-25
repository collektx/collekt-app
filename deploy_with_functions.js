const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env if present
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      const val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const SITE_ID = process.env.NETLIFY_SITE_ID || '669d9b6c-79ea-4374-908e-f74000d0a25d';
const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;

if (!NETLIFY_AUTH_TOKEN) {
  console.error('ERROR: NETLIFY_AUTH_TOKEN is required. Set it in environment variables or .env file.');
  process.exit(1);
}

console.log('--- DEPLOYING STATIC SITES & ALL 23 NETLIFY FUNCTIONS TO PRODUCTION ---');
console.log('Site ID:', SITE_ID);

try {
  const cmd = `npx netlify deploy --prod --no-build -d dist -f netlify/functions --auth ${NETLIFY_AUTH_TOKEN} --site ${SITE_ID}`;
  console.log('Executing Netlify deploy command...');
  execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  console.log('🚀 LIVE DEPLOYMENT COMPLETE! All functions & static assets are live at https://collektng.com');
} catch (err) {
  console.error('Deployment failed:', err.message);
  process.exit(1);
}
