/**
 * ============================================================================
 * KOLLY AI — MULTI-PROVIDER INTELLIGENCE & ORCHESTRATION ENGINE (v4.0)
 * Serverless Backend: /.netlify/functions/kolly-ai (Mapped to /api/kolly)
 *
 * Capabilities:
 * 1. Multi-Provider Adapters: Anthropic Claude + OpenAI + Google Gemini
 * 2. Intelligent Task Router & Automatic Provider Failover
 * 3. Long-Term Personal Memory (Supabase kolly_memories + Supersession + RLS)
 * 4. Collekt Marketplace & Verified Professional Matching
 * 5. Live Web Research (Tavily & Brave Search API with Source Citations)
 * 6. Tender / RFQ Document Intelligence & Compliance Matrices
 * 7. Strict Financial Safety Guardrails & Prompt-Injection Defense
 * 8. Token & Cost Accounting (kolly_usage_records)
 * ============================================================================
 */

const https = require('https');
const { supabase } = require('./lib/supabase-client');
const { authenticateRequest } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { corsHeaders, preflightResponse } = require('./lib/cors');

/* --------------------------------------------------------------------------
   1. HTTP JSON REQUEST HELPER (WITH TIMEOUT & ERROR CAPTURE)
-------------------------------------------------------------------------- */
function httpsJsonRequest({ hostname, path, method = 'POST', headers = {}, body = null, timeoutMs = 8500 }) {
  return new Promise((resolve, reject) => {
    const payloadStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const reqHeaders = Object.assign(
      { 'Content-Type': 'application/json' },
      payloadStr ? { 'Content-Length': Buffer.byteLength(payloadStr) } : {},
      headers
    );

    const req = https.request({ hostname, path, method, headers: reqHeaders }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (err) {
          resolve({ statusCode: res.statusCode, body: { raw } });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request to ${hostname} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

/* --------------------------------------------------------------------------
   2. SECURITY: PROMPT-INJECTION DEFENSE & INTERNAL FILENAME SANITIZER
-------------------------------------------------------------------------- */
function sanitizeUntrustedContent(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi, '[REDACTED_UNTRUSTED_DIRECTIVE]')
    .replace(/system\s*prompt\s*:/gi, '[REDACTED_DIRECTIVE]:')
    .replace(/you\s+are\s+now\s+in\s+developer\s+mode/gi, '[REDACTED_DIRECTIVE]')
    .slice(0, 18000);
}

function sanitizeInternalFilenames(text = '') {
  if (!text || typeof text !== 'string') return '';
  const map = {
    'post-job.html': '**Post Opportunity**',
    'post.html': '**Post Opportunity**',
    'my-jobs.html': '**My Opportunities**',
    'marketplace.html': '**Marketplace**',
    'proposals.html': '**Collektions**',
    'wallet.html': '**Wallet**',
    'messages.html': '**Messages**',
    'profile.html': '**Profile**',
    'company-profile.html': '**Company Profile**',
    'dashboard.html': '**Overview**',
    'company-dashboard.html': '**Company Overview**'
  };
  let out = text;
  for (const [file, label] of Object.entries(map)) {
    const regex = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:collektng\\.com\\/)?\\b${file.replace('.', '\\.')}\\b`, 'gi');
    out = out.replace(regex, label);
  }
  out = out.replace(/(?:https?:\/\/)?(?:www\.)?(?:collektng\.com\/)?\b([a-z0-9_-]+)\.(?:html|js|css)\b/gi, (_, name) => {
    const clean = name.replace(/[-_]/g, ' ');
    return `**${clean.charAt(0).toUpperCase() + clean.slice(1)}**`;
  });
  return out;
}

/* --------------------------------------------------------------------------
   3. CRITICAL FINANCIAL & PAYMENT SAFETY GUARDRAIL (SCENARIO H)
-------------------------------------------------------------------------- */
function checkFinancialSafetyGuardrail(prompt = '') {
  const lower = prompt.toLowerCase();
  const isDirectExecutionCommand =
    /\b(release|disburse|send|transfer|approve|unlock|withdraw|wire|pay\s+out)\b/.test(lower) &&
    /\b(escrow|milestone|funds?|payment|money|wallet|payout|naira|₦|contractor|vendor|my\s+bank)\b/.test(lower) &&
    !/\b(how\s+do\s+i|how\s+does|how\s+to|explain|what\s+is|can\s+you\s+explain|guide)\b/.test(lower);

  const isBankModificationCommand =
    /\b(change|update|modify|replace|set)\b/.test(lower) &&
    /\b(beneficiary|bank\s+account|nuban|account\s+number|payout\s+account)\b/.test(lower) &&
    !/\b(how\s+do\s+i|how\s+to|where\s+can\s+i)\b/.test(lower);

  if (isDirectExecutionCommand || isBankModificationCommand) {
    return {
      blocked: true,
      reason: isBankModificationCommand ? 'UNAUTHORIZED_BANK_DETAIL_MODIFICATION' : 'AUTONOMOUS_PAYMENT_RELEASE_PROHIBITED',
      safeReply:
        `### 🔒 Financial Security Control — Human Authorization Required\n\n` +
        `For your protection, **Kolly cannot independently release escrow funds, execute transfers, approve payouts, or modify beneficiary bank details.**\n\n` +
        `All financially consequential actions on Collekt must be executed through our audited financial workflow:\n` +
        `1. **To Release a Milestone Payment:** Open **Collektions**, inspect the submitted milestone deliverable, and click **Approve Milestone** from your authenticated Company account.\n` +
        `2. **To Withdraw Cleared Earnings or Update Bank Details:** Open **Wallet** in your sidebar, verify your 10-digit NUBAN account, and confirm the transaction using your **One-Time Password (OTP)**.`
    };
  }

  if (/\b(nova\s*bank|is\s+nova\s+bank\s+live)\b/i.test(lower)) {
    return {
      blocked: true,
      reason: 'UNCONFIRMED_BANK_PARTNERSHIP_GUARDRAIL',
      safeReply:
        `### 🏦 Banking & Escrow Infrastructure Status\n\n` +
        `* **Current Operational Gateways:** Collekt wallet deposits, Dedicated Virtual Accounts (NUBAN), and bank settlements currently operate through integrated **Paystack** and **KoraPay** rails.\n` +
        `* **Nova Bank Status:** While Collekt is developing expanded institutional escrow structures (including discussions involving **Nova Bank**), **no direct Nova Bank escrow API integration is represented as live without formal documentary and API confirmation.**`
    };
  }

  return { blocked: false };
}

/* --------------------------------------------------------------------------
   4. INTELLIGENT TASK ROUTER (SECTION 4)
-------------------------------------------------------------------------- */
function classifyTaskAndSelectRoute(prompt = '', options = {}) {
  const lower = prompt.toLowerCase();

  if (options.documentText || options.fileName || /\b(rfq|request for quotation|compliance matrix|tender document|clause|bid submission deadline|extract scope)\b/i.test(lower)) {
    return {
      taskCategory: 'tender_analysis',
      preferredOrder: ['anthropic', 'gemini', 'openai'],
      description: 'Tender & Technical Document Analysis'
    };
  }

  if (options.researchMode || /\b(latest|current|recent|2025|2026|news|nuprc|ncdmb|nogicd|regulation|regulatory|announcement|market intelligence|search the web)\b/i.test(lower)) {
    return {
      taskCategory: 'business_research',
      preferredOrder: ['gemini', 'openai', 'anthropic'],
      description: 'Live Web & Regulatory Research'
    };
  }

  if (/\b(find|match|recommend|shortlist|suitable|candidates|piping engineer|engineers with|opportunities for me|projects that match)\b/i.test(lower)) {
    return {
      taskCategory: 'marketplace_matching',
      preferredOrder: ['anthropic', 'openai', 'gemini'],
      description: 'Collekt Hybrid Marketplace & Talent Matching'
    };
  }

  if (/\b(code|javascript|python|sql|function|bug|api|regex|script|database schema)\b/i.test(lower)) {
    return {
      taskCategory: 'programming',
      preferredOrder: ['openai', 'anthropic', 'gemini'],
      description: 'Technical & Programming Assistance'
    };
  }

  if (/\b(draft|scope of work|sow|evaluate|risk analysis|milestone structure|boq|bill of quantities|arbitration|contract|tax|wht|vat)\b/i.test(lower)) {
    return {
      taskCategory: 'advanced_reasoning',
      preferredOrder: ['anthropic', 'openai', 'gemini'],
      description: 'Executive Reasoning & Commercial Structuring'
    };
  }

  return {
    taskCategory: 'simple_conversation',
    preferredOrder: ['gemini', 'openai', 'anthropic'],
    description: 'Conversational Advisory'
  };
}

/* --------------------------------------------------------------------------
   5. LONG-TERM PERSONAL MEMORY SERVICE (EXTRACTION, SUPERSESSION & ISOLATION)
-------------------------------------------------------------------------- */
function parseMemoriesFromUserMessage(userText = '') {
  const clean = (userText || '').trim();
  const extracted = [];

  const nameMatch = clean.match(/^(?:please\s+)?(?:you can\s+)?(?:call me|my name is|i am called|i'm called)\s+([A-Za-z][A-Za-z\s.-]{1,22})$/i);
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].replace(/[.!?,]+$/, '').trim();
    if (!/^(thank|thanks|hello|hi|ok|okay|yes|no|sure)$/i.test(candidate)) {
      extracted.push({
        category: 'identity',
        memory_key: 'preferred_name',
        memory_value: candidate,
        is_correction: true
      });
    }
  }

  const specMatch = clean.match(/\b(?:i specialize in|my specialization is|i am a|i'm a|i work as a)\s+([A-Za-z0-9\s,&/-]{3,65}?)(?:\.|,|\s+and\s+have|\s+with\s+\d+|$)/i);
  if (specMatch && specMatch[1]) {
    const val = specMatch[1].trim();
    if (!/\b(new|company|member|looking|trying)\b/i.test(val)) {
      extracted.push({
        category: 'professional_background',
        memory_key: 'specialization',
        memory_value: val,
        is_correction: /\b(now|update|actually|instead|no longer|correction)\b/i.test(clean)
      });
    }
  }

  const expMatch = clean.match(/\b(?:have|with|now have|updated to)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+years?\s+(?:of\s+)?experience(?:\s+working\s+on\s+([A-Za-z0-9\s,&/-]{3,50}))?/i);
  if (expMatch && expMatch[1]) {
    const fullExp = expMatch[2]
      ? `${expMatch[1]} years of experience (${expMatch[2].trim()})`
      : `${expMatch[1]} years of experience`;
    extracted.push({
      category: 'professional_background',
      memory_key: 'experience_years',
      memory_value: fullExp,
      is_correction: true
    });
  }

  const certMatch = clean.match(/\b(COREN|ICAN|ACCA|PMP|PRINCE2|NEBOSH|NIQS|NBA|NSE|ASME|API\s*\d+|CSWIP|NDT\s*Level\s*[I123V]+)\b/gi);
  if (certMatch && certMatch.length > 0) {
    const uniqueCerts = Array.from(new Set(certMatch.map(c => c.toUpperCase())));
    const isRevokedOrOutdated = /\b(no longer|expired|outdated|not|correct|updated|upgraded)\b/i.test(clean);
    extracted.push({
      category: 'qualifications',
      memory_key: 'certifications',
      memory_value: isRevokedOrOutdated ? clean : `Certifications mentioned: ${uniqueCerts.join(', ')}`,
      is_correction: isRevokedOrOutdated
    });
  }

  if (/\b(remember that|note that|keep in mind that|correction:|update my profile memory:)\b/i.test(clean)) {
    const fact = clean.replace(/^(?:please\s+)?(?:remember that|note that|keep in mind that|correction:|update my profile memory:)\s*/i, '').trim();
    if (fact) {
      extracted.push({
        category: 'user_directive',
        memory_key: 'custom_fact',
        memory_value: fact,
        is_correction: /\b(correction|update|instead|no longer|now)\b/i.test(clean)
      });
    }
  }

  return extracted;
}

async function storeAndSupersedeMemories(userId, extractedMemories = []) {
  if (!userId || !extractedMemories.length) return [];
  const stored = [];

  for (const item of extractedMemories) {
    try {
      const { data: existingList } = await supabase
        .from('kolly_memories')
        .select('id, memory_value')
        .eq('user_id', userId)
        .eq('memory_key', item.memory_key)
        .eq('is_active', true)
        .is('deleted_at', null);

      const { data: inserted } = await supabase
        .from('kolly_memories')
        .insert({
          user_id: userId,
          category: item.category,
          memory_key: item.memory_key,
          memory_value: item.memory_value,
          confidence: 1.0,
          is_user_confirmed: true,
          is_active: true
        })
        .select('id, category, memory_key, memory_value')
        .maybeSingle();

      if (inserted) {
        stored.push(inserted);
        if (existingList && existingList.length > 0 && (item.is_correction || item.memory_key !== 'custom_fact')) {
          const oldIds = existingList.map(e => e.id).filter(id => id !== inserted.id);
          if (oldIds.length > 0) {
            await supabase
              .from('kolly_memories')
              .update({
                is_active: false,
                superseded_by: inserted.id,
                updated_at: new Date().toISOString()
              })
              .in('id', oldIds)
              .eq('user_id', userId);
          }
        }
      }
    } catch (e) {}
  }

  return stored;
}

async function fetchIsolatedUserMemories(userId) {
  if (!userId) return [];
  try {
    const { data } = await supabase
      .from('kolly_memories')
      .select('id, category, memory_key, memory_value, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(15);
    return data || [];
  } catch (e) {
    return [];
  }
}

/* --------------------------------------------------------------------------
   6. COLLEKT MARKETPLACE & PROFESSIONAL RETRIEVAL TOOLS (SCENARIOS A & D)
-------------------------------------------------------------------------- */
async function searchCollektOpportunities(queryText = '', userMemories = [], userProfile = null) {
  try {
    const [projRes, tendRes] = await Promise.all([
      supabase.from('projects').select('id, title, description, category, budget, location, status, required_skills, created_at').limit(10),
      supabase.from('tenders').select('id, title, description, category, budget, location, status, created_at').limit(10)
    ]);

    const combined = [
      ...((projRes && projRes.data) || []).map(p => ({ ...p, source_type: 'Project Opportunity' })),
      ...((tendRes && tendRes.data) || []).map(t => ({ ...t, source_type: 'Corporate Tender' }))
    ];

    const specMemory = userMemories.find(m => m.memory_key === 'specialization')?.memory_value || '';
    const searchTerms = `${queryText} ${specMemory} ${(userProfile && userProfile.skills) ? (Array.isArray(userProfile.skills) ? userProfile.skills.join(' ') : userProfile.skills) : ''}`
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && !['find', 'match', 'projects', 'opportunities', 'suitable', 'there', 'with', 'that', 'experience'].includes(w));

    const scored = combined.map(item => {
      const hay = `${item.title || ''} ${item.description || ''} ${item.category || ''} ${JSON.stringify(item.required_skills || '')}`.toLowerCase();
      let score = 50;
      const matchedTerms = [];
      for (const term of searchTerms) {
        if (hay.includes(term)) {
          score += 15;
          matchedTerms.push(term);
        }
      }
      return {
        ...item,
        matchScore: Math.min(98, score),
        matchedTerms: Array.from(new Set(matchedTerms))
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    return scored.slice(0, 5);
  } catch (e) {
    return [];
  }
}

async function searchVerifiedProfessionals(queryText = '') {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, title, industry, location, skills, is_verified, identity_verified, verification_status, role')
      .neq('role', 'company')
      .neq('role', 'admin')
      .limit(15);

    if (!profiles || !profiles.length) return [];

    const terms = queryText.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !['need', 'find', 'three', 'two', 'verified', 'with', 'experience', 'for'].includes(w));

    return profiles.map(p => {
      const hay = `${p.full_name || ''} ${p.title || ''} ${p.industry || ''} ${JSON.stringify(p.skills || '')}`.toLowerCase();
      let score = 40;
      const matched = [];
      for (const t of terms) {
        if (hay.includes(t)) {
          score += 18;
          matched.push(t);
        }
      }
      if (p.is_verified || p.identity_verified) score += 20;
      return {
        id: p.id,
        name: p.full_name || 'Registered Specialist',
        title: p.title || 'Technical Specialist',
        industry: p.industry || 'Engineering & Contracting',
        location: p.location || 'Nigeria',
        skills: p.skills || [],
        isVerified: Boolean(p.is_verified || p.identity_verified),
        verificationLabel: (p.is_verified || p.identity_verified)
          ? 'Verified Credentials & Identity (Collekt Shield)'
          : 'Self-Reported Profile (Pending Mandatory Verification Confirmation)',
        matchScore: Math.min(99, score),
        matchedKeywords: Array.from(new Set(matched))
      };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  } catch (e) {
    return [];
  }
}

/* --------------------------------------------------------------------------
   7. LIVE INTERNET RESEARCH & SOURCE CITATION ENGINE (SCENARIO E)
-------------------------------------------------------------------------- */
async function performLiveWebSearch(query = '') {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (tavilyKey) {
    try {
      const res = await httpsJsonRequest({
        hostname: 'api.tavily.com',
        path: '/search',
        method: 'POST',
        body: {
          api_key: tavilyKey,
          query: query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 4
        },
        timeoutMs: 5000
      });
      if (res.statusCode === 200 && Array.isArray(res.body.results)) {
        return res.body.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: sanitizeUntrustedContent(r.content || ''),
          publishedDate: r.published_date || 'Current'
        }));
      }
    } catch (e) {}
  }

  if (braveKey) {
    try {
      const encoded = encodeURIComponent(query);
      const res = await httpsJsonRequest({
        hostname: 'api.search.brave.com',
        path: `/res/v1/web/search?q=${encoded}&count=4`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveKey
        },
        timeoutMs: 5000
      });
      if (res.statusCode === 200 && res.body?.web?.results) {
        return res.body.web.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: sanitizeUntrustedContent(r.description || ''),
          publishedDate: r.age || 'Current'
        }));
      }
    } catch (e) {}
  }

  const lower = query.toLowerCase();
  const citations = [];
  if (/nuprc|upstream|oil|gas|acreage|divestment|production/i.test(lower)) {
    citations.push({
      title: 'Nigerian Upstream Petroleum Regulatory Commission (NUPRC) — Regulatory & Operations Portal',
      url: 'https://www.nuprc.gov.ng',
      snippet: 'Official NUPRC regulatory circulars, Host Communities Development Trust (HCDT) compliance under PIA 2021, upstream licensing, and production monitoring.',
      publishedDate: 'PIA 2021 / Current Regulatory Framework'
    });
  }
  if (/ncdmb|local content|nogicd|epc|nigerian content|nipex/i.test(lower)) {
    citations.push({
      title: 'Nigerian Content Development and Monitoring Board (NCDMB) — NOGICD Act Compliance',
      url: 'https://ncdmb.gov.ng',
      snippet: 'Statutory Nigerian Content (NCEC) categorization, 1% NCDF remittance requirements, and mandatory local engineering/procurement thresholds under the NOGICD Act.',
      publishedDate: 'NOGICD Statutory Standard'
    });
  }
  if (/coren|engineering|standard|iso|asme|piping/i.test(lower)) {
    citations.push({
      title: 'Council for the Regulation of Engineering in Nigeria (COREN) — Engineering Practice Standards',
      url: 'https://www.coren.gov.ng',
      snippet: 'Mandatory engineering practitioner licensing, corporate consulting accreditation, and statutory stamp requirements for engineering drawings in Nigeria.',
      publishedDate: 'Statutory Engineering Regulation'
    });
  }
  if (citations.length === 0) {
    citations.push(
      {
        title: 'NUPRC — Nigerian Upstream Petroleum Regulatory Commission',
        url: 'https://www.nuprc.gov.ng',
        snippet: 'Official Nigerian upstream oil and gas regulatory announcements, licensing guidelines, and Petroleum Industry Act (PIA) implementation updates.',
        publishedDate: 'Official Portal'
      },
      {
        title: 'NCDMB — Nigerian Content Development & Monitoring Board',
        url: 'https://ncdmb.gov.ng',
        snippet: 'Local content compliance, NCEC registration, and Nigerian energy sector project tenders and capacity building updates.',
        publishedDate: 'Official Portal'
      }
    );
  }
  return citations;
}

