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
async function queryGeminiAI(prompt, systemInstruction = '') {
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
        console.warn('Gemini API endpoint notice:', err);
      }
    }
  }

  // High-Capacity Intelligent Collekt Dynamic AI Engine
  return generateCollektSmartFallback(prompt, user);
}

/**
 * Intelligent Dynamic AI Fallback Engine
 */
function generateCollektSmartFallback(prompt, user = null) {
  const p = prompt.toLowerCase();
  const name = user?.name || 'Member';
  const isCompany = user?.role === 'company';

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
    return `✨ **Greetings ${name}! I am your Collekt AI Copilot**.\n\nI can assist you with:\n• 📝 **Drafting Winning Proposals & Tender Specs**\n• 💳 **Wallet Funding & Paystack Auto-Reconciliation**\n• 🏦 **NUBAN Bank Withdrawals**\n• 🛡️ **CAC, TIN, NIN & Corporate Verification**\n• 🏛️ **NUPRC / NCDMB Regulatory Compliance**\n\nType your question or click ⚙️ in the header to connect your live Google Gemini API key!`;
  }

  // Dynamic structured AI response for custom questions
  return `✨ **Collekt AI Insights**:\n\nRegarding your inquiry: *"_${prompt}_"*\n\n1. **Overview**: Collekt provides end-to-end engineering, procurement, and talent matching for African energy projects.\n2. **Actionable Step**: Navigate to your dashboard or workspace tabs to manage your active contracts, proposals, and verified identity documents.\n3. **Pro Tip**: To ask complex technical or engineering questions, click **⚙️ Settings** in the AI header to paste your **Google Gemini API Key** for unlimited live AI answers!`;
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
 * Floating AI Copilot Widget UI Engine
 */
