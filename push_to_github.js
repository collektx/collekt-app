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

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'collektx';
const REPO = process.env.GITHUB_REPO || 'collekt-app';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

if (!GITHUB_TOKEN) {
  console.error('ERROR: GITHUB_TOKEN is required. Set it in environment variables or .env file.');
  process.exit(1);
}

function githubRequest(endpoint, method, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method || 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Collekt-Release-Bot',
        'Accept': 'application/vnd.github.v3+json',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`GitHub API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('--- PUSHING TO GITHUB (collektx/collekt-app) ---');
  
  // 1. Get latest commit SHA on main
  const refData = await githubRequest(`/git/ref/heads/${BRANCH}`);
  const latestCommitSha = refData.object.sha;
  console.log('Latest commit SHA:', latestCommitSha);

  // 2. Get tree SHA
  const commitData = await githubRequest(`/git/commits/${latestCommitSha}`);
  const baseTreeSha = commitData.tree.sha;
  console.log('Base tree SHA:', baseTreeSha);

  // 3. Create blobs for modified files
  const rootDir = __dirname;
  const filesToPush = [
    'package.json',
    'netlify.toml',
    '_headers',
    '_redirects',
    'build_and_sync.js',
    'netlify/functions/banks.js',
    'netlify/functions/bank-resolve.js',
    'netlify/functions/paystack-initialize.js',
    'netlify/functions/paystack-verify.js',
    'netlify/functions/paystack-webhook.js',
    'netlify/functions/paystack-dva.js',
    'netlify/functions/paystack-withdraw.js',
    'netlify/functions/korapay-virtual-account.js',
    'netlify/functions/korapay-webhook.js',
    'netlify/functions/resend-webhook.js',
    'netlify/functions/company-team.js',
    'netlify/functions/ai-copilot.js',
    'netlify/functions/wallet-transfer.js',
    'netlify/functions/lib/rate-limiter.js',
    'netlify/functions/lib/payment-provider.js',
    'netlify/functions/lib/supabase-client.js',
    'api/ai-copilot.js',
    'api/gemini.js',
    'api/paystack/withdraw.js',
    'api/wallet-transfer.js',
    'test_korapay_vba.js',
    'test_ai_messaging.js',
    'test_messages_fixes.js',
    'test_wallet_transfer_flow.js',
    'test_security_audit_fixes.js',
    'admin-dashboard.html',
    'messages.html',
    'wallet.html',
    'app.js',
    'supabase.js',
    'style.css',
    'shared.css',
    'glass.css',
    'settings-popup.js',
    'upload-modal.js',
    'collekt-ai.js'
  ];

  // Include all root HTML files (cache bumped)
  const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));
  htmlFiles.forEach(f => {
    if (!filesToPush.includes(f)) filesToPush.push(f);
  });

  const tree = [];
  for (const file of filesToPush) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Create blob (use forward slashes for git paths)
    const gitPath = file.replace(/\\/g, '/');
    const blob = await githubRequest('/git/blobs', 'POST', {
      content: content,
      encoding: 'utf-8'
    });
    tree.push({
      path: gitPath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
    console.log(`Blob created for ${gitPath}: ${blob.sha.slice(0, 8)}`);
  }

  // 4. Create new tree
  const newTree = await githubRequest('/git/trees', 'POST', {
    base_tree: baseTreeSha,
    tree: tree
  });
  console.log('New tree created:', newTree.sha);

  // 5. Create new commit
  const commitMsg = 'feat: enforce api rate limiting and abuse throttling across serverless endpoints (v97.0)';
  const newCommit = await githubRequest('/git/commits', 'POST', {
    message: commitMsg,
    tree: newTree.sha,
    parents: [latestCommitSha]
  });
  console.log('New commit created:', newCommit.sha);

  // 6. Update reference
  await githubRequest(`/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: false
  });
  console.log('🎉 Successfully pushed commit to GitHub main branch!');
}

main().catch(err => {
  console.error('GitHub push error:', err);
  process.exit(1);
});
