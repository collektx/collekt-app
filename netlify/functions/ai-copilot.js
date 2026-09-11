const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_MODEL = 'gemini-2.5-flash';

const SKILL_INSTRUCTIONS = {
  draft_escrow: 'You are Kolly, the Senior Legal & Escrow Architect on Collekt (Nigerian Energy, EPC & Marketplace Platform). Draft an airtight, Nigerian-law-compliant Milestone Escrow Agreement. Include: (1) Project Scope & Specifications, (2) Itemized Milestone Schedule with NGN budget allocations, (3) Explicit Deliverables & Acceptance Verification Criteria, (4) Mandatory Inspection Period (e.g. 48-72 hours), and (5) Dispute Resolution clause governed by the Arbitration and Mediation Act 2023 (Lagos jurisdiction). Format cleanly with Markdown headings and bullet points.',

  estimate_boq: 'You are Kolly, the Nigerian Engineering & Procurement BOQ (Bill of Quantities) Cost Estimator. Provide realistic Nigerian Naira (NGN) estimates for labor, materials, equipment, logistics, contingency, and recommended contractor markup margins. Include clear bullet points and total cost projections.',

  dispute_review: 'You are Kolly, an impartial Escrow Dispute Arbitrator on Collekt. Analyze the provided buyer and vendor statements, waybill delivery proofs, and contract milestones. Provide an objective, unbiased recommendation stating whether funds should be released, refunded in full, or split partially with remediation terms.',

  tax_calc: 'You are Kolly, the Nigerian Tax, WHT & Fee Advisor on Collekt. Calculate and explain the financial breakdown: (1) Gross Contract Sum, (2) Withholding Tax (WHT: 5% for individuals/supplies or 10% for corporate/technical contracts), (3) VAT (7.5%), (4) Collekt Platform Commission (10%), and (5) Net Remittance to Vendor in Nigerian Naira (NGN).',

  trust_profile: 'You are Kolly, the Vendor Risk & Verification Analyst on Collekt. Assess the vendor profile, CAC RC/BN number, NIN identity verification, COREN / NOGICD engineering accreditation, and assign a Trust & Safety score from 0 to 100 with actionable improvement advice.'
};

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = [
    'https://collektng.xyz',
    'https://collektng.com',
    'https://main--collektnew.netlify.app',
    'https://collektnew.netlify.app',
    'http://localhost:8888',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://collektng.xyz';

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const prompt = (body.prompt || body.query || '').trim();
    const action = body.action || body.skill || 'chat';
    const context = body.context || '';
    const user = body.user || null;

    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing prompt' }) };
    }
    if (prompt.length > 5000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt exceeds maximum limit of 5000 characters' }) };
    }

    // Use caller-provided Gemini API key if present, otherwise platform key
    const apiKey = (body.apiKey && String(body.apiKey).startsWith('AIza')) 
      ? body.apiKey.trim() 
      : process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI key not configured' }) };
    }

    // Build specialized system prompt
    let systemInstruction = SKILL_INSTRUCTIONS[action] || 
      'You are Kolly, the AI Assistant for Collekt (an energy talent, EPC marketplace, and secure escrow platform in Nigeria). Provide concise, professional, actionable assistance formatted in clean Markdown.';

    if (context) {
      systemInstruction += `\nAdditional Context: ${context}`;
    }
    if (user && user.name) {
      systemInstruction += `\nActive User: ${user.name} (${user.role || 'member'}).`;
    }

    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemInstruction}\n\nUser Request: ${prompt}`
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
            reject(new Error(`Gemini returned non-JSON: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (aiRes.statusCode < 200 || aiRes.statusCode >= 300) {
      console.error('Gemini API error:', aiRes.statusCode, aiRes.body);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: aiRes.body?.error?.message || 'AI service unavailable' })
      };
    }

    const replyText = aiRes.body.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    // Return unified fields to support both app.js and collekt-ai.js callers
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: replyText,
        response: replyText,
        skill: action,
        status: 'success'
      })
    };

  } catch (err) {
    console.error('AI copilot handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