function initCollektAICopilot() {
  // Old floating AI disabled in favor of unified Kolly AI Assistant in app.js
  return;

  const style = document.createElement('style');
  style.textContent = `
    .ai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      background: linear-gradient(135deg, #0E3B35, #13756F);
      color: #fff; border: 1.5px solid rgba(74, 222, 128, 0.4);
      padding: 12px 20px; border-radius: 99px; font-weight: 800; font-size: 13px;
      display: flex; align-items: center; gap: 8px; cursor: grab;
      box-shadow: 0 10px 32px rgba(14, 59, 53, 0.35); transition: all .25s ease;
      font-family: 'Manrope', sans-serif; user-select: none; touch-action: none;
    }
    .ai-fab:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 16px 40px rgba(14, 59, 53, 0.5); }
    .ai-fab:active { cursor: grabbing; }
    .ai-panel {
      position: fixed; bottom: 92px; right: 28px; z-index: 9999;
      width: min(380px, calc(100vw - 40px)); height: 520px;
      background: var(--white); border: 1px solid var(--line);
      border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: flex; flex-direction: column; overflow: hidden;
      animation: fadeIn .2s ease-out; font-family: 'Manrope', sans-serif;
    }
    html.dark .ai-panel { background: #0f2220; border-color: rgba(255,255,255,.1); }
    .ai-panel-header {
      background: linear-gradient(135deg, #0E3B35, #13756F);
      padding: 14px 18px; color: #fff; display: flex; justify-content: space-between; align-items: center;
      cursor: grab; user-select: none; touch-action: none;
    }
    .ai-panel-header:active { cursor: grabbing; }
    .ai-chat-body { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: var(--paper); }
    html.dark .ai-chat-body { background: #071210; }
    .ai-msg { max-width: 88%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
    .ai-msg.bot { background: var(--white); border: 1px solid var(--line); color: var(--ink); align-self: flex-start; }
    html.dark .ai-msg.bot { background: #0f2220; border-color: rgba(255,255,255,.08); color: #e2efed; }
    .ai-msg.user { background: var(--teal); color: #fff; align-self: flex-end; }
    .ai-quick-prompts { display: flex; gap: 6px; overflow-x: auto; padding: 8px 16px; background: var(--white); border-top: 1px solid var(--line); }
    html.dark .ai-quick-prompts { background: #0f2220; border-color: rgba(255,255,255,.08); }
    .ai-chip { font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 99px; background: var(--teal-lt); color: var(--teal); border: 1px solid rgba(19,117,111,0.2); white-space: nowrap; cursor: pointer; }
    .ai-input-bar { padding: 10px 16px; background: var(--white); border-top: 1px solid var(--line); display: flex; gap: 8px; }
    html.dark .ai-input-bar { background: #0f2220; border-color: rgba(255,255,255,.08); }
    .ai-input-bar input { flex: 1; padding: 9px 14px; border: 1.5px solid var(--line); border-radius: 99px; font-size: 13px; outline: none; background: var(--paper); color: var(--ink); }
    html.dark .ai-input-bar input { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); color: #e2efed; }
  `;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'collektAiWidget';
  widget.innerHTML = `
    <div class="ai-fab" onclick="toggleCollektAIPanel()" title="Click to chat • Drag to move anywhere">
      <span style="opacity:0.6; font-size:12px;">⠿</span> <img src="kolly-mascot-clean.png" alt="Kolly" style="height:24px; width:auto; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"> Kolly AI Assistant
    </div>

    <div class="ai-panel" id="collektAiPanel" style="display:none;">
      <div class="ai-panel-header" title="Drag to move chat window">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="opacity:0.6; font-size:14px;">⠿</span>
          <img src="kolly-mascot-clean.png" alt="Kolly" style="height:32px; width:auto; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
          <div>
            <div style="font-weight:900; font-size:14px;">Kolly &bull; Collekt Mascot AI</div>
            <div style="font-size:10px; opacity:0.85;">Powered by Google Gemini 2.5</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button onclick="openGeminiApiKeyModal()" title="Gemini API Key Settings" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:14px; padding:4px 8px; border-radius:6px; cursor:pointer;">⚙️ Key</button>
          <button onclick="clearCollektAIChat()" title="Clear Chat" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:14px; padding:4px 8px; border-radius:6px; cursor:pointer;">🗑️</button>
          <button onclick="toggleCollektAIPanel()" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer; line-height:1;">&times;</button>
        </div>
      </div>

      <div class="ai-chat-body" id="collektAiChatBody">
        <div class="ai-msg bot">
          👋 Hello! I'm <strong>Kolly</strong>, your Collekt Dino Mascot &amp; AI Assistant 🦖. Ask me anything about bidding on energy tenders, drafting proposal pitches, funding your wallet via Paystack, bank withdrawals, or CAC/NIN verification!
        </div>
      </div>

      <div class="ai-quick-prompts">
        <span class="ai-chip" onclick="askAICopilot('How do I fund my wallet via Paystack?')">💳 Paystack Funding</span>
        <span class="ai-chip" onclick="askAICopilot('How do I withdraw to my bank account?')">🏦 Bank Withdrawal</span>
        <span class="ai-chip" onclick="askAICopilot('How do I complete identity verification?')">🛡️ Verification</span>
        <span class="ai-chip" onclick="askAICopilot('How do I win EPC tenders on Collekt?')">📝 Tender Bidding</span>
      </div>

      <div class="ai-input-bar">
        <input type="text" id="collektAiInput" placeholder="Ask Kolly AI..." onkeydown="if(event.key==='Enter') sendCollektAIMessage()">
        <button class="btn btn-primary btn-sm" style="border-radius:99px; padding:0 16px; background:var(--teal); font-weight:800;" onclick="sendCollektAIMessage()">Send</button>
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  const fab = widget.querySelector('.ai-fab');
  const panel = widget.querySelector('.ai-panel');
  makeElementDraggable(fab, panel);
}

function clearCollektAIChat() {
  const chatBody = document.getElementById('collektAiChatBody');
  if (chatBody) {
    chatBody.innerHTML = `
      <div class="ai-msg bot">
        👋 Chat cleared! I'm Kolly 🦖 — ask me anything about bidding on energy tenders, drafting proposal pitches, Paystack wallet funding, NUBAN withdrawals, or identity verification!
      </div>
    `;
  }
}

function toggleCollektAIPanel() {
  const fab = document.querySelector('.ai-fab');
  if (fab && fab.getAttribute('data-dragged') === 'true') return;
  const panel = document.getElementById('collektAiPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

async function askAICopilot(promptText) {
  const input = document.getElementById('collektAiInput');
  if (input) input.value = promptText;
  sendCollektAIMessage();
}

async function sendCollektAIMessage() {
  const input = document.getElementById('collektAiInput');
  const chatBody = document.getElementById('collektAiChatBody');
  if (!input || !chatBody) return;

  const text = input.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = text;
  chatBody.appendChild(userMsg);

  input.value = '';
  chatBody.scrollTop = chatBody.scrollHeight;

  const botMsg = document.createElement('div');
  botMsg.className = 'ai-msg bot';
  botMsg.innerHTML = `<em>✨ Google Gemini AI is thinking...</em>`;
  chatBody.appendChild(botMsg);
  chatBody.scrollTop = chatBody.scrollHeight;

  const responseText = await queryGeminiAI(text);
  
  const formatted = responseText
    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.1); padding:8px 12px; border-radius:8px; font-family:monospace; font-size:11px; overflow-x:auto; margin:6px 0;"><code>$1</code></pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06); padding:2px 5px; border-radius:4px; font-family:monospace; font-size:12px;">$1</code>')
    .replace(/\n/g, '<br>');

  botMsg.innerHTML = formatted;
  chatBody.scrollTop = chatBody.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  initCollektAICopilot();
});
