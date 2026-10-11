/* ============================================================================
   KOLLY AI — EXECUTIVE REASONING & CONTINUOUS LEARNING ENGINE (v3.0)
   Claude-Caliber Professional Intelligence for Collekt (collektng.com)
   - Executive, analytical, articulate advisor persona
   - Strict zero-disclosure of internal filenames (.html, .js, etc.)
   - Proactive Name Personalization & Persistent Conversational Memory
============================================================================ */

(function (global) {
  const STORAGE_KEYS = {
    THREADS: 'kolly_chatgpt_threads_v2',
    ACTIVE_THREAD: 'kolly_chatgpt_active_thread_v2',
    LEARNED_MEMORY: 'kolly_learned_knowledge_v2',
    GEMINI_KEY: 'collekt_gemini_api_key'
  };

  /* --------------------------------------------------------------------------
     0. STRICT INTERNAL DETAIL SANITIZER (NEVER DISCLOSE .HTML OR FILE PATHS)
  -------------------------------------------------------------------------- */
  const PAGE_NAME_MAP = {
    'post-job.html': '**Post Opportunity**',
    'post_job.html': '**Post Opportunity**',
    'post.html': '**Post Opportunity**',
    'my-jobs.html': '**My Opportunities**',
    'marketplace.html': '**Marketplace**',
    'proposals.html': '**Collektions**',
    'wallet.html': '**Wallet**',
    'messages.html': '**Messages**',
    'profile.html': '**Profile**',
    'company-profile.html': '**Company Profile**',
    'dashboard.html': '**Overview**',
    'company-dashboard.html': '**Company Overview**',
    'register.html': '**Sign Up**',
    'signup.html': '**Sign Up**',
    'login.html': '**Log In**',
    'index.html': '**Collekt Home**',
    'kolly.html': '**Kolly AI**'
  };

  function sanitizeInternalDetails(text) {
    if (!text || typeof text !== 'string') return '';
    let out = text;

    // 1. Replace markdown links that expose .html in label or URL: [post-job.html](...) or [collektng.com/wallet.html](...)
    out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, label, url) => {
      const cleanLabel = label.trim();
      const lowerLabel = cleanLabel.toLowerCase();
      for (const [file, friendly] of Object.entries(PAGE_NAME_MAP)) {
        if (lowerLabel === file || lowerLabel === `collektng.com/${file}` || lowerLabel === `https://collektng.com/${file}`) {
          return friendly;
        }
      }
      if (/\.html\b/i.test(cleanLabel)) {
        const stripped = cleanLabel
          .replace(/^https?:\/\/(www\.)?collektng\.com\//i, '')
          .replace(/^collektng\.com\//i, '')
          .replace(/\.html.*$/i, '')
          .replace(/[-_]/g, ' ');
        return `**${stripped.charAt(0).toUpperCase() + stripped.slice(1)}**`;
      }
      // If label is clean (e.g. "Post a Job"), just return bold label without raw .html URL exposure
      if (/\.html\b/i.test(url)) {
        return `**${cleanLabel}**`;
      }
      return match;
    });

    // 2. Replace any parenthetical or inline references like "(using post-job.html)" or "collektng.com/wallet.html"
    out = out.replace(/\(using\s+[a-z0-9_-]+\.html\)/gi, '(via **Post Opportunity**)');
    for (const [file, friendly] of Object.entries(PAGE_NAME_MAP)) {
      const escaped = file.replace('.', '\\.');
      const regex = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:collektng\\.com\\/)?\\b${escaped}\\b`, 'gi');
      out = out.replace(regex, friendly);
    }

    // 3. Catch-all for any remaining *.html, *.js, or *.css mentions
    out = out.replace(/(?:https?:\/\/)?(?:www\.)?(?:collektng\.com\/)?\b([a-z0-9_-]+)\.(?:html|js|css)\b/gi, (_, name) => {
      const clean = name.replace(/[-_]/g, ' ');
      return `**${clean.charAt(0).toUpperCase() + clean.slice(1)}**`;
    });

    return out;
  }

  /* --------------------------------------------------------------------------
     1. EXECUTIVE KNOWLEDGE ARCHITECTURE (CLAUDE-STYLE ANALYTICAL DEPTH)
  -------------------------------------------------------------------------- */
  const COLLEKT_KNOWLEDGE = {
    about: {
      patterns: ['what is collekt', 'about collekt', 'what do you do', 'what does collekt do', 'explain collekt', 'who are you', 'what is this platform', 'how does collekt work', 'tell me about collekt'],
      answer: `**Collekt** is Nigeria’s verified B2B project marketplace and milestone-escrow platform. We built it to solve the single biggest friction in Nigerian contracting: **the trust gap between companies commissioning critical work and the specialists executing it.**

Here is how the ecosystem operates in practice:

1. **Identity- & Credential-Vetted Talent:** Every independent specialist and contractor on Collekt undergoes multi-layer verification—combining biometric identity checks (**NIN/BVN**), corporate registration (**CAC & FIRS TIN** for enterprises), and technical accreditation (**COREN, ICAN, ACCA, NBA**, or verified engineering/software portfolios).
2. **Structured Scopes & "Collektions":** Rather than informal quotes or vague retainers, companies publish structured project briefs under **Post Opportunity**, and vetted professionals respond with **Collektions**—proposals that break execution into verifiable milestones, timelines, and Naira (\`₦\`) allocations.
3. **Zero-Risk Milestone Escrow:** Instead of paying 50% upfront to a personal bank account and hoping for delivery, the hiring company funds a **Dedicated Virtual Account (NUBAN)** held in escrow. The specialist has 100% certainty the capital is locked before starting work, and the company retains 100% control—funds are only disbursed when a milestone deliverable is reviewed and approved.
4. **Integrated Execution Workspace:** Encrypted real-time messaging, voice and video calls, technical document sharing, and automated ledger receipts live inside a single workspace.`
    },

    escrow_and_wallet: {
      patterns: ['escrow', 'wallet', 'nuban', 'paystack', 'korapay', 'deposit', 'fund', 'withdraw', 'payment', 'money', 'safe', 'refund', 'dispute', '50% upfront'],
      answer: `### How Collekt’s Milestone Escrow Protects Both Sides

Traditional contracting in Nigeria forces an unfair trade-off: if the client pays upfront, they absorb the delivery risk; if the specialist works without an advance, they absorb the default risk. Collekt eliminates both through a **double-entry Milestone Escrow ledger**:

* **1. Dedicated Virtual Account (NUBAN) Funding:** Within your **Wallet**, your account is provisioned with a dedicated Nigerian commercial bank account via CBN-licensed settlement rails. You can fund your balance via instant bank transfer or corporate card.
* **2. Milestone Ring-Fencing:** When a company accepts a specialist’s **Collektion**, the capital for the active milestone is ring-fenced in escrow. Both parties see the verified escrow status on their dashboard before kickoff.
* **3. Deliverable Inspection & Instant Release:** Once the specialist submits the milestone deliverable, the client reviews it against the agreed acceptance criteria. Clicking **Approve Milestone** immediately credits the specialist’s available **Wallet** balance for instant withdrawal to any Nigerian bank account.
* **4. Impartial Dispute Resolution:** If a deliverable deviates from the agreed technical scope, the funds remain frozen in escrow while Collekt’s dispute resolution team evaluates the timestamped project workspace, deliverables, and contract terms.`
    },

    hiring_and_companies: {
      patterns: ['hire', 'company', 'employer', 'post a job', 'post opportunity', 'tender', 'find engineer', 'find developer', 'find designer', 'shortlist', 'founding 50', 'pioneer'],
      answer: `### Engaging Vetted Specialists & Contractors as a Company

Whether you are procuring a specialized engineering work package, a software build, or a financial audit, here is the most effective way to run a brief on Collekt:

1. **Define a Clear Milestone Brief:** Navigate to **Post Opportunity** in your sidebar. Specify the technical objective, required accreditations (e.g., *COREN, NIQS, ICAN, or production GitHub history*), target budget in Naira (\`₦\`), and a 2-to-3 stage delivery schedule.
2. **Evaluate Structured Collektions:** Within 24–48 hours, verified specialists submit **Collektions** detailing their technical methodology, milestone pricing, and relevant past work.
3. **Conduct Technical Alignment:** Use **Messages** to hold encrypted chats or HD voice/video interviews, share drawings or specifications, and finalize milestone terms.
4. **Fund Escrow & Commence:** Accept the winning Collektion and lock Milestone 1 in your **Wallet**. You only release payment as each phase is delivered and verified.

> **Executive Note — The Founding 50 Pilot:** Selected pioneer companies currently receive **0% platform and escrow fees across their first 3 projects**, alongside a **48-hour curated shortlist** prepared by our technical vetting team.`
    },

    talent_and_bidding: {
      patterns: ['talent', 'professional', 'freelancer', 'get hired', 'apply', 'collektion', 'proposal', 'bid', 'verify', 'verification', 'nin', 'bvn', 'coren', 'ican', 'profile strength', 'cv'],
      answer: `### Positioning Yourself to Win High-Value Contracts on Collekt

Corporate clients on Collekt prioritize verifiable competence and low execution risk. To stand out consistently:

1. **Reach 100% Profile Strength & Shield Verification:**
   * Open **Profile** from your sidebar and complete every verification pillar: professional summary, core technical competencies, resume/CV, portfolio evidence, professional certifications (**COREN, ICAN, ACCA, PMP, HSE**), and **NIN/BVN Identity Verification**.
   * Accounts at 100% completion with verified identity earn the **Collekt Shield Badge**, which significantly increases shortlist conversion.
2. **Structure Executive-Grade "Collektions":**
   * When bidding on opportunities in the **Marketplace**, avoid generic one-line pitches. Break your proposal into **3 concrete milestones** (for example: *30% Technical Specification & Mobilization • 40% Core Execution & Review • 30% Testing & Final Handover*).
   * State the exact deliverable the client will receive at the end of each milestone so they feel confident locking funds in escrow.
3. **Guaranteed Liquidity:**
   * Never begin execution until the milestone shows as **Escrow Funded**. Once funded, your fee is guaranteed upon deliverable approval and can be withdrawn directly from your **Wallet** to your Nigerian bank account.`
    },

    navigation: {
      patterns: ['navigate', 'where is', 'find page', 'links', 'menu', 'dashboard', 'settings', 'dark mode', 'messages', 'call', 'around'],
      answer: `### Navigating Your Collekt Workspace

Everything on Collekt is organized around your left navigation sidebar:

* **Overview:** Your executive command center—tracking active Collektions, projects won, total earnings, profile completion score, and uploaded credentials.
* **Marketplace:** Browse live corporate tenders and project opportunities—or, if you are a company, filter verified Nigerian specialists by discipline and accreditation.
* **Post Opportunity** *(Company Accounts)*: Publish a new project tender or technical contract with structured milestone budgets.
* **Collektions:** Track every proposal you have submitted or received, review milestone progress, and manage active contracts.
* **Messages:** Real-time encrypted workspace with read receipts, file attachments, and built-in voice and video calling.
* **Wallet:** Manage your Dedicated Virtual Account (NUBAN), fund project escrow milestones, and withdraw cleared earnings to your bank account.
* **Profile & Settings:** Upload your CV, certifications, and portfolio items, complete identity verification, or toggle between Light Mode and Velvet Obsidian Dark Mode.`
    }
  };

  /* --------------------------------------------------------------------------
     2. COMMERCIAL BENCHMARKS & PROJECT SCOPING MODELS (NAIRA ₦)
  -------------------------------------------------------------------------- */
  const FEE_GUIDES = [
    {
      name: 'Oil, Gas, Subsea, Piping & Mechanical Engineering',
      keywords: ['subsea', 'piping', 'pipeline', 'offshore', 'epc', 'mechanical', 'process', 'coren', 'rig', 'oil', 'gas', 'welding', 'structural', 'hazop', 'ndt', 'instrumentation'],
      shortSprint: '₦650,000 – ₦1,200,000 (1–2 weeks • Technical Audit / P&ID Review / Stress Check)',
      standardProject: '₦1,800,000 – ₦3,500,000 (3–6 weeks • Full Engineering Package / Isometrics / Tie-In Spec)',
      complexPackage: '₦5,000,000 – ₦14,500,000+ (2–3 months • Multi-Discipline FEED / EPC Work Package)',
      recommendedSplit: '30% Basis of Design & P&ID Verification • 40% 3D Modeling, Stress Analysis & Isometrics • 30% AFC COREN-Stamped Handover',
      deliverables: 'Basis of Design (BOD), P&IDs, Pipe Stress Analysis Report (Caesar II), Isometric Drawings, and Material Take-Off (MTO) / BOQ.',
      keySkills: 'COREN Registration, AutoCAD Plant 3D, Caesar II, PDMS/E3D, ASME B31.3 / API compliance, NUPRC/NCDMB familiarity'
    },
    {
      name: 'Civil, Structural, Electrical, Commercial Solar & HSE',
      keywords: ['civil', 'solar', 'electrical', 'inverter', 'construction', 'boq', 'quantity surveyor', 'architect', 'hse', 'safety', 'building', 'warehouse', 'substation', 'structural', 'foundation'],
      shortSprint: '₦400,000 – ₦850,000 (1–2 weeks • Site Assessment, Load Audit & Itemized BOQ)',
      standardProject: '₦1,350,000 – ₦2,600,000 (3–6 weeks • Detailed Structural/Electrical Design & Supervision)',
      complexPackage: '₦4,000,000 – ₦11,000,000+ (2–3 months • Full Turnkey Civil/Solar EPC Supervision)',
      recommendedSplit: '30% Site Survey, Load/Soil Audit & Priced BOQ • 40% Detailed Engineering Drawings & Procurement Spec • 30% Testing, Commissioning & As-Built Sign-Off',
      deliverables: 'Site Survey Report, Structural/Single-Line Diagrams, Itemized Bill of Quantities (BOQ), QA/QC Inspection Logs, and Commissioning Certificate.',
      keySkills: 'COREN / NIQS / NEMSA / NEBOSH HSE certifications, Eurocode/BS structural standards, commercial BOQ costing'
    },
    {
      name: 'Software Engineering, Fintech, Web, Mobile & AI Systems',
      keywords: ['software', 'developer', 'app', 'mobile', 'website', 'web', 'frontend', 'backend', 'fullstack', 'react', 'node', 'python', 'flutter', 'fintech', 'api', 'ai', 'cybersecurity', 'qa', 'platform', 'mvp', 'saas'],
      shortSprint: '₦450,000 – ₦900,000 (1–2 weeks • Feature Sprint, API Integration, or Security Audit)',
      standardProject: '₦1,500,000 – ₦3,200,000 (3–6 weeks • Production Web/Mobile MVP or Core System Build)',
      complexPackage: '₦4,500,000 – ₦12,000,000+ (2–3 months • Full Enterprise Platform, Fintech Ledger, or Multi-App Ecosystem)',
      recommendedSplit: '25% System Architecture, Database Schema & Staging Prototype • 50% Core Backend APIs, Payment/Auth Integration & Frontend Build • 25% Automated QA, Security Hardening & Production Deployment',
      deliverables: 'System Architecture Document, Interactive Staging Deployment, Full Git Repository & CI/CD Pipeline, API Documentation, and Post-Launch Handover.',
      keySkills: 'Production GitHub track record, clean API architecture, Paystack/KoraPay/NIBSS integration experience, OWASP security & automated testing'
    },
    {
      name: 'Product Design (UI/UX), Brand Systems & Executive Pitch Decks',
      keywords: ['ui', 'ux', 'design', 'designer', 'figma', 'brand', 'logo', 'pitch deck', 'video', 'graphic', 'prototype', 'wireframe', 'redesign'],
      shortSprint: '₦280,000 – ₦600,000 (1–2 weeks • UX Audit, Key Screens, or Investor Pitch Deck)',
      standardProject: '₦850,000 – ₦1,800,000 (3–5 weeks • End-to-End Web & Mobile Product UI/UX)',
      complexPackage: '₦2,500,000 – ₦5,500,000+ (6–10 weeks • Multi-Platform Design System & Brand Architecture)',
      recommendedSplit: '30% Discovery, User Flows & Low-Fidelity Wireframes • 45% High-Fidelity Responsive UI & Interactive Figma Prototype • 25% Component Token Library & Developer Handoff',
      deliverables: 'User Journey Maps, Wireframes, Clickable High-Fidelity Figma Prototype, Design System (Typography, Color Tokens, Components), and Exported Assets.',
      keySkills: 'Component-driven Figma systems, mobile-first B2B/Fintech UX, dark/light theme accessibility'
    },
    {
      name: 'Finance, Accounting, Tax Advisory, Audit & Corporate Legal',
      keywords: ['finance', 'accountant', 'audit', 'tax', 'ican', 'acca', 'legal', 'lawyer', 'contract', 'ndpa', 'cac', 'financial model', 'valuation', 'due diligence', 'wht', 'vat'],
      shortSprint: '₦250,000 – ₦550,000 (1–2 weeks • Contract Drafting, Tax Review, or Regulatory Filing)',
      standardProject: '₦800,000 – ₦2,200,000 (3–5 weeks • Financial Model, Statutory Audit Prep, or Due Diligence)',
      complexPackage: '₦2,500,000 – ₦7,500,000+ (Full Corporate Audit, Transaction Advisory, or Retained Compliance)',
      recommendedSplit: '35% Data Room Diagnostic & Regulatory Gap Analysis • 40% Draft Financial Model / Audit Schedule / Legal Instruments • 25% Final Certified Report & Board Presentation',
      deliverables: 'Diagnostic Memo, Dynamic 3-Statement Financial Model or Audit Report, FIRS/CAC/NDPA Compliance Schedules, and Stamped Executive Sign-Off.',
      keySkills: 'ICAN / ACCA / NBA accreditation, IFRS standards, FIRS tax & WHT structuring, NDPA 2023 & CAMA 2020 compliance'
    }
  ];

  /* --------------------------------------------------------------------------
     3. CONTINUOUS LEARNING & NAME PERSONALIZATION MEMORY
  -------------------------------------------------------------------------- */
  function getLearnedMemory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEARNED_MEMORY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    // Check if the logged-in Collekt user has a name we can respect if they haven't set a custom nickname yet
    return {
      userName: null,
      awaitingName: false,
      askedForNameOnce: false,
      userRole: null,
      userIndustry: null,
      userBudget: null,
      questionsAskedCount: 0,
      customFacts: [],
      topicFrequency: {}
    };
  }

  function saveLearnedMemory(mem) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEARNED_MEMORY, JSON.stringify(mem));
    } catch (e) {}
  }

  function extractNameIfProvided(clean, mem) {
    const explicitMatch = clean.match(/^(?:please\s+)?(?:you can\s+)?(?:call me|my name is|i am called|i'm called|it's|its|name is)\s+([A-Za-z][A-Za-z0-9\s.-]{1,28})$/i) ||
                          clean.match(/\b(?:call me|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (explicitMatch && explicitMatch[1]) {
      return explicitMatch[1].replace(/[.!?]+$/, '').trim();
    }

    if (mem.awaitingName) {
      const words = clean.replace(/[.!?,]+$/g, '').trim().split(/\s+/);
      const isQuestionOrCommand = /\b(what|how|why|where|when|who|can|help|collekt|escrow|fee|budget|hire|job|wallet|no|skip|later|explain|draft|write|suggest)\b/i.test(clean);
      if (words.length >= 1 && words.length <= 3 && clean.length <= 28 && !isQuestionOrCommand) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return null;
  }

  function learnFromMessage(userText) {
    const mem = getLearnedMemory();
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase();

    mem.questionsAskedCount = (mem.questionsAskedCount || 0) + 1;

    const detectedName = extractNameIfProvided(clean, mem);
    let justLearnedName = false;
    if (detectedName) {
      mem.userName = detectedName;
      mem.awaitingName = false;
      mem.askedForNameOnce = true;
      justLearnedName = true;
    }

    if (/\b(we want to hire|we need a|our company|my company|i want to hire|post a job|looking for a|we are hiring)\b/i.test(lower)) {
      mem.userRole = 'company';
    } else if (/\b(i am a|i'm a|my skills|how much should i charge|how much should i bid|my cv|find work|win projects)\b/i.test(lower)) {
      mem.userRole = 'talent';
    }

    for (const fg of FEE_GUIDES) {
      if (fg.keywords.some(k => lower.includes(k))) {
        mem.userIndustry = fg.name;
        mem.topicFrequency[fg.name] = (mem.topicFrequency[fg.name] || 0) + 1;
        break;
      }
    }

    // Parse Naira amounts like "₦2.5M", "500k", "3 million", "₦1,500,000"
    const budgetMatchUnit = lower.match(/(?:₦|ngn|naira)?\s*(\d+(?:\.\d+)?)\s*(m|million|k|thousand)\b/i);
    const budgetMatchRaw = clean.match(/(?:₦|NGN)\s*([\d,]{5,})/i);
    if (budgetMatchUnit) {
      let val = parseFloat(budgetMatchUnit[1]);
      if (budgetMatchUnit[2].toLowerCase().startsWith('m')) val *= 1000000;
      else val *= 1000;
      mem.userBudget = Math.round(val);
    } else if (budgetMatchRaw) {
      const parsed = parseInt(budgetMatchRaw[1].replace(/,/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 10000) mem.userBudget = parsed;
    }

    if (/\b(remember that|note that|keep in mind that|learn this:)\b/i.test(lower)) {
      const fact = clean.replace(/^(?:please\s+)?(?:remember that|note that|keep in mind that|learn this:?)\s*/i, '').trim();
      if (fact && !mem.customFacts.includes(fact)) {
        mem.customFacts.push(fact);
      }
    }

    saveLearnedMemory(mem);
    return { mem, justLearnedName };
  }

  function appendNamePromptIfNeeded(replyText, mem) {
    const sanitized = sanitizeInternalDetails(replyText);
    if (!mem.userName && !mem.askedForNameOnce) {
      mem.awaitingName = true;
      mem.askedForNameOnce = true;
      saveLearnedMemory(mem);
      return `${sanitized}\n\n---\n*By the way, I’d love to personalize our conversations—**what would you like me to call you?***`;
    }
    if (mem.awaitingName && !mem.userName) {
      mem.awaitingName = false;
      saveLearnedMemory(mem);
    }
    return sanitized;
  }

  /* --------------------------------------------------------------------------
     4. CLAUDE-CALIBER CONVERSATIONAL REASONING ENGINE
  -------------------------------------------------------------------------- */
  async function generateReply(userText, threadHistory = []) {
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase();
    const { mem, justLearnedName } = learnFromMessage(clean);

    // 1. Immediate acknowledgment when user shares their preferred name
    if (justLearnedName && clean.split(/\s+/).length <= 6) {
      return sanitizeInternalDetails(
        `It’s a pleasure to meet you, **${mem.userName}**. I’ve noted that in my memory and will address you as **${mem.userName}** going forward.\n\nHow can I be most useful to you today? We can structure a project scope and milestone budget, benchmark Nigerian market rates for a technical role, draft a high-converting **Collektion** proposal, or walk through how Collekt’s escrow architecture works.`
      );
    }

    const nameAddress = mem.userName ? `, **${mem.userName}**` : '';

    // 2. Custom memory instruction ("Remember that...")
    if (/\b(remember that|note that|keep in mind that|learn this:)\b/i.test(lower)) {
      return sanitizeInternalDetails(
        `Understood${nameAddress}. I’ve committed that to your context profile:\n\n> *"${mem.customFacts[mem.customFacts.length - 1]}"*\n\nI will factor this into every commercial estimate, project scope, and recommendation we work on together. What shall we tackle next?`
      );
    }

    // 3. Memory inspection ("What do you know about me?")
    if (/\b(what do you know about me|what is my name|what have you learned|do you remember me|my memory)\b/i.test(lower)) {
      const factsList = mem.customFacts.length
        ? mem.customFacts.map(f => `* "${f}"`).join('\n')
        : '* No custom preferences recorded yet (you can tell me *"Remember that..."* at any time).';
      return sanitizeInternalDetails(
        `Here is the context I currently hold from our conversations:\n\n* **Preferred Name:** ${mem.userName || 'Not set yet (tell me *"Call me [Name]"* anytime)'}\n* **Interactions Completed:** ${mem.questionsAskedCount}\n* **Primary Perspective:** ${mem.userRole ? (mem.userRole === 'company' ? 'Hiring Company / Project Sponsor' : 'Independent Specialist / Contractor') : 'Platform Explorer'}\n* **Domain Focus:** ${mem.userIndustry || 'Cross-Disciplinary B2B & Engineering'}\n* **Reference Budget:** ${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'None specified yet'}\n\n**Custom Instructions & Notes:**\n${factsList}`
      );
    }

    // 4. Live LLM Reasoning (if Gemini key or backend is available) with strict Claude Executive Persona
    const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
    if (apiKey && apiKey.startsWith('AIza')) {
      try {
        const recentTurns = threadHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Kolly'}: ${m.content}`).join('\n');
        const claudeSystemPrompt = `You are Kolly, the Senior Executive & Technical Advisor for Collekt, Nigeria's verified B2B project marketplace and milestone-escrow platform.
Think, reason, and write with the analytical clarity, calm authority, nuance, and executive polish of Anthropic's Claude.
CRITICAL SECURITY & PRIVACY RULES:
1. NEVER mention, output, or disclose any internal filenames or extensions such as .html, .js, .css, post-job.html, wallet.html, dashboard.html, etc.
2. Always refer to platform sections exclusively by their clean UI names: **Overview**, **Marketplace**, **Post Opportunity**, **Collektions**, **Messages**, **Wallet**, and **Profile**.
3. Ground all commercial, legal, tax, and engineering advice in authentic Nigerian market realities (Naira ₦ pricing, CBN-licensed NUBAN escrow rails, COREN/ICAN/NBA accreditations, FIRS WHT/VAT, and the Arbitration and Mediation Act 2023).
Preferred User Name: ${mem.userName || 'not yet specified'}.
Learned User Context: Role=${mem.userRole || 'unspecified'}, Domain=${mem.userIndustry || 'general'}, Budget=${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'unspecified'}, Notes=${mem.customFacts.join('; ')}.`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${claudeSystemPrompt}\n\nConversation History:\n${recentTurns}\n\nUser: ${clean}` }] }]
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) return appendNamePromptIfNeeded(aiText, mem);
        }
      } catch (e) {}
    }

    // 5. Specialized Intent: Tax, WHT & VAT Calculations on a Contract Amount
    if (/\b(tax|wht|withholding|vat|net payout|deduction|firs)\b/i.test(lower)) {
      const gross = mem.userBudget || 2500000;
      const vat = Math.round(gross * 0.075);
      const whtCorp = Math.round(gross * 0.10);
      const whtInd = Math.round(gross * 0.05);
      const ans = `### Nigerian Commercial Tax & Escrow Settlement Breakdown

Using a reference contract value of **₦${gross.toLocaleString()}**${mem.userBudget ? ' (from the figure you mentioned)' : ' (tell me your exact Naira contract sum and I will recalculate instantly)'}, here is how statutory deductions and net settlements work in Nigeria:

* **Gross Contract Sum:** \`₦${gross.toLocaleString()}\`
* **Value Added Tax (VAT @ 7.5%):** \`₦${vat.toLocaleString()}\` *(Typically added on top of the gross fee on corporate invoices and remitted to FIRS)*
* **Withholding Tax (WHT):**
  * **Corporate / Technical / Consultancy (10%):** \`₦${whtCorp.toLocaleString()}\` *(Remitted as a tax credit note to the vendor’s TIN)*
  * **Individual Specialist / Direct Supply (5%):** \`₦${whtInd.toLocaleString()}\`

#### Strategic Advice for Structuring Your Contract
1. **State Net vs. Gross Clearly in Your Collektion:** Always specify in your milestone description whether your quoted Naira figure is *exclusive* or *inclusive* of 7.5% VAT and WHT so there is zero ambiguity at milestone sign-off.
2. **Founding 50 Fee Waiver:** If the hiring company is enrolled in the **Collekt Founding 50 Pilot**, the platform escrow fee is **0%** on their first 3 projects.`;
      return appendNamePromptIfNeeded(ans, mem);
    }

    // 6. Specialized Intent: Drafting a Scope of Work (SOW) or Proposal ("Collektion")
    const wantsDraftOrProposal = /\b(draft|write|prepare|create|sample|template)\b/i.test(lower) && /\b(proposal|collektion|pitch|scope|sow|brief|description|agreement)\b/i.test(lower);
    let matchedFeeGuide = null;
    for (const fg of FEE_GUIDES) {
      if (fg.keywords.some(k => lower.includes(k))) {
        matchedFeeGuide = fg;
        break;
      }
    }

    if (wantsDraftOrProposal) {
      const domain = matchedFeeGuide ? matchedFeeGuide.name : (mem.userIndustry || 'Technical & Professional Services');
      const deliverables = matchedFeeGuide ? matchedFeeGuide.deliverables : '1. Technical Discovery & Specification Memo, 2. Core Execution & Quality Assurance Logs, 3. Final Handover & Sign-Off Package.';
      const split = matchedFeeGuide ? matchedFeeGuide.recommendedSplit : '30% Mobilization & Specification • 40% Core Execution & Review • 30% Final Testing & Handover';
      const total = mem.userBudget || 2000000;

      const ans = `### Executive Draft: Structured Scope & Milestone Schedule (${domain})

Here is a clean, professional structure${nameAddress} that you can use directly in **Collektions** (if bidding as a specialist) or **Post Opportunity** (if publishing a brief as a company):

#### 1. Executive Summary & Objective
> Delivery of a fully verified **${domain}** work package executed to industry quality standards, structured under Collekt Milestone Escrow to guarantee timeline adherence and deliverable quality.

#### 2. Key Technical Deliverables
* ${deliverables}

#### 3. Proposed 3-Stage Milestone Escrow Schedule (Reference Total: ₦${total.toLocaleString()})
* **Milestone 1 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Discovery, Technical Specification & Mobilization**
  * *Acceptance Criteria:* Client sign-off on the execution plan, architecture/drawings, and baseline schedule.
* **Milestone 2 — 40% (\`₦${Math.round(total * 0.40).toLocaleString()}\`): Core Execution & Interim Quality Inspection**
  * *Acceptance Criteria:* Submission of primary work product / staging build / engineering package for technical review.
* **Milestone 3 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Final Verification, Testing & Handover**
  * *Acceptance Criteria:* Resolution of review comments, final sign-off, and full transfer of documentation/source files.

*If you share the specific project title, timeline, or target Naira budget, I will tailor this draft word-for-word to your exact brief.*`;
      return appendNamePromptIfNeeded(ans, mem);
    }

    // 7. Commercial Pricing, Fee Estimation & Milestone Structuring
    const asksAboutFeeOrScope = /\b(fee|price|cost|charge|budget|how much|estimate|rate|salary|scope|milestone|hire|need a|looking for|bid)\b/i.test(lower);

    if (matchedFeeGuide && asksAboutFeeOrScope) {
      const budgetNote = mem.userBudget
        ? `\n\n#### Tailored Escrow Allocation for Your ₦${mem.userBudget.toLocaleString()} Budget\n* **Milestone 1 (30% — \`₦${Math.round(mem.userBudget * 0.3).toLocaleString()}\`):** Technical specification, mobilization & initial design sign-off.\n* **Milestone 2 (40% — \`₦${Math.round(mem.userBudget * 0.4).toLocaleString()}\`):** Core execution, interim inspection & verification.\n* **Milestone 3 (30% — \`₦${Math.round(mem.userBudget * 0.3).toLocaleString()}\`):** Final testing, commissioning & complete handover.`
        : '';

      const ans = `### Commercial Benchmark & Escrow Architecture: ${matchedFeeGuide.name}

${mem.userName ? `Here is an executive breakdown for you, **${mem.userName}**, based` : 'Based'} on current Nigerian B2B contracting benchmarks on **Collekt**:

* **Diagnostic / Short Sprint (1–2 Weeks):** \`${matchedFeeGuide.shortSprint}\`
* **Standard Turnkey Execution (3–6 Weeks):** \`${matchedFeeGuide.standardProject}\`
* **Complex / Senior Work Package (2–3 Months):** \`${matchedFeeGuide.complexPackage}\`

#### Recommended Milestone Escrow Structure
* **${matchedFeeGuide.recommendedSplit}**
* **Expected Deliverables:** ${matchedFeeGuide.deliverables}${budgetNote}

#### Technical Vetting Criteria
* **Credentials & Standards to Require:** ${matchedFeeGuide.keySkills}
* **How to Proceed:** Publish this scope under **Post Opportunity** in your sidebar (or submit this milestone structure inside **Collektions** if you are bidding as a specialist).`;

      return appendNamePromptIfNeeded(ans, mem);
    }

    // 8. Core Platform Knowledge Topics
    for (const key of Object.keys(COLLEKT_KNOWLEDGE)) {
      const sec = COLLEKT_KNOWLEDGE[key];
      if (sec.patterns.some(p => lower.includes(p))) {
        return appendNamePromptIfNeeded(sec.answer, mem);
      }
    }

    // 9. Domain Mentioned Without Explicit Fee Keyword
    if (matchedFeeGuide) {
      const ans = `### ${matchedFeeGuide.name} on Collekt

Here is how projects in **${matchedFeeGuide.name}** are structured and benchmarked on the platform${nameAddress}:

* **Standard Engagement Benchmark (3–6 Weeks):** \`${matchedFeeGuide.standardProject}\` (or \`${matchedFeeGuide.shortSprint}\` for a focused 1–2 week diagnostic sprint).
* **Recommended Escrow Split:** ${matchedFeeGuide.recommendedSplit}.
* **Core Deliverables:** ${matchedFeeGuide.deliverables}
* **Vetting Standard:** ${matchedFeeGuide.keySkills}.

Would you like me to **draft a complete project brief** for this role, **write a winning Collektion proposal**, or **break down a specific Naira budget** into escrow milestones?`;
      return appendNamePromptIfNeeded(ans, mem);
    }

    // 10. Executive Synthesis Fallback (Claude-style helpful, analytical response)
    const fallback = `${mem.userName ? `Certainly, **${mem.userName}**. ` : ''}I can help you approach that strategically. As Collekt’s advisor, here are the most effective ways we can work together right now:

1. **Scope & Price a Project in Naira (\`₦\`):** Tell me what you are building or procuring—for example, *"We need a COREN Piping Engineer for a 4-week tie-in design"* or *"Scope a fintech mobile app with a ₦3.5M budget"*—and I will give you realistic Nigerian market rates and a 3-stage Milestone Escrow schedule.
2. **Draft a High-Converting "Collektion" or Project Brief:** Ask me to write a complete technical scope of work, milestone acceptance criteria, or executive proposal pitch tailored to your discipline.
3. **Navigate Escrow, Verification & Settlement:** Ask how **Dedicated Virtual Accounts (NUBAN)**, milestone sign-offs, Nigerian WHT/VAT deductions, or **Collekt Shield** verification work—and I will walk you through the exact steps using your sidebar (**Overview**, **Marketplace**, **Collektions**, **Messages**, **Wallet**, and **Profile**).`;

    return appendNamePromptIfNeeded(fallback, mem);
  }

  /* --------------------------------------------------------------------------
     5. THREAD / CHAT HISTORY STORAGE (WITH AUTOMATIC SANITIZATION)
  -------------------------------------------------------------------------- */
  function getThreads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.THREADS);
      if (raw) {
        const parsed = JSON.parse(raw);
        let modified = false;
        // Automatically sanitize any legacy messages in localStorage that contained .html
        parsed.forEach(thread => {
          if (Array.isArray(thread.messages)) {
            thread.messages.forEach(msg => {
              if (msg.content && /\.html\b/i.test(msg.content)) {
                msg.content = sanitizeInternalDetails(msg.content);
                modified = true;
              }
            });
          }
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveThreads(threads) {
    try {
      localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(threads));
    } catch (e) {}
  }

  function createNewThread() {
    const threads = getThreads();
    const newThread = {
      id: 'chat_' + Date.now(),
      title: 'New chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    threads.unshift(newThread);
    saveThreads(threads);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_THREAD, newThread.id);
    return newThread;
  }

  function deleteThread(threadId) {
    let threads = getThreads().filter(t => t.id !== threadId);
    saveThreads(threads);
    return threads;
  }

  global.KollyEngine = {
    getThreads,
    saveThreads,
    createNewThread,
    deleteThread,
    getLearnedMemory,
    generateReply,
    sanitizeInternalDetails
  };
})(window);
