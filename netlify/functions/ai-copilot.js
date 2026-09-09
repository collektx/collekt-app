const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// NOTE: 'gemini-pro' is deprecated and no longer callable — even
// 'gemini-2.0-flash' was shut down June 1, 2026. Using 'gemini-2.5-flash'
// here as a current, stable choice. Model names change often — verify the
// latest available model in Google AI Studio before deploying, and update
// this constant if needed.
const GEMINI_MODEL = 'gemini-2.5-flash';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://collektng.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    // 1. Require a logged-in user — without this, anyone who finds this URL
    // can call it directly and consume your Gemini quota/billing for free.
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing token' }) };
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid user token' }) };
    }

    const { prompt, context } = JSON.parse(event.body || '{}');

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing prompt' }) };
    }
    // Basic guardrail against extremely long inputs driving up cost/latency
    if (prompt.length > 4000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt too long' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI key not configured' }) };
    }

    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: `You are Kolly, the AI assistant for Collekt (an energy talent & EPC engineering marketplace in Nigeria). Context: ${context || 'General'}. User prompt: ${prompt}`
        }]
      }]
    });

    const aiRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            reject(new Error(`Gemini returned non-JSON response: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Surface upstream errors instead of silently returning a generic message
    if (aiRes.statusCode < 200 || aiRes.statusCode >= 300) {
      console.error('Gemini API error:', aiRes.statusCode, aiRes.body);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: aiRes.body?.error?.message || 'AI service error' })
      };
    }

    const reply = aiRes.body.candidates?.[0]?.content?.parts?.[0]?.text || 'No suggestion generated.';
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('AI copilot handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