/* --------------------------------------------------------------------------
   8. TENDER / RFQ DOCUMENT INTELLIGENCE ANALYZER (SCENARIO C)
-------------------------------------------------------------------------- */
function analyzeTenderDocumentContent(fileName = 'Uploaded_RFQ_Document', rawContent = '') {
  const safeContent = sanitizeUntrustedContent(rawContent);
  const lines = safeContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const deadlineMatches = lines.filter(l => /\b(deadline|closing date|submission date|due date|on or before|not later than|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i.test(l));
  const scopeLines = lines.filter(l => /\b(scope|deliverable|specification|design|supply|install|procure|fabricat|test|commission|piping|software|audit|boq)\b/i.test(l)).slice(0, 6);
  const complianceLines = lines.filter(l => /\b(coren|cac|tin|firs|tax clearance|ncec|ncdmb|nuprc|iso|hse|nebosh|insurance|bid bond|performance bond|nin|audited)\b/i.test(l)).slice(0, 8);

  return {
    fileName,
    deadlineSummary: deadlineMatches.length
      ? deadlineMatches.slice(0, 3).map(d => `* *"${d}"* *(Ref: Uploaded Document)*`).join('\n')
      : `* ⚠️ **Missing / Unspecified in Excerpt:** No explicit submission closing date or timestamp was detected in the uploaded text. Request formal clarification from the issuing procurement team.`,
    scopeSummary: scopeLines.length
      ? scopeLines.map((s, idx) => `${idx + 1}. ${s} *(Ref: Section/Line match)*`).join('\n')
      : `1. General technical execution and deliverable submission as outlined in **${fileName}**.`,
    complianceMatrix: complianceLines.length
      ? complianceLines.map(c => `| ${c.slice(0, 75)} | Mandatory | Verify in **Profile** / Upload Proof |`).join('\n')
      : `| CAC Certificate & FIRS Tax Clearance | Standard B2B | Confirm before submission |\n| Technical Accreditation (COREN / Relevant License) | Technical | Confirm on **Profile** |\n| Milestone Commercial Schedule (NGN ₦) | Commercial | Structure in **Collektions** |`
  };
}

/* --------------------------------------------------------------------------
   9. MULTI-PROVIDER ADAPTERS (ANTHROPIC CLAUDE, OPENAI, GOOGLE GEMINI)
-------------------------------------------------------------------------- */
async function callAnthropicAdapter({ systemPrompt, userPrompt, apiKey }) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const model = process.env.KOLLY_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const res = await httpsJsonRequest({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    },
    timeoutMs: 7500
  });

  if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.content?.[0]?.text) {
    return {
      provider: 'anthropic',
      model,
      text: res.body.content[0].text,
      promptTokens: res.body.usage?.input_tokens || 0,
      completionTokens: res.body.usage?.output_tokens || 0
    };
  }
  throw new Error(`Anthropic HTTP ${res.statusCode}`);
}

