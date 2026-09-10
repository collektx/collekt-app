/**
 * COLLEKT GEMINI AI SERVERLESS GATEWAY (api/gemini.js)
 * Powers "Kolly AI" across Collekt for:
 * 1. Interactive Platform Chat (Kolly Persona)
 * 2. Company ↔ Professional Talent Matching
 * 3. Company RFP & Tender Scope Drafting
 * 4. Candidate Technical Proposal Pitch Generation
 */

const https = require('https');

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42TGROWnk5OHFsNUs3ZmlxWVZRTjV0RkFlc2xrUUNlYWdiQlBtV2pITXVWRkE=', 'base64').toString('utf8');

const KOLLY_SYSTEM_PROMPT = `
You are Kolly 🦖, the official intelligent AI Copilot and Mascot for Collekt (collekt.ng).
Collekt is Nigeria's premier engineering, procurement, and talent marketplace connecting verified corporate employers in energy, oil & gas, EPC, and infrastructure with licensed professional specialists (engineers, project managers, HSE officers, subsea specialists, welders, geologists).

Key Platform Facts to Know:
- Currency: Nigerian Naira (NGN, ₦)
- Escrow & Wallets: Powered by Paystack dedicated virtual accounts and NOVA Bank settlements. Escrow protects both client and contractor.
- Verification: Shield Verified Badge 🛡️ awarded for CAC corporate registration, FIRS TIN, Director NIN, and COREN/NSE/NUPRC engineering licenses.
- Local Content: Full adherence to the Nigerian Oil & Gas Industry Content Development (NOGICD) Act.

Tone: Professional, technically knowledgeable, concise, encouraging, and tailored to Nigerian industrial operations. Use clear Markdown with bullet points where appropriate.
`;

function callGeminiAPI(apiKey, prompt, systemPrompt = KOLLY_SYSTEM_PROMPT) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('No Gemini API Key available.'));

    const modelsToTry = [
      'models/gemini-2.5-flash',
      'models/gemini-3.6-flash',
      'models/gemini-flash-latest',
      'models/gemini-1.5-flash'
    ];

    function tryModel(index) {
      if (index >= modelsToTry.length) {
        return reject(new Error('All Gemini models exhausted.'));
      }

      const model = modelsToTry[index];
      const postData = JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nTask:\n${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024
        }
      });

      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode === 200 && json.candidates && json.candidates[0]?.content?.parts[0]?.text) {
              resolve(json.candidates[0].content.parts[0].text);
            } else {
              if (res.statusCode === 404 && index + 1 < modelsToTry.length) {
                return tryModel(index + 1);
              }
              reject(new Error(json.error?.message || `Gemini error HTTP ${res.statusCode}: ${body}`));
            }
          } catch(e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    }

    tryModel(0);
  });
}

function localMatchTalent(job, candidates) {
  const reqSkills = (job.skills || []).map(s => String(s).toLowerCase().trim());
  const jobTitle = String(job.title || '').toLowerCase();
  const jobCat = String(job.category || '').toLowerCase();
  const jobLoc = String(job.location || '').toLowerCase();

  return candidates.map(c => {
    let score = 50;
    const cSkills = (c.skills || []).map(s => String(s).toLowerCase().trim());
    const cTitle = String(c.title || c.headline || '').toLowerCase();
    const cLoc = String(c.location || c.state || '').toLowerCase();

    let matchedSkills = [];
    reqSkills.forEach(rs => {
      if (cSkills.some(cs => cs.includes(rs) || rs.includes(cs))) {
        score += 12;
        matchedSkills.push(rs);
      }
    });

    if (jobTitle.split(' ').some(w => w.length > 3 && cTitle.includes(w))) score += 15;
    if (jobCat && cTitle.includes(jobCat)) score += 10;
    if (c.verified || c.is_verified || c.identity_verified) score += 10;
    if (jobLoc && cLoc && (jobLoc.includes(cLoc) || cLoc.includes(jobLoc))) score += 8;

    const finalScore = Math.min(98, Math.max(45, score));
    const reasons = [];
    if (matchedSkills.length > 0) reasons.push(`Matches skills: ${matchedSkills.slice(0, 3).join(', ')}`);
    if (c.verified) reasons.push('Shield Verified with approved credentials 🛡️');
    if (jobLoc && cLoc.includes(jobLoc)) reasons.push(`Proximity: Based in ${c.location}`);
    if (!reasons.length) reasons.push('Strong general engineering discipline overlap');

    return {
      candidate_id: c.id,
      candidate_name: c.name || c.full_name || 'Candidate',
      candidate_title: c.title || 'Specialist',
      avatar: c.avatar_url || '',
      verified: !!c.verified,
      match_score: finalScore,
      match_reason: reasons.join(' • ')
    };
  }).sort((a, b) => b.match_score - a.match_score);
}

function localDraftJobScope(prompt, user) {
  return {
    title: prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt,
    category: 'EPC & Engineering',
    opportunity_type: 'Short-Term Job',
    experience_level: 'Senior Specialist (8-14 Years)',
    location: 'Lagos & Niger Delta, Nigeria',
    duration: '6 Months (Milestone-based)',
    budget_suggested: 15000000,
    skills_required: ['Process Engineering', 'HAZOP Analysis', 'NDT Inspection', 'Safety Compliance', 'COREN Licensed'],
    scope_of_work: `1. PROJECT OBJECTIVE:\nExecute full technical scope for ${prompt}, ensuring compliance with NUPRC, NOGICD, and COREN engineering codes.\n\n2. KEY DELIVERABLES:\n- Initial Site & Feasibility Survey Report\n- Approved Detailed Engineering Design & As-Built Schematics\n- Quality Assurance & NDT Testing Certification\n- Final Handover Dossier & Operations Manual\n\n3. COMPLIANCE & SAFETY:\nAll personnel must hold valid BOSIET/HUET (if offshore) and current professional registration. Zero tolerance for HSE infractions.`
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, prompt, job, candidates, user, apiKey } = req.body || {};
    const keyToUse = apiKey || DEFAULT_GEMINI_KEY;

    switch (action) {
      case 'match_talent': {
        if (!job || !Array.isArray(candidates)) {
          return res.status(400).json({ error: 'Missing job or candidates array' });
        }
        try {
          const geminiPrompt = `
You are Kolly AI Matchmaker. Evaluate these candidates for this job and return ONLY a valid JSON array of objects with keys: "candidate_id", "match_score" (number 0-100), "match_reason" (string under 25 words).
Job: ${JSON.stringify(job)}
Candidates: ${JSON.stringify(candidates.map(c => ({ id: c.id, name: c.name, title: c.title, skills: c.skills, location: c.location, verified: c.verified })))}
`;
          const rawResponse = await callGeminiAPI(keyToUse, geminiPrompt, 'Return strictly raw JSON array.');
          const cleanJson = rawResponse.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return res.status(200).json({ success: true, source: 'gemini', matches: parsed });
        } catch(err) {
          const localMatches = localMatchTalent(job, candidates);
          return res.status(200).json({ success: true, source: 'kolly_engine', matches: localMatches });
        }
      }

      case 'draft_job': {
        try {
          const geminiPrompt = `
Generate a structured engineering tender scope for: "${prompt}".
Include: Suggested Title, Category, Experience Level, Suggested Budget in NGN, Required Skills (comma separated), and Scope of Work (Deliverables, Objectives, Safety).
`;
          const text = await callGeminiAPI(keyToUse, geminiPrompt);
          return res.status(200).json({ success: true, source: 'gemini', draft: text });
        } catch(err) {
          const localDraft = localDraftJobScope(prompt, user);
          return res.status(200).json({ success: true, source: 'kolly_engine', draft: localDraft.scope_of_work, metadata: localDraft });
        }
      }

      case 'generate_pitch': {
        try {
          const geminiPrompt = `
Write a high-converting, 3-paragraph technical proposal pitch for candidate "${user?.name || 'Candidate'}" applying for tender: "${job?.title || prompt}".
Job Scope: ${job?.description || 'General EPC execution'}
Candidate Skills: ${(user?.skills || ['Engineering']).join(', ')}
Requirements: Under 160 words, professional, covers milestone deliverables and safety.
`;
          const pitch = await callGeminiAPI(keyToUse, geminiPrompt);
          return res.status(200).json({ success: true, source: 'gemini', pitch });
        } catch(err) {
          const candidateName = user?.name || 'Specialist';
          const fallbackPitch = `Dear Hiring Enterprise,\n\nI am writing to formally submit my technical proposal for ${job?.title || 'this project'}. With proven competency in ${(user?.skills || ['Engineering']).slice(0, 3).join(', ')} and extensive experience across Nigerian EPC energy projects, I am prepared to deliver on all milestone objectives.\n\nOur execution methodology prioritizes rigorous NUPRC and COREN engineering safety codes, ensuring zero-defect deliverables within your proposed schedule. I look forward to discussing technical alignment.\n\nSincerely,\n${candidateName}`;
          return res.status(200).json({ success: true, source: 'kolly_engine', pitch: fallbackPitch });
        }
      }

      case 'chat':
      default: {
        try {
          const response = await callGeminiAPI(keyToUse, prompt || 'Hello Kolly');
          return res.status(200).json({ success: true, source: 'gemini', response });
        } catch(err) {
          return res.status(200).json({
            success: true,
            source: 'kolly_engine',
            response: `✨ **Kolly AI Assistant**:\n\nHello! I am **Kolly**, your Collekt Mascot & AI Copilot 🦖.\n\nRegarding: "*${prompt}*"\n\n• **Talent & Tenders**: Collekt enables licensed engineers and corporate enterprises to connect across Nigeria and Africa.\n• **Shield Verification**: Submit your CAC, TIN, and NIN under Profile to earn the verified badge 🛡️.\n• **Escrow & Funding**: Fund your wallet instantly via Paystack bank transfer or NOVA commercial settlements.\n\nNeed technical assistance or candidate matching? Ask me anything!`
          });
        }
      }
    }
  } catch(error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
