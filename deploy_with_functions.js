const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function netlifyReq(endpoint, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.netlify.com',
      path: endpoint,
      method: method || 'GET',
      headers: {
        'Authorization': `Bearer ${NETLIFY_AUTH_TOKEN}`,
        'User-Agent': 'Collekt-Deploy-Agent',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed, raw: resBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: resBody });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testDeploy() {
  console.log('--- TESTING NETLIFY FUNCTIONS DEPLOY API ---');
  
  // 1. Create a zip for a test function
  const funcDir = path.join(__dirname, 'netlify', 'functions');
  const tempZipDir = path.join(__dirname, '.temp_func_zips');
  if (!fs.existsSync(tempZipDir)) fs.mkdirSync(tempZipDir, { recursive: true });

  const funcFiles = fs.readdirSync(funcDir).filter(f => f.endsWith('.js'));
  console.log(`Found ${funcFiles.length} functions to bundle:`, funcFiles);

  const functionsMap = {};
  const functionZips = {};

  for (const f of funcFiles) {
    const name = f.replace('.js', '');
    const zipPath = path.join(tempZipDir, `${name}.zip`);
    
    // Zip the function file plus lib/ directory
    // We create a temp folder for the function
    const singleFuncTempDir = path.join(tempZipDir, name);
    if (fs.existsSync(singleFuncTempDir)) fs.rmSync(singleFuncTempDir, { recursive: true });
    fs.mkdirSync(singleFuncTempDir, { recursive: true });
    
    fs.copyFileSync(path.join(funcDir, f), path.join(singleFuncTempDir, f));
    const libDir = path.join(funcDir, 'lib');
    if (fs.existsSync(libDir)) {
      fs.cpSync(libDir, path.join(singleFuncTempDir, 'lib'), { recursive: true });
    }

    // Zip it
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    execSync(`powershell -Command "Compress-Archive -Path '${singleFuncTempDir}/*' -DestinationPath '${zipPath}' -Force"`);

    const zipBuffer = fs.readFileSync(zipPath);
    const hash = sha1(zipBuffer);
    functionsMap[name] = hash;
    functionZips[name] = zipBuffer;
    console.log(`Zipped function [${name}] -> SHA1: ${hash}`);
  }

  // 2. Also map static files
  const distDir = path.join(__dirname, 'dist');
  const filesMap = {};
  const fileBuffers = {};

  function scanDir(dir, relPath = '') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const rel = relPath ? `${relPath}/${item}` : item;
      if (fs.statSync(full).isDirectory()) {
        if (item !== 'netlify' && item !== 'node_modules') {
          scanDir(full, rel);
        }
      } else {
        const buf = fs.readFileSync(full);
        const hash = sha1(buf);
        const normPath = '/' + rel.replace(/\\/g, '/');
        filesMap[normPath] = hash;
        fileBuffers[normPath] = buf;
      }
    }
  }

  scanDir(distDir);
  console.log(`Mapped ${Object.keys(filesMap).length} static files.`);

  // 3. Initiate Deploy with static files and functions manifest
  const deployPayload = JSON.stringify({
    files: filesMap,
    functions: functionsMap
  });

  console.log('Sending deploy manifest to Netlify...');
  const initRes = await netlifyReq(`/api/v1/sites/${SITE_ID}/deploys`, 'POST', {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(deployPayload)
  }, deployPayload);

  console.log('Deploy init status:', initRes.status);
  if (initRes.status < 200 || initRes.status >= 300) {
    console.error('Deploy init failed:', initRes.data || initRes.raw);
    return;
  }

  const deployId = initRes.data.id;
  const requiredFiles = initRes.data.required || [];
  const requiredFuncs = initRes.data.required_functions || [];
  console.log(`Deploy ID: ${deployId}`);
  console.log(`Required files to upload: ${requiredFiles.length}`);
  console.log(`Required functions to upload: ${requiredFuncs.length}`);

  // Upload required files
  for (const fileSha of requiredFiles) {
    const filePath = Object.keys(filesMap).find(p => filesMap[p] === fileSha);
    if (filePath && fileBuffers[filePath]) {
      const buf = fileBuffers[filePath];
      const putRes = await netlifyReq(`/api/v1/deploys/${deployId}/files${filePath}`, 'PUT', {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length
      }, buf);
      console.log(`Uploaded file: ${filePath} (${putRes.status})`);
    } else {
      // Check if it's a function SHA
      const funcName = Object.keys(functionsMap).find(n => functionsMap[n] === fileSha);
      if (funcName && functionZips[funcName]) {
        const zbuf = functionZips[funcName];
        const putRes = await netlifyReq(`/api/v1/deploys/${deployId}/functions/${funcName}`, 'PUT', {
          'Content-Type': 'application/octet-stream',
          'Content-Length': zbuf.length
        }, zbuf);
        console.log(`Uploaded function (from required): ${funcName} (${putRes.status})`);
      }
    }
  }

  // Upload required functions if separately listed
  for (const funcSha of requiredFuncs) {
    const funcName = Object.keys(functionsMap).find(n => functionsMap[n] === funcSha);
    if (funcName && functionZips[funcName]) {
      const zbuf = functionZips[funcName];
      const putRes = await netlifyReq(`/api/v1/deploys/${deployId}/functions/${funcName}`, 'PUT', {
        'Content-Type': 'application/octet-stream',
        'Content-Length': zbuf.length
      }, zbuf);
      console.log(`Uploaded function: ${funcName} (${putRes.status})`);
    }
  }

  console.log('🎉 DEPLOYMENT AND FILES UPLOAD COMPLETE!');
  console.log(`Deploy ID: ${deployId}`);
  console.log(`Check live site: https://collektng.com`);
}

testDeploy().catch(console.error);
