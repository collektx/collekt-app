const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ozzwvzxugfaveggeznfa.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4'
);

const GEMINI_MODEL = 'gemini-2.5-flash';

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid user token' });
    }

    const { prompt, context } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt too long' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI key not configured' });
    }

    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: `You are Kolly, the AI assistant for Collekt (an energy talent & EPC engineering marketplace in Nigeria). Context: ${context || 'None'}. User prompt: ${prompt}`
        }]
      }]
    });

    const aiRes = await new Promise((resolve, reject) => {
      const gReq = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (gRes) => {
        let data = '';
        gRes.on('data', chunk => data += chunk);
        gRes.on('end', () => {
          try {
            resolve({ statusCode: gRes.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`Gemini returned non-JSON response: ${data}`));
          }
        });
      });
      gReq.on('error', reject);
      gReq.write(postData);
      gReq.end();
    });

    if (aiRes.statusCode < 200 || aiRes.statusCode >= 300) {
      console.error('Gemini API error:', aiRes.statusCode, aiRes.body);
      return res.status(502).json({ error: aiRes.body?.error?.message || 'AI service error' });
    }

    const reply = aiRes.body.candidates?.[0]?.content?.parts?.[0]?.text || 'No suggestion generated.';
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('AI copilot handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};