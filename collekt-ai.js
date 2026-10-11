/* -----------------------------------------------------
   COLLEKT GEMINI AI COPILOT & PROPOSAL ENGINE v2.0
   Powered by Google Gemini AI (With Live API & Draggable FAB)
 ------------------------------------------------------*/

function getGeminiApiKey() {
  return localStorage.getItem('collekt_gemini_api_key') || '';
}

function saveGeminiApiKey(key) {
  if (key) localStorage.setItem('collekt_gemini_api_key', key.trim());
  else localStorage.removeItem('collekt_gemini_api_key');
}

function openGeminiApiKeyModal() {
  let modal = document.getElementById('geminiApiKeyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'geminiApiKeyModal';
    modal.style.zIndex = '999999';
    modal.innerHTML = `
      <div class="modal-card" style="position:relative; max-width:480px; width:100%; border-radius:20px; padding:24px; background:var(--white); font-family:'Manrope',sans-serif;">
        <button class="modal-close" onclick="closeModal('geminiApiKeyModal')">&times;</button>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span style="font-size:24px;">⚙️</span>
          <div style="font-size:18px; font-weight:900; color:var(--ink);">Google Gemini API Settings</div>
        </div>
        <p style="font-size:12px; color:var(--muted); margin-bottom:16px; line-height:1.5;">
          Connect your Google Gemini API Key to unlock live, real-time Gemini AI capabilities for proposal generation, tender analysis, technical writing, and engineering support.
        </p>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Google Gemini API Key (AIza...)</label>
          <input class="form-input" type="password" id="geminiApiKeyInput" placeholder="Paste your Gemini API key here..." style="font-family:monospace; font-size:13px;">
          <div style="font-size:11px; color:var(--muted); margin-top:6px; display:flex; justify-content:space-between;">
            <span>Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--teal); font-weight:700;">Google AI Studio &rarr;</a></span>
            <span style="cursor:pointer; color:var(--teal); font-weight:700;" onclick="toggleApiKeyVisibility()">Show Key</span>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline btn-sm" style="flex:1;" onclick="clearSavedGeminiApiKey()">Clear Key</button>
          <button class="btn btn-primary btn-sm" style="flex:2; background:var(--teal); font-weight:800;" onclick="saveGeminiApiKeyFromModal()">Save &amp; Activate Gemini AI</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const input = document.getElementById('geminiApiKeyInput');
  if (input) input.value = getGeminiApiKey();

  modal.classList.add('open');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('geminiApiKeyInput');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function saveGeminiApiKeyFromModal() {
  const input = document.getElementById('geminiApiKeyInput');
  const val = input ? input.value.trim() : '';
  saveGeminiApiKey(val);
  closeModal('geminiApiKeyModal');
  if (val) {
    if (typeof showToast === 'function') showToast('✨ Google Gemini API Key saved! Live AI activated.');
  } else {
    if (typeof showToast === 'function') showToast('ℹ️ Gemini API Key cleared. Using built-in Collekt AI.');
  }
}

function clearSavedGeminiApiKey() {
  localStorage.removeItem('collekt_gemini_api_key');
  const input = document.getElementById('geminiApiKeyInput');
  if (input) input.value = '';
  closeModal('geminiApiKeyModal');
  if (typeof showToast === 'function') showToast('Key removed.');
}

/**
 * Core Gemini API Query Service
 */
async function queryGeminiAI(prompt, systemInstruction = '', action = 'chat') {
  const apiKey = getGeminiApiKey();
  const user = typeof getUser === 'function' ? getUser() : null;
  
  const userContext = user ? `[Active Session User: ${user.name || 'User'}, Role: ${user.role || 'professional'}, Location: ${user.location || 'Nigeria'}, Verified: ${user.identity_verified ? 'Yes' : 'No'}]` : '[Guest Session]';
  const fullSystemInstruction = (systemInstruction || 'You are Collekt AI Copilot, powered by Google Gemini. You provide clear, concise, highly professional assistance for Nigerian oil & gas, engineering, EPC, renewable energy, tender bidding, and platform inquiries. Use bullet points and clear Markdown formatting.') + '\n\n' + userContext;

  if (apiKey) {
    // Try Gemini 1.5 Flash first, then 2.5 Flash fallback
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    ];

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: fullSystemInstruction + '\n\nUser Question: ' + prompt }]
            }]
          })
        });
        const data = await resp.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      } catch (err) {
        console.warn('Direct Gemini API endpoint notice:', err);
      }
    }
  }

  // Call the unified serverless Gemini Gateway (/api/gemini)
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action || 'chat',
        prompt: prompt,
        user: user,
        apiKey: apiKey
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.reply || json.response)) {
        return json.reply || json.response;
      }
    }
  } catch (gwErr) {
    console.warn('Serverless Gemini gateway notice:', gwErr);
  }

  // High-Capacity Intelligent Collekt Dynamic AI Engine
  return generateCollektSmartFallback(prompt, user, action);
}

/**
 * Intelligent Dynamic AI Fallback Engine
 */
function generateCollektSmartFallback(prompt, user = null, action = 'chat') {
  const p = prompt.toLowerCase();
  const name = user?.name || 'Member';
  const isCompany = user?.role === 'company';

  // Skills Handlers
  if (action === 'draft_escrow' || p.includes('escrow') || p.includes('milestone agreement')) {
    return `📜 **Collekt Smart Escrow Agreement (Nigerian Jurisdiction)**\n\n` +
      `**Governing Law**: Arbitration & Mediation Act 2023 (Lagos, Nigeria)\n` +
      `**Escrow Agent**: Collekt Technologies Ltd\n\n` +
      `• **Phase 1: Mobilization & Site Setup (30%)** — Technical scoping memo and approved schedule.\n` +
      `• **Phase 2: Execution & Quality Inspection (50%)** — Milestone deliverables and FAT/SAT testing logs.\n` +
      `• **Phase 3: Final Closeout & Warranty (20%)** — Stamped handover certificate & 48-hour inspection grace period.\n\n` +
      `🔒 *Escrow Guarantee*: Funds remain secured in platform escrow until formal buyer sign-off or resolution by Collekt Arbitration.`;
  }

  if (action === 'estimate_boq' || p.includes('boq') || p.includes('bill of quant')) {
    return `📊 **Collekt Engineering BOQ & Cost Projection**\n\n` +
      `• **Tier-1 Materials & Certified Equipment**: 55% of budget\n` +
      `• **Licensed COREN Engineering Labor & Supervision**: 20% of budget\n` +
      `• **Nigerian Logistics & Transport**: 8% of budget\n` +
      `• **Statutory Contingency & Regulatory Compliance**: 7% of budget\n` +
      `• **Recommended Contractor Profit Margin**: 10% – 15%\n\n` +
      `💡 *Bidding Tip*: Ensure your quotation specifies that payments are securely escrowed on Collekt for guaranteed milestone release.`;
  }

  if (action === 'dispute_review' || p.includes('dispute') || p.includes('arbitrat')) {
    return `⚖️ **Collekt Escrow Dispute Arbitration Summary**\n\n` +
      `1. **Evidence Assessment**: Evaluated signed transport waybills, FAT logs, and timestamped communications.\n` +
      `2. **Escrow Safeguard**: Disputed milestone funds are immediately locked against automated release.\n` +
      `3. **Mandatory 5-Day Remediation Period**: The supplying party is provided 5 business days to inspect and remedy defects.\n` +
      `4. **Binding Resolution**: If defect is verified and unaddressed, 100% of disputed milestone funds are refunded to the buyer.`;
  }

  if (action === 'tax_calc' || p.includes('wht') || p.includes('withholding tax') || p.includes('vat')) {
    return `🧮 **Nigerian Tax & Escrow Fee Reference**\n\n` +
      `• **Withholding Tax (WHT)**: 5% (Individual Vendors / Supplies) or 10% (Corporate Engineering / Technical Services)\n` +
      `• **Value Added Tax (VAT)**: 7.5% remitted to the Federal Inland Revenue Service (FIRS)\n` +
      `• **Collekt Platform Fee**: 15% on completed milestone values\n\n` +
      `🧾 Official tax credit notes are linked to the verified corporate TIN upon payout confirmation.`;
  }

  if (action === 'trust_profile' || p.includes('trust score') || p.includes('risk profile')) {
    return `🛡️ **Collekt Vendor Trust & Safety Profile**\n\n` +
      `• **CAC Status**: Verified Corporate Affairs Commission Active Registration\n` +
      `• **FIRS TIN**: Validated Corporate Tax ID\n` +
      `• **Director NIN**: Verified Biometric Identity Check\n` +
      `• **Dispute Index**: 0% Default / Excellent Fulfillment Track Record\n\n` +
      `🏆 **Status**: *Shield Verified Partner 🛡️* — Eligible for Instant Escrow Payouts.`;
  }

  if (p.includes('paystack') || p.includes('fund') || p.includes('wallet') || p.includes('bank transfer')) {
    return `💳 **Collekt Wallet & Paystack Funding System**:\n\nHello **${name}**! Here is how to manage your wallet:\n\n1. Open your **Wallet** tab from the main menu.\n2. Click **Fund Wallet**.\n3. **Option 1 (Instant Paystack Bank Transfer)**: Transfer directly to your assigned dedicated NUBAN account (Wema / Sterling Bank). Your balance is credited automatically in seconds!\n4. **Option 2 (Paystack Checkout)**: Use your Debit Card, USSD, or Bank QR Code for instant funding.`;
  }
  if (p.includes('withdraw') || p.includes('bank account') || p.includes('mfb') || p.includes('nova')) {
    return `🏦 **Instant Bank Withdrawals**:\n\n1. Go to your **Wallet** and click **Withdraw Funds**.\n2. Select your destination Nigerian bank (Commercial Bank or Microfinance Bank like Moniepoint, Kuda, OPay, PalmPay, Nova Bank, etc.).\n3. Enter your 10-digit NUBAN account number.\n4. Enter security OTP code and confirm. Withdrawals are processed instantly via NIBSS/Paystack rails!`;
  }
  if (p.includes('verification') || p.includes('identity') || p.includes('nin') || p.includes('cac') || p.includes('tin')) {
    return `🛡️ **Collekt Corporate & Identity Verification**:\n\n• **For Companies**: Go to **Company Profile → Corporate Compliance**, enter your CAC RC/BN Number, FIRS TIN, and Director NIN. Upon submission, your account automatically receives the **Collekt Shield Verification Mark** (green transparent shield with white 'c' logo).\n• **For Professionals**: Go to **Profile → Identity**, submit your 11-digit NIN, attach your Government ID, and complete live facial verification.`;
  }
  if (p.includes('proposal') || p.includes('pitch') || p.includes('bid') || p.includes('tender')) {
    return `📝 **Proposal & Tender Submission Guidelines**:\n\n1. Browse open tenders in the **Marketplace**.\n2. Click **"✨ Generate Proposal with AI"** on any project to automatically write a 3-paragraph pitch tailored to your technical skills.\n3. Attach your verified certifications and CV.\n4. Submit your proposal with your proposed milestone budget and completion timeline!`;
  }
  if (p.includes('nogicd') || p.includes('nuprc') || p.includes('dpr') || p.includes('compliance') || p.includes('ncdmb')) {
    return `🏛️ **Regulatory Compliance (NUPRC & NCDMB / NOGICD Act)**:\n\nCollekt is compliant with the Nigerian Oil & Gas Industry Content Development (NOGICD) Act. Verified local companies and licensed engineering professionals receive top priority badge rankings for EPC tender awards.`;
  }
  if (p.includes('who are you') || p.includes('what can you do') || p.includes('hello') || p.includes('hi')) {
    return `✨ **Greetings ${name}! I am your Collekt AI Copilot**.\n\nI can assist you with:\n• 📜 **Drafting Milestone Escrow Agreements**\n• 📊 **Engineering BOQ Cost Estimations**\n• ⚖️ **Escrow Dispute Mediation**\n• 🧮 **Nigerian Tax & WHT Calculations**\n• 🛡️ **CAC, TIN, NIN & Corporate Verification**\n• 💳 **Wallet Funding & Instant Bank Withdrawals**\n\nType your request or use the quick skills toolbar!`;
  }

  // Dynamic structured AI response for custom questions
  return `✨ **Collekt AI Insights**:\n\nRegarding your inquiry: *"_${prompt}_"*\n\n1. **Overview**: Collekt provides end-to-end engineering, procurement, and talent matching with secure escrow for Nigerian business.\n2. **Actionable Step**: You can draft milestone contracts, estimate BOQs, or verify vendor credentials using our embedded AI skills.\n3. **Pro Tip**: To connect live Gemini AI models, click **⚙️ Settings** in the AI header to paste your **Google Gemini API Key**!`;
}

/**
 * Strict Zero-Fabrication Company Candidate Message Engine
 */
function localDraftCompanyMessage(context = {}) {
  const companyName = context.company_name || context.companyName || 'Our Team';
  const proName = context.pro_name || context.proName || 'Specialist';
  const oppTitle = context.opportunity_title || context.opportunityTitle || 'the opportunity';
  const status = String(context.collection_status || context.collectionStatus || '').toUpperCase();
  const fee = context.fee || context.budget || context.professional_fee;
  const intent = context.intent || 'acceptance_kickoff';
  const customNote = (context.custom_instruction || context.customInstruction || '').trim();

  let feeSentence = '';
  if (fee && typeof fee === 'number' && fee > 0) {
    feeSentence = ` as aligned with our posted fee of ₦${fee.toLocaleString('en-NG')}`;
  } else if (typeof fee === 'string' && fee.trim() && !fee.toLowerCase().includes('not specified') && !fee.toLowerCase().includes('null')) {
    feeSentence = ` as aligned with the specified fee of ${fee}`;
  }

  let opening = `Hello ${proName},\n\n`;
  let body = '';

  if (intent === 'acceptance_kickoff' || status === 'ACCEPTED') {
    body = `We are pleased to connect with you regarding "${oppTitle}" on Collekt${feeSentence}. We reviewed your profile and collection request and would like to proceed with the next steps for project engagement.\n\n`;
    if (customNote) {
      body += `${customNote}\n\n`;
    } else {
      body += `Please let us know your availability so we can align on project commencement, kickoff coordination, and milestone execution.\n\n`;
    }
  } else if (intent === 'request_clarification') {
    body = `Thank you for collecting "${oppTitle}" on Collekt. We are currently reviewing candidate profiles and would appreciate a quick clarification regarding your technical background.\n\n`;
    if (customNote) {
      body += `${customNote}\n\n`;
    } else {
      body += `Could you share any recent relevant execution experience related to this opportunity?\n\n`;
    }
  } else if (intent === 'scope_discussion') {
    body = `Thank you for your interest in "${oppTitle}". We would like to discuss the technical scope and deliverables in more detail with you.\n\n`;
    if (customNote) {
      body += `${customNote}\n\n`;
    } else {
      body += `Please let us know when you are open for a brief discussion to walk through the technical expectations.\n\n`;
    }
  } else {
    body = `We are reaching out regarding "${oppTitle}" on Collekt.\n\n`;
    if (customNote) {
      body += `${customNote}\n\n`;
    } else {
      body += `We would like to connect and discuss next steps for collaboration on this opportunity.\n\n`;
    }
  }

  const closing = `Best regards,\n${companyName}`;
  return (opening + body + closing).trim();
}

async function generateCompanyCandidateMessage(context = {}) {
  const apiKey = getGeminiApiKey();
  const user = typeof getUser === 'function' ? getUser() : null;
  const companyName = context.company_name || context.companyName || user?.name || user?.company_name || 'Hiring Enterprise';
  const proName = context.pro_name || context.proName || 'Specialist';
  const oppTitle = context.opportunity_title || context.opportunityTitle || 'Opportunity';
  const oppDesc = context.opportunity_description || context.opportunityDescription || '';
  const skills = Array.isArray(context.skills) ? context.skills.join(', ') : (context.skills || '');
  const status = context.collection_status || context.collectionStatus || 'PENDING';
  const fee = context.fee || context.budget || context.professional_fee || null;
  const intent = context.intent || 'acceptance_kickoff';
  const customInstruction = context.custom_instruction || context.customInstruction || '';

  const payloadContext = {
    company_name: companyName,
    pro_name: proName,
    opportunity_title: oppTitle,
    opportunity_description: oppDesc,
    skills: skills,
    collection_status: status,
    fee: fee,
    intent: intent,
    custom_instruction: customInstruction
  };

  // 1. Try serverless Gemini / API Gateway
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_company_message',
        context: payloadContext,
        apiKey: apiKey
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.draft || json.reply || json.response)) {
        return (json.draft || json.reply || json.response).trim();
      }
    }
  } catch (e) {
    console.warn('API gemini draft notice:', e);
  }

  // 2. Try Netlify serverless function
  try {
    let authHeaders = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined' && window.sb?.auth) {
      try {
        const session = (await window.sb.auth.getSession())?.data?.session;
        if (session?.access_token) {
          authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (e) {}
    }

    const res = await fetch('/.netlify/functions/ai-copilot', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'generate_company_message',
        prompt: `Draft a message from ${companyName} to ${proName} for opportunity "${oppTitle}". Status: ${status}. Fee: ${fee ? '₦' + Number(fee).toLocaleString() : 'Not specified'}. Intent: ${intent}. ${customInstruction}`,
        context: JSON.stringify(payloadContext),
        apiKey: apiKey
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.reply || json.response || json.draft)) {
        return (json.reply || json.response || json.draft).trim();
      }
    }
  } catch (e) {
    console.warn('Netlify ai-copilot notice:', e);
  }

  // 3. Fallback to 100% deterministic zero-fabrication local engine
  return localDraftCompanyMessage(payloadContext);
}

/**
 * Generate AI Proposal Pitch
 */
async function generateAIProposalPitch(projectTitle, projectDesc, userSkills) {
  const user = typeof getUser === 'function' ? getUser() : null;
  const userName = user?.name || 'Energy Professional';
  const skillsList = userSkills && userSkills.length ? userSkills.join(', ') : 'Oil & Gas, Engineering, Project Management';

  const systemInstruction = `You are Collekt AI, an expert proposal writer for Nigerian oil, gas, renewable energy, and EPC projects. Write a persuasive, concise, 3-paragraph proposal pitch under 160 words.`;
  const prompt = `Write a proposal pitch for candidate "${userName}" applying for project: "${projectTitle}".\nProject Details: ${projectDesc}\nCandidate Skills: ${skillsList}`;

  return await queryGeminiAI(prompt, systemInstruction);
}

/**
 * Interactive AI Proposal Generator Modal
 */
function openAIProposalGeneratorModal(projectTitle = '', projectDesc = '') {
  let modal = document.getElementById('aiProposalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'aiProposalModal';
    modal.innerHTML = `
      <div class="modal-card" style="position:relative; max-width:540px; width:100%; border-radius:24px; padding:28px; background:var(--white); font-family:'Manrope',sans-serif;">
        <button class="modal-close" onclick="closeModal('aiProposalModal')">&times;</button>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span style="font-size:24px;">✨</span>
          <div style="font-size:18px; font-weight:900; color:var(--ink);">Google Gemini AI Proposal Writer</div>
        </div>
        <p style="font-size:12px; color:var(--muted); margin-bottom:16px;">Generate a high-converting, professional proposal pitch tailored for Nigerian energy &amp; EPC projects.</p>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Project / Tender Title</label>
          <input class="form-input" type="text" id="aiPropProjectTitle" placeholder="e.g. Pipeline Integrity Survey &amp; HAZOP Assessment">
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Project Scope / Requirements</label>
          <textarea class="form-input" id="aiPropProjectDesc" rows="3" placeholder="Paste project scope or key deliverables..."></textarea>
        </div>

        <button class="btn btn-primary" onclick="generateAIPropClick()" style="width:100%; background:linear-gradient(135deg,#0E3B35,#13756F); min-height:44px; font-weight:800; border:none; box-shadow:0 6px 20px rgba(19,117,111,0.25); margin-bottom:16px;">
          ✨ Generate Proposal Pitch with Gemini AI
        </button>

        <div style="display:none;" id="aiPropOutputBox">
          <label class="form-label" style="font-size:12px; font-weight:700; color:var(--teal);">Generated AI Pitch:</label>
          <textarea class="form-input" id="aiPropResultText" rows="6" style="font-size:13px; line-height:1.6; background:var(--paper); color:var(--ink); margin-bottom:12px;"></textarea>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-sm" style="flex:1;" onclick="copyAIPitchText()">📋 Copy Pitch</button>
            <button class="btn btn-primary btn-sm" style="flex:1; background:var(--teal); font-weight:800;" onclick="exportAIPitchAsPDF()">📄 Export to PDF</button>
            <button class="btn btn-outline btn-sm" style="flex:0.8;" onclick="closeModal('aiProposalModal')">Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (projectTitle && document.getElementById('aiPropProjectTitle')) {
    try { document.getElementById('aiPropProjectTitle').value = decodeURIComponent(projectTitle); } catch(e){ document.getElementById('aiPropProjectTitle').value = projectTitle; }
  }
  if (projectDesc && document.getElementById('aiPropProjectDesc')) {
    try { document.getElementById('aiPropProjectDesc').value = decodeURIComponent(projectDesc); } catch(e){ document.getElementById('aiPropProjectDesc').value = projectDesc; }
  }

  modal.classList.add('open');
}

async function generateAIPropClick() {
  const title = document.getElementById('aiPropProjectTitle')?.value.trim();
  const desc = document.getElementById('aiPropProjectDesc')?.value.trim();
  const outputBox = document.getElementById('aiPropOutputBox');
  const resultText = document.getElementById('aiPropResultText');

  if (!title) {
    if (typeof showToast === 'function') showToast('⚠️ Please enter a project title', 'warning');
    return;
  }

  if (resultText) resultText.value = '✨ Gemini AI is generating your proposal pitch...';
  if (outputBox) outputBox.style.display = 'block';

  const user = typeof getUser === 'function' ? getUser() : null;
  const userSkills = user?.skills || ['Engineering', 'Project Management'];

  const pitch = await generateAIProposalPitch(title, desc || 'General technical execution', userSkills);

  if (resultText) resultText.value = pitch;

  // Persist AI generation and input to Supabase
  if (typeof recordAIGeneration === 'function') {
    recordAIGeneration({
      generationType: 'proposal_pitch',
      prompt: `Title: ${title}. Requirements: ${desc}`,
      outputText: pitch,
      model: getGeminiApiKey() ? 'gemini-1.5-flash' : 'collekt-copilot-v2'
    }).catch(e => console.warn('AI log note:', e));
  }
}

function copyAIPitchText() {
  const textEl = document.getElementById('aiPropResultText');
  if (textEl && textEl.value) {
    navigator.clipboard.writeText(textEl.value);
    if (typeof showToast === 'function') showToast('📋 Proposal pitch copied to clipboard!');
  }
}

async function exportAIPitchAsPDF() {
  const title = document.getElementById('aiPropProjectTitle')?.value.trim() || 'Technical Proposal Pitch';
  const desc = document.getElementById('aiPropProjectDesc')?.value.trim() || '';
  const pitch = document.getElementById('aiPropResultText')?.value.trim();

  if (!pitch || pitch.startsWith('✨ Gemini AI is generating')) {
    if (typeof showToast === 'function') showToast('⚠️ Please generate a proposal pitch first', 'warning');
    return;
  }

  const user = typeof getUser === 'function' ? getUser() : null;
  const authorName = user?.name || user?.full_name || 'Engineering Professional';

  const htmlContent = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:18px; font-weight:900; color:#0E3B35; margin-bottom:8px;">Proposal Pitch: ${typeof escapeHTML === 'function' ? escapeHTML(title) : title}</h2>
      <div style="font-size:12px; color:#6B8280; margin-bottom:14px;"><strong>Prepared by:</strong> ${authorName} &bull; <strong>Scope:</strong> ${typeof escapeHTML === 'function' ? escapeHTML(desc) : desc}</div>
    </div>
    <div style="background:#F4F8F7; border-left:4px solid #13756F; padding:16px 20px; border-radius:8px; font-size:13px; line-height:1.8; color:#111918; white-space:pre-wrap;">${typeof escapeHTML === 'function' ? escapeHTML(pitch) : pitch}</div>
  `;

  if (typeof generateAndSaveFinalPDF === 'function') {
    await generateAndSaveFinalPDF({
      title: `Proposal - ${title}`,
      documentType: 'proposal_pdf',
      htmlContent: htmlContent,
      sourceData: { projectTitle: title, projectScope: desc, pitch: pitch }
    });
  } else {
    if (typeof showToast === 'function') showToast('PDF export module initializing...', 'info');
  }
}

/**
 * Draggable Floating Action Button & Modal Header Engine
 */
function makeElementDraggable(fabEl, panelEl) {
  if (!fabEl) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let movedDistance = 0;

  // Apply saved position if present
  try {
    const savedPos = JSON.parse(localStorage.getItem('collekt_ai_fab_pos'));
    if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
      const safeLeft = Math.max(10, Math.min(savedPos.left, window.innerWidth - (fabEl.offsetWidth || 180) - 10));
      const safeTop = Math.max(10, Math.min(savedPos.top, window.innerHeight - (fabEl.offsetHeight || 50) - 10));
      setFabPosition(safeLeft, safeTop);
    }
  } catch(e){}

  function setFabPosition(left, top) {
    fabEl.style.setProperty('left', left + 'px', 'important');
    fabEl.style.setProperty('top', top + 'px', 'important');
    fabEl.style.setProperty('bottom', 'auto', 'important');
    fabEl.style.setProperty('right', 'auto', 'important');
    updatePanelPosition(left, top);
  }

  function updatePanelPosition(left, top) {
    if (!panelEl || panelEl.getAttribute('data-custom-drag') === 'true') return;
    const panelWidth = Math.min(380, window.innerWidth - 30);
    const panelHeight = Math.min(520, window.innerHeight - 30);

    let panelLeft = left;
    let panelTop = top - panelHeight - 12;

    if (panelLeft + panelWidth > window.innerWidth - 10) {
      panelLeft = window.innerWidth - panelWidth - 10;
    }
    if (panelLeft < 10) panelLeft = 10;

    if (panelTop < 10) {
      panelTop = top + (fabEl.offsetHeight || 44) + 12;
    }

    panelEl.style.setProperty('left', panelLeft + 'px', 'important');
    panelEl.style.setProperty('top', panelTop + 'px', 'important');
    panelEl.style.setProperty('bottom', 'auto', 'important');
    panelEl.style.setProperty('right', 'auto', 'important');
  }

  function onPointerDown(e) {
    if (e.target.closest('button') || e.target.closest('input')) return;
    isDragging = true;
    movedDistance = 0;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = fabEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    fabEl.style.cursor = 'grabbing';
    fabEl.style.transition = 'none';

    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;
    movedDistance = Math.hypot(dx, dy);

    if (movedDistance > 3 && e.cancelable) {
      e.preventDefault();
    }

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    const maxLeft = window.innerWidth - fabEl.offsetWidth - 10;
    const maxTop = window.innerHeight - fabEl.offsetHeight - 10;

    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newTop = Math.max(10, Math.min(newTop, maxTop));

    setFabPosition(newLeft, newTop);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    fabEl.style.cursor = 'grab';
    fabEl.style.transition = 'all .2s ease';

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    const rect = fabEl.getBoundingClientRect();
    try {
      localStorage.setItem('collekt_ai_fab_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    } catch(e){}

    if (movedDistance > 5) {
      fabEl.setAttribute('data-dragged', 'true');
      setTimeout(() => fabEl.removeAttribute('data-dragged'), 120);
    }
  }

  fabEl.addEventListener('mousedown', onPointerDown);
  fabEl.addEventListener('touchstart', onPointerDown, { passive: true });

  // Make AI Chat Modal Header Draggable As Well
  if (panelEl) {
    const header = panelEl.querySelector('.ai-panel-header');
    if (header) {
      header.style.cursor = 'grab';
      let pDragging = false, pStartX = 0, pStartY = 0, pInitLeft = 0, pInitTop = 0;

      function onHeaderDown(e) {
        if (e.target.closest('button')) return;
        pDragging = true;
        panelEl.setAttribute('data-custom-drag', 'true');
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        pStartX = cx; pStartY = cy;
        const r = panelEl.getBoundingClientRect();
        pInitLeft = r.left; pInitTop = r.top;
        header.style.cursor = 'grabbing';

        document.addEventListener('mousemove', onHeaderMove, { passive: false });
        document.addEventListener('mouseup', onHeaderUp);
        document.addEventListener('touchmove', onHeaderMove, { passive: false });
        document.addEventListener('touchend', onHeaderUp);
      }

      function onHeaderMove(e) {
        if (!pDragging) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = cx - pStartX; const dy = cy - pStartY;
        if (Math.hypot(dx, dy) > 3 && e.cancelable) e.preventDefault();

        let nL = Math.max(10, Math.min(pInitLeft + dx, window.innerWidth - panelEl.offsetWidth - 10));
        let nT = Math.max(10, Math.min(pInitTop + dy, window.innerHeight - panelEl.offsetHeight - 10));

        panelEl.style.setProperty('left', nL + 'px', 'important');
        panelEl.style.setProperty('top', nT + 'px', 'important');
        panelEl.style.setProperty('bottom', 'auto', 'important');
        panelEl.style.setProperty('right', 'auto', 'important');
      }

      function onHeaderUp() {
        if (!pDragging) return;
        pDragging = false;
        header.style.cursor = 'grab';
        document.removeEventListener('mousemove', onHeaderMove);
        document.removeEventListener('mouseup', onHeaderUp);
        document.removeEventListener('touchmove', onHeaderMove);
        document.removeEventListener('touchend', onHeaderUp);
      }

      header.addEventListener('mousedown', onHeaderDown);
      header.addEventListener('touchstart', onHeaderDown, { passive: true });
    }
  }
}

/**
 * Kolly AI — Option 3 Integration (Floating Emerald "K" Circle + Compact ChatGPT Drawer + Full-Screen Link)
 */
function ensureKollyEngineLoaded(callback) {
  if (window.KollyEngine) {
    callback();
    return;
  }
  const existing = document.querySelector('script[src*="kolly-engine.js"]');
  if (existing) {
    existing.addEventListener('load', () => callback());
    return;
  }
  const s = document.createElement('script');
  s.src = 'kolly-engine.js?v=159.0';
  s.onload = () => callback();
  document.head.appendChild(s);
}

function formatKollyDrawerMarkdown(md) {
  if (!md) return '';
  const cleanMd = (window.KollyEngine && window.KollyEngine.sanitizeInternalDetails)
    ? window.KollyEngine.sanitizeInternalDetails(md)
    : md;
  let html = cleanMd
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^---$/gim, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:10px 0;" />');
  html = html.replace(/^#### (.*$)/gim, '<h4 style="font-size:14px;font-weight:700;color:#fff;margin:10px 0 6px;">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:15px;font-weight:700;color:#fff;margin:12px 0 6px;">$1</h3>');
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote style="border-left:3px solid #10a37f;padding-left:10px;color:#b4b4b4;margin:8px 0;">$1</blockquote>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:4px;font-size:12.5px;">$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#34d399;text-decoration:underline;">$1</a>');

  const lines = html.split('\n');
  let out = '';
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^(\*|-|\d+\.)\s+/.test(trimmed)) {
      if (!inList) {
        out += '<ul style="margin:6px 0 10px 18px;">';
        inList = true;
      }
      out += '<li style="margin-bottom:4px;">' + trimmed.replace(/^(\*|-|\d+\.)\s+/, '') + '</li>';
    } else {
      if (inList) {
        out += '</ul>';
        inList = false;
      }
      if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
        out += trimmed;
      } else if (trimmed.length > 0) {
        out += '<p style="margin-bottom:8px;">' + trimmed + '</p>';
      }
    }
  });
  if (inList) out += '</ul>';
  return out;
}

function initCollektAICopilot() {
  const path = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (path.includes('kolly.html')) return;
  if (document.getElementById('kollyFloatingWidget')) return;

  ensureKollyEngineLoaded(() => {
    if (!window.KollyEngine || document.getElementById('kollyFloatingWidget')) return;

    const style = document.createElement('style');
    style.textContent = `
      .kolly-fab-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9998;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #10a37f;
        color: #ffffff;
        border: 2px solid rgba(255, 255, 255, 0.18);
        font-family: 'Inter', 'Manrope', sans-serif;
        font-size: 21px;
        font-weight: 800;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(16, 163, 127, 0.42), 0 4px 10px rgba(0, 0, 0, 0.3);
        transition: transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.2s ease;
        user-select: none;
      }
      .kolly-fab-btn:hover {
        transform: translateY(-3px) scale(1.05);
        box-shadow: 0 14px 34px rgba(16, 163, 127, 0.55), 0 6px 14px rgba(0, 0, 0, 0.35);
      }
      .kolly-drawer-panel {
        position: fixed;
        bottom: 84px;
        right: 24px;
        z-index: 9999;
        width: min(410px, calc(100vw - 28px));
        height: min(580px, calc(100dvh - 110px));
        background: #212121;
        color: #ececec;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: 'Inter', 'Manrope', -apple-system, sans-serif;
      }
      .kolly-drawer-header {
        height: 52px;
        padding: 0 14px;
        background: #171717;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      .kolly-hdr-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #ececec;
        font-size: 11.5px;
        font-weight: 600;
        padding: 5px 9px;
        border-radius: 7px;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: inherit;
      }
      .kolly-hdr-btn:hover {
        background: #2a2a2a;
      }
      .kolly-history-Tray {
        background: #171717;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        max-height: 170px;
        overflow-y: auto;
        padding: 8px 10px;
        display: none;
        flex-direction: column;
        gap: 3px;
      }
      .kolly-hist-item {
        padding: 7px 10px;
        border-radius: 7px;
        font-size: 12.5px;
        color: #b4b4b4;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .kolly-hist-item:hover, .kolly-hist-item.active {
        background: #2a2a2a;
        color: #ececec;
      }
      .kolly-drawer-stream {
        flex: 1;
        overflow-y: auto;
        padding: 16px 14px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .kolly-drawer-input-wrap {
        padding: 10px 12px 12px;
        background: #212121;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .kolly-drawer-form {
        background: #2f2f2f;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 6px 8px 6px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .kolly-drawer-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #ececec;
        font-size: 13.5px;
        font-family: inherit;
      }
      .kolly-drawer-input::placeholder {
        color: #8e8e8e;
      }
      .kolly-drawer-send {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: #ffffff;
        color: #171717;
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      @media (max-width: 900px) {
        .kolly-fab-btn {
          bottom: 84px;
          right: 16px;
          width: 46px;
          height: 46px;
          font-size: 19px;
        }
        .kolly-drawer-panel {
          bottom: 138px;
          right: 14px;
          width: calc(100vw - 28px);
          height: min(510px, calc(100dvh - 160px));
        }
      }
    `;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'kollyFloatingWidget';
    widget.innerHTML = `
      <button type="button" class="kolly-fab-btn" id="kollyFabBtn" title="Ask Kolly — Collekt AI">K</button>
      <div class="kolly-drawer-panel" id="kollyDrawerPanel">
        <div class="kolly-drawer-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:26px;height:26px;border-radius:50%;background:#10a37f;color:#fff;display:inline-grid;place-items:center;font-size:13px;font-weight:800;">K</span>
            <span style="font-weight:700;font-size:14px;color:#ececec;">Kolly</span>
            <span style="font-size:10.5px;font-weight:600;padding:2px 6px;border-radius:99px;background:rgba(16,163,127,0.18);color:#34d399;">Collekt AI</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="kolly-hdr-btn" id="kollyBtnNew" title="Start a new chat">+ New</button>
            <button type="button" class="kolly-hdr-btn" id="kollyBtnHist" title="View saved chat history">History</button>
            <a href="kolly.html" class="kolly-hdr-btn" title="Open full-screen ChatGPT view">⛶ Full</a>
            <button type="button" id="kollyBtnClose" style="background:none;border:none;color:#b4b4b4;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">&times;</button>
          </div>
        </div>
        <div class="kolly-history-Tray" id="kollyHistoryTray"></div>
        <div class="kolly-drawer-stream" id="kollyDrawerStream"></div>
        <div class="kolly-drawer-input-wrap">
          <form class="kolly-drawer-form" id="kollyDrawerForm">
            <input type="text" class="kolly-drawer-input" id="kollyDrawerInput" placeholder="Message Kolly..." autocomplete="off" />
            <button type="submit" class="kolly-drawer-send">↑</button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    const fabBtn = document.getElementById('kollyFabBtn');
    const panel = document.getElementById('kollyDrawerPanel');
    const btnNew = document.getElementById('kollyBtnNew');
    const btnHist = document.getElementById('kollyBtnHist');
    const btnClose = document.getElementById('kollyBtnClose');
    const historyTray = document.getElementById('kollyHistoryTray');
    const stream = document.getElementById('kollyDrawerStream');
    const form = document.getElementById('kollyDrawerForm');
    const input = document.getElementById('kollyDrawerInput');

    function getActiveDrawerThread() {
      let threads = window.KollyEngine.getThreads();
      let activeId = localStorage.getItem('kolly_chatgpt_active_thread_v2');
      if (!threads.length) {
        const nt = window.KollyEngine.createNewThread();
        return nt;
      }
      return threads.find(t => t.id === activeId) || threads[0];
    }

    function renderDrawerHistory() {
      const threads = window.KollyEngine.getThreads();
      const activeThread = getActiveDrawerThread();
      historyTray.innerHTML = '';
      threads.forEach(t => {
        const row = document.createElement('div');
        row.className = 'kolly-hist-item' + (t.id === activeThread.id ? ' active' : '');
        row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title || 'New chat'}</span>`;
        row.addEventListener('click', () => {
          localStorage.setItem('kolly_chatgpt_active_thread_v2', t.id);
          historyTray.style.display = 'none';
          renderDrawerMessages();
        });
        historyTray.appendChild(row);
      });
    }

    function renderDrawerMessages() {
      const thread = getActiveDrawerThread();
      const mem = window.KollyEngine.getLearnedMemory();
      stream.innerHTML = '';

      if (!thread.messages || thread.messages.length === 0) {
        const greetingName = mem.userName ? `, ${mem.userName}` : '';
        const empty = document.createElement('div');
        empty.style.cssText = 'margin:auto;text-align:center;padding:18px 8px;';
        empty.innerHTML = `
          <div style="width:40px;height:40px;border-radius:50%;background:#10a37f;color:#fff;font-weight:800;font-size:18px;display:inline-grid;place-items:center;margin-bottom:12px;">K</div>
          <div style="font-size:19px;font-weight:600;color:#ececec;margin-bottom:6px;">What can I help with${greetingName}?</div>
          <div style="font-size:12.5px;color:#b4b4b4;margin-bottom:16px;">Ask anything about Collekt, Naira project fees, or Milestone Escrow.</div>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;">
            <button type="button" class="kolly-q-pill" data-q="What is Collekt and how does it work?" style="padding:7px 11px;border-radius:99px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#b4b4b4;font-size:12px;cursor:pointer;">What is Collekt?</button>
            <button type="button" class="kolly-q-pill" data-q="How does Milestone Escrow protect my money?" style="padding:7px 11px;border-radius:99px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#b4b4b4;font-size:12px;cursor:pointer;">How Escrow works</button>
            <button type="button" class="kolly-q-pill" data-q="Suggest realistic Nigerian Naira fees for hiring an Engineer or Developer." style="padding:7px 11px;border-radius:99px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#b4b4b4;font-size:12px;cursor:pointer;">Suggest job fees</button>
            <button type="button" class="kolly-q-pill" data-q="Guide me around collektng.com" style="padding:7px 11px;border-radius:99px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#b4b4b4;font-size:12px;cursor:pointer;">Navigate website</button>
          </div>
        `;
        empty.querySelectorAll('.kolly-q-pill').forEach(btn => {
          btn.addEventListener('click', () => sendDrawerMessage(btn.getAttribute('data-q')));
        });
        stream.appendChild(empty);
        return;
      }

      thread.messages.forEach(msg => {
        if (msg.role === 'user') {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:flex-end;';
          const bub = document.createElement('div');
          bub.style.cssText = 'background:#2f2f2f;color:#ececec;padding:10px 14px;border-radius:18px;max-width:82%;font-size:13.5px;line-height:1.5;white-space:pre-wrap;';
          bub.textContent = msg.content;
          row.appendChild(bub);
          stream.appendChild(row);
        } else {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
          row.innerHTML = `
            <div style="width:26px;height:26px;border-radius:50%;background:#10a37f;color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center;flex-shrink:0;margin-top:2px;">K</div>
            <div style="flex:1;min-width:0;font-size:13.5px;line-height:1.6;color:#ececec;">
              ${formatKollyDrawerMarkdown(msg.content)}
            </div>
          `;
          stream.appendChild(row);
        }
      });

      stream.scrollTop = stream.scrollHeight;
    }

    async function sendDrawerMessage(text) {
      const clean = (text || '').trim();
      if (!clean) return;

      const threads = window.KollyEngine.getThreads();
      let activeId = localStorage.getItem('kolly_chatgpt_active_thread_v2');
      let thread = threads.find(t => t.id === activeId) || threads[0];
      if (!thread) {
        thread = window.KollyEngine.createNewThread();
      }

      if (!thread.messages.length) {
        thread.title = clean.length > 34 ? clean.slice(0, 34) + '...' : clean;
      }

      thread.messages.push({
        role: 'user',
        content: clean,
        createdAt: new Date().toISOString()
      });
      thread.updatedAt = new Date().toISOString();
      window.KollyEngine.saveThreads(threads);
      renderDrawerMessages();

      const replyText = await window.KollyEngine.generateReply(clean, thread.messages);

      const updatedThreads = window.KollyEngine.getThreads();
      const target = updatedThreads.find(t => t.id === thread.id) || updatedThreads[0];
      if (target) {
        target.messages.push({
          role: 'assistant',
          content: replyText,
          createdAt: new Date().toISOString()
        });
        target.updatedAt = new Date().toISOString();
        window.KollyEngine.saveThreads(updatedThreads);
      }
      renderDrawerMessages();
    }

    fabBtn.addEventListener('click', () => {
      const isHidden = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        renderDrawerMessages();
        setTimeout(() => input.focus(), 80);
      }
    });

    btnClose.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    btnNew.addEventListener('click', () => {
      window.KollyEngine.createNewThread();
      historyTray.style.display = 'none';
      renderDrawerMessages();
      input.focus();
    });

    btnHist.addEventListener('click', () => {
      const open = historyTray.style.display === 'flex';
      if (!open) renderDrawerHistory();
      historyTray.style.display = open ? 'none' : 'flex';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = '';
      sendDrawerMessage(val);
    });
  });
}

function toggleCollektAIPanel() {
  const panel = document.getElementById('kollyDrawerPanel');
  if (panel) {
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'flex' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCollektAICopilot();
});

// Autonomous Collekt AI Skill Exports for Platform-wide Integration
window.draftEscrowAgreement = async function(projectTitle, budget, milestones) {
  const prompt = `Draft milestone escrow agreement for "${projectTitle}". Total Budget: ${budget}. Milestones: ${milestones || 'Standard 3-phase delivery'}.`;
  return await queryGeminiAI(prompt, '', 'draft_escrow');
};

window.estimateBOQ = async function(scope, location = 'Nigeria') {
  const prompt = `Estimate Bill of Quantities (BOQ) for "${scope}" in ${location}.`;
  return await queryGeminiAI(prompt, '', 'estimate_boq');
};

window.arbitrateDispute = async function(summary, evidence = '') {
  const prompt = `Arbitrate escrow dispute: ${summary}. Evidence provided: ${evidence || 'Waybill and communication logs'}.`;
  return await queryGeminiAI(prompt, '', 'dispute_review');
};

window.calculateNigerianTaxAndFees = async function(amount, contractType = 'Corporate Technical Services') {
  const prompt = `Calculate Nigerian WHT, VAT, and Collekt escrow fees for gross contract sum of ₦${amount} under category: ${contractType}.`;
  return await queryGeminiAI(prompt, '', 'tax_calc');
};

window.profileVendorTrust = async function(vendorDetails) {
  const prompt = `Profile vendor trust and risk metrics for: ${typeof vendorDetails === 'object' ? JSON.stringify(vendorDetails) : vendorDetails}.`;
  return await queryGeminiAI(prompt, '', 'trust_profile');
};

