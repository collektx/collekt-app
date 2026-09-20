const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ozzwvzxugfaveggeznfa.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4'
);

function paystackApi(endpoint, method, postData) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  return new Promise((resolve, reject) => {
    const dataString = postData ? JSON.stringify(postData) : '';
    const req = https.request({
      hostname: 'api.paystack.co',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Paystack returned non-JSON response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid user token' });

    const { amount, bankCode, accountNumber, accountName } = req.body || {};
    const withdrawalAmount = Number(amount);

    if (!withdrawalAmount || withdrawalAmount < 1000) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ?1,000' });
    }
    if (!bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ error: 'Incomplete bank details provided' });
    }

    const { data: wallet } = await supabase.from('wallets').select('available_balance').eq('user_id', user.id).single();
    if (!wallet || Number(wallet.available_balance) < withdrawalAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request initiated successfully',
      reference: 'WDR_' + Date.now()
    });
  } catch (err) {
    console.error('Withdrawal error:', err);
    return res.status(500).json({ error: err.message });
  }
};