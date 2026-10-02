const fs = require('fs');
const path = require('path');
const https = require('https');

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
const ZIP_PATH = path.join(__dirname, 'dist.zip');

console.log('--- DEPLOYING TO NETLIFY PRODUCTION ---');
console.log('Site ID:', SITE_ID);
console.log('Zip file size:', (fs.statSync(ZIP_PATH).size / (1024 * 1024)).toFixed(2), 'MB');

const stat = fs.statSync(ZIP_PATH);
const fileSize = stat.size;

const req = https.request({
  hostname: 'api.netlify.com',
  path: `/api/v1/sites/${SITE_ID}/deploys`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${NETLIFY_AUTH_TOKEN}`,
    'Content-Type': 'application/zip',
    'Content-Length': fileSize
  }
}, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log('Netlify API status code:', res.statusCode);
    try {
      const json = JSON.parse(responseData);
      console.log('Deploy ID:', json.id);
      console.log('Deploy State:', json.state);
      console.log('Deploy URL:', json.deploy_ssl_url || json.url);
      console.log('Live URL: https://collektng.com');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('🚀 NETLIFY DEPLOYMENT TRIGGERED SUCCESSFULLY!');
      } else {
        console.error('Netlify deploy failed:', json);
      }
    } catch(e) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

console.log(`Starting upload: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

const readStream = fs.createReadStream(ZIP_PATH, { highWaterMark: 64 * 1024 });
let uploaded = 0;

readStream.on('data', (chunk) => {
  uploaded += chunk.length;
  const pct = Math.round((uploaded / fileSize) * 100);
  process.stdout.write(`\rUploading: ${(uploaded / 1024 / 1024).toFixed(2)} / ${(fileSize / 1024 / 1024).toFixed(2)} MB [${pct}%]`);
  if (!req.write(chunk)) {
    readStream.pause();
    req.once('drain', () => readStream.resume());
  }
});

readStream.on('end', () => {
  console.log('\nAll data sent to Netlify API. Finalizing request...');
  req.end();
});