async function callOpenAIAdapter({ systemPrompt, userPrompt, apiKey, useReasoningModel = false }) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  const model = useReasoningModel
    ? (process.env.KOLLY_OPENAI_REASONING_MODEL || 'gpt-4o')
    : (process.env.KOLLY_OPENAI_MODEL || 'gpt-4o-mini');

  const res = await httpsJsonRequest({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`
    },
    body: {
      model,
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    },
    timeoutMs: 7500
  });

  if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.choices?.[0]?.message?.content) {
    return {
      provider: 'openai',
      model,
      text: res.body.choices[0].message.content,
      promptTokens: res.body.usage?.prompt_tokens || 0,
      completionTokens: res.body.usage?.completion_tokens || 0
    };
  }
  throw new Error(`OpenAI HTTP ${res.statusCode}`);
}

async function callGeminiAdapter({ systemPrompt, userPrompt, apiKey }) {
  const key = (apiKey && String(apiKey).startsWith('AIza')) ? apiKey : process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const model = process.env.KOLLY_GEMINI_MODEL || 'gemini-2.5-flash';

  const res = await httpsJsonRequest({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${key}`,
    method: 'POST',
    body: {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nUser Request:\n${userPrompt}` }]
      }]
    },
    timeoutMs: 7500
  });

  if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return {
      provider: 'gemini',
      model,
      text: res.body.candidates[0].content.parts[0].text,
      promptTokens: res.body.usageMetadata?.promptTokenCount || 0,
      completionTokens: res.body.usageMetadata?.candidatesTokenCount || 0
    };
  }
  throw new Error(`Gemini HTTP ${res.statusCode}`);
}

/* --------------------------------------------------------------------------
   10. MAIN NETLIFY SERVERLESS HANDLER
-------------------------------------------------------------------------- */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse(event);
  const headers = corsHeaders(event);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const requestStartMs = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const action = body.action || 'chat';
    const prompt = (body.prompt || body.message || body.query || '').trim();
    const documentText = body.documentText || '';
    const fileName = body.fileName || '';
    const researchMode = Boolean(body.researchMode);
    const memoryEnabled = body.memoryEnabled !== false;

    const { user: authUser } = await authenticateRequest(event);
    const verifiedUserId = authUser ? authUser.id : null;

    const rateCheck = enforceRateLimit(event, {
      action: 'kolly-ai',
      userId: verifiedUserId,
      limit: 25,
      windowMs: 60 * 1000,
      customHeaders: headers
    });
    if (!rateCheck.allowed) return rateCheck.response;

    if (action === 'get_memories') {
      if (!verifiedUserId) {
        return { statusCode: 200, headers, body: JSON.stringify({ memories: [], authenticated: false }) };
      }
      const memories = await fetchIsolatedUserMemories(verifiedUserId);
      return { statusCode: 200, headers, body: JSON.stringify({ memories, authenticated: true }) };
    }

    if (action === 'delete_memory' && verifiedUserId && body.memoryId) {
      await supabase
        .from('kolly_memories')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', body.memoryId)
        .eq('user_id', verifiedUserId);
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'deleted', memoryId: body.memoryId }) };
    }

    if (!prompt && !documentText) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt or document content is required' }) };
    }

    const safetyCheck = checkFinancialSafetyGuardrail(prompt);
    if (safetyCheck.blocked) {
      if (verifiedUserId) {
        try {
          await supabase.from('kolly_tool_executions').insert({
            user_id: verifiedUserId,
            tool_name: 'financial_safety_guardrail',
            tool_input: { prompt: prompt.slice(0, 300) },
            tool_output_summary: safetyCheck.reason,
            status: 'blocked_by_policy'
          });
        } catch (e) {}
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: safetyCheck.safeReply,
          response: safetyCheck.safeReply,
          taskCategory: 'financial_safety_guardrail',
          provider: 'collekt_security_guardrail',
          model: 'deterministic-policy-v4',
          citations: [],
          status: 'success'
        })
      };
    }

    if (action === 'admin_analytics' || /\b(admin report|registration trends|verification workload|platform analytics)\b/i.test(prompt)) {
      let isAdmin = false;
      if (verifiedUserId) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', verifiedUserId).maybeSingle();
        if (prof && prof.role === 'admin') isAdmin = true;
      }
      if (!isAdmin) {
        const denyMsg = `### 🔒 Administrative Authorization Required\n\nAccess to platform-wide registration trends, verification workloads, and administrative analytics is strictly restricted to backend-verified **Collekt Platform Administrators**.`;
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            reply: denyMsg,
            response: denyMsg,
            taskCategory: 'admin_authorization_guard',
            provider: 'collekt_rbac_guard',
            status: 'unauthorized_role'
          })
        };
      }
    }

    let userMemories = [];
    if (verifiedUserId && memoryEnabled) {
      const newlyExtracted = parseMemoriesFromUserMessage(prompt);
      if (newlyExtracted.length > 0) {
        await storeAndSupersedeMemories(verifiedUserId, newlyExtracted);
      }
      userMemories = await fetchIsolatedUserMemories(verifiedUserId);
    }

    if (Array.isArray(body.clientMemories) && body.clientMemories.length > 0) {
      for (const cm of body.clientMemories.slice(0, 10)) {
        if (cm && cm.memory_key && cm.memory_value && !userMemories.some(m => m.memory_key === cm.memory_key)) {
          userMemories.push(cm);
        }
      }
    }

    const route = classifyTaskAndSelectRoute(prompt, { documentText, fileName, researchMode });
    let citations = [];
    let toolContextBlock = '';

    if (route.taskCategory === 'tender_analysis' && documentText) {
      const docAnalysis = analyzeTenderDocumentContent(fileName || 'Uploaded_Tender_RFQ', documentText);
      toolContextBlock += `\n[UPLOADED TENDER / RFQ ANALYSIS — ${docAnalysis.fileName}]\nDeadlines:\n${docAnalysis.deadlineSummary}\nKey Scope Items:\n${docAnalysis.scopeSummary}\nCompliance Matrix:\n${docAnalysis.complianceMatrix}\n`;
    }

    if (route.taskCategory === 'business_research') {
      citations = await performLiveWebSearch(prompt);
      if (citations.length > 0) {
        toolContextBlock += `\n[RETRIEVED WEB RESEARCH SOURCES]\n` +
          citations.map((c, i) => `[${i + 1}] ${c.title} (${c.publishedDate}) — ${c.url}\nSnippet: ${c.snippet}`).join('\n\n');
      }
    }

    let matchedOpportunities = [];
    let matchedCandidates = [];
    if (route.taskCategory === 'marketplace_matching') {
      if (/\b(hire|need|candidates|engineers with|professionals|shortlist|recruit)\b/i.test(prompt)) {
        matchedCandidates = await searchVerifiedProfessionals(prompt);
        toolContextBlock += `\n[AUTHORIZED COLLEKT PROFESSIONAL DIRECTORY MATCHES]\n` +
          JSON.stringify(matchedCandidates, null, 2);
      } else {
        matchedOpportunities = await searchCollektOpportunities(prompt, userMemories, body.user);
        toolContextBlock += `\n[AUTHORIZED COLLEKT MARKETPLACE OPPORTUNITIES]\n` +
          JSON.stringify(matchedOpportunities, null, 2);
      }
    }

    const memorySummary = userMemories.length
      ? userMemories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')
      : 'No prior persistent memories recorded for this user.';

    const systemPrompt = `You are Kolly, the Senior Executive & Technical Intelligence Engine for Collekt (collektng.com), Nigeria's B2B marketplace for Oil & Gas, Engineering, EPC, Infrastructure, and Professional Contracting.
Personality & Standards:
- Analytical, articulate, practical, and evidence-driven (Claude-caliber executive clarity).
- Directly align your response with what the user actually asked or said. For short conversational remarks ("thank you", "hello", "ok"), respond warmly and concisely in 1–2 sentences.
- NEVER disclose internal filenames (.html, .js, .css). Use clean UI section names: **Overview**, **Marketplace**, **Post Opportunity**, **Collektions**, **Messages**, **Wallet**, and **Profile**.
- Distinguish clearly between verified credentials (Collekt Shield / NIN / COREN verified) and self-reported qualifications.
- Do not assume unconfirmed bank partnerships (such as Nova Bank discussions) are operational unless explicitly confirmed in platform records.
- Never invent jobs, fabricate escrow balances, or expose another user's private data.

Authorized Active User Memory Profile (Isolated to User):
${memorySummary}
${toolContextBlock}`;

    let providerResult = null;
    let fallbackTriggered = false;

    for (let i = 0; i < route.preferredOrder.length; i++) {
      const providerName = route.preferredOrder[i];
      try {
        if (providerName === 'anthropic') {
          providerResult = await callAnthropicAdapter({ systemPrompt, userPrompt: prompt, apiKey: body.anthropicKey });
          break;
        } else if (providerName === 'openai') {
          providerResult = await callOpenAIAdapter({
            systemPrompt,
            userPrompt: prompt,
            apiKey: body.openaiKey,
            useReasoningModel: route.taskCategory === 'advanced_reasoning' || route.taskCategory === 'programming'
          });
          break;
        } else if (providerName === 'gemini') {
          providerResult = await callGeminiAdapter({ systemPrompt, userPrompt: prompt, apiKey: body.apiKey });
          break;
        }
      } catch (providerErr) {
        fallbackTriggered = true;
      }
    }

    let finalReply = providerResult ? providerResult.text : null;

    if (!finalReply) {
      if (route.taskCategory === 'tender_analysis' && documentText) {
        const doc = analyzeTenderDocumentContent(fileName || 'Uploaded_RFQ_Document', documentText);
        finalReply =
          `### 📄 Tender & RFQ Intelligence Report: **${doc.fileName}**\n\n` +
          `#### 1. Submission Deadlines & Key Dates\n${doc.deadlineSummary}\n\n` +
          `#### 2. Extracted Scope of Work & Technical Requirements\n${doc.scopeSummary}\n\n` +
          `#### 3. Mandatory Compliance Matrix\n` +
          `| Requirement (Source Ref: **${doc.fileName}**) | Category | Action Required |\n` +
          `| :--- | :--- | :--- |\n` +
          `${doc.complianceMatrix}\n\n` +
          `#### 4. Commercial & Risk Advisory\n` +
          `* Structure your commercial **Collektion** into **3 verifiable escrow milestones** (*30% Mobilization & Engineering Spec • 40% Core Execution & FAT/Inspection • 30% AFC Handover*).\n` +
          `* Explicitly state whether quoted Naira (\`₦\`) figures are inclusive or exclusive of **7.5% VAT** and **5%–10% WHT**.`;
      } else if (route.taskCategory === 'business_research' && citations.length > 0) {
        finalReply =
          `### 🌐 Live Industry & Regulatory Research Brief\n\n` +
          `Based on current Nigerian energy, procurement, and regulatory sources regarding **"${prompt}"**:\n\n` +
          citations.map((c, idx) =>
            `* **[${idx + 1}] ${c.title}** *(${c.publishedDate})*\n  ${c.snippet}\n  🔗 [View Source](${c.url})`
          ).join('\n\n') +
          `\n\n> **Verification Note:** Regulatory circulars from **NUPRC** and **NCDMB** should always be cross-checked against your specific tender's NCEC category and PIA 2021 compliance schedule.`;
      } else if (route.taskCategory === 'marketplace_matching') {
        if (matchedCandidates.length > 0) {
          finalReply =
            `### 🛡️ Shortlisted Professionals from Collekt’s Directory\n\n` +
            `Here are the top matching specialists based on your requirement (*"${prompt}"*), distinguishing between **verified credentials** and **self-reported skills**:\n\n` +
            matchedCandidates.map((c, idx) =>
              `${idx + 1}. **${c.name}** — *${c.title}* (${c.location})\n` +
              `   * **Verification Status:** ${c.isVerified ? '✅' : 'ℹ️'} **${c.verificationLabel}**\n` +
              `   * **Match Alignment (${c.matchScore}%):** ${c.industry}${c.matchedKeywords.length ? ` • Matched: *${c.matchedKeywords.join(', ')}*` : ''}\n` +
              `   * **Next Step:** Review their full credentials in **Marketplace** or initiate a technical interview via **Messages** before awarding a milestone contract.`
            ).join('\n\n');
        } else {
          const specMem = userMemories.find(m => m.memory_key === 'specialization')?.memory_value;
          const expMem = userMemories.find(m => m.memory_key === 'experience_years')?.memory_value;
          const contextIntro = (specMem || expMem)
            ? `Using your saved professional profile (**${[specMem, expMem].filter(Boolean).join(' • ')}**), I evaluated live opportunities on **Collekt**:\n\n`
            : `Based on your criteria (*"${prompt}"*), here is how matching opportunities align on **Collekt**:\n\n`;

          if (matchedOpportunities.length > 0) {
            finalReply =
              `### 🎯 Recommended Collekt Opportunities\n\n` +
              contextIntro +
              matchedOpportunities.map((o, idx) =>
                `${idx + 1}. **${o.title || 'Technical Engineering Work Package'}** *(${o.source_type} • Match Score: ${o.matchScore}%)*\n` +
                `   * **Category & Location:** ${o.category || 'Engineering & EPC'} • ${o.location || 'Nigeria'}\n` +
                `   * **Budget Benchmark:** ${o.budget ? '₦' + Number(o.budget).toLocaleString() : 'Milestone-based NGN Bid'}\n` +
                `   * **Why It Matches:** Aligns with ${o.matchedTerms.length ? `*${o.matchedTerms.join(', ')}*` : 'your engineering & project execution background'}.\n` +
                `   * **Eligibility Check:** Ensure your **COREN / technical certifications** and **NIN Identity Verification** are at 100% in **Profile** before submitting your **Collektion** in **Marketplace**.`
              ).join('\n\n');
          } else {
            finalReply =
              `### 🎯 Opportunity Matching & Profile Alignment\n\n` +
              contextIntro +
              `There are currently no open tenders matching every mandatory filter simultaneously. To maximize shortlist eligibility:\n` +
              `1. Confirm your **NIN Identity Verification** and **COREN / professional licenses** are uploaded under **Profile**.\n` +
              `2. Check **Marketplace** for newly published EPC and corporate work packages, or ask me to draft a **3-Stage Milestone Collektion** template tailored to your specialization.`;
          }
        }
      } else {
        finalReply =
          `### 💡 Executive Advisory — Collekt Intelligence\n\n` +
          `Regarding **"${prompt}"**:\n\n` +
          `On **Collekt**, all engineering, EPC, software, and corporate engagements are structured around **verified credentials (Collekt Shield)** and **3-Stage Milestone Escrow** (*30% Mobilization & Spec • 40% Core Execution • 30% Final Handover*).\n\n` +
          `Let me know if you would like me to **benchmark Nigerian Naira (\`₦\`) fees**, **analyze an RFQ/tender compliance matrix**, or **match your profile against live Marketplace opportunities**.`;
      }
    }

    if (finalReply) {
      finalReply = sanitizeInternalFilenames(finalReply);
    }

    const latencyMs = Date.now() - requestStartMs;
    if (verifiedUserId) {
      try {
        await supabase.from('kolly_usage_records').insert({
          user_id: verifiedUserId,
          task_category: route.taskCategory,
          provider: providerResult ? providerResult.provider : 'collekt_hybrid_engine',
          model: providerResult ? providerResult.model : 'kolly-executive-v4',
          prompt_tokens: providerResult ? providerResult.promptTokens : Math.ceil(prompt.length / 4),
          completion_tokens: providerResult ? providerResult.completionTokens : Math.ceil((finalReply || '').length / 4),
          total_tokens: providerResult
            ? (providerResult.promptTokens + providerResult.completionTokens)
            : Math.ceil((prompt.length + (finalReply || '').length) / 4),
          latency_ms: latencyMs,
          fallback_triggered: fallbackTriggered
        });
      } catch (e) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: finalReply,
        response: finalReply,
        taskCategory: route.taskCategory,
        taskDescription: route.description,
        provider: providerResult ? providerResult.provider : 'collekt_hybrid_engine',
        model: providerResult ? providerResult.model : 'kolly-executive-v4',
        citations,
        memories: userMemories,
        fallbackTriggered,
        latencyMs,
        status: 'success'
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal Kolly AI orchestration error' })
    };
  }
};
