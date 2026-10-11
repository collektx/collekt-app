/* ============================================================================
   KOLLY AI — EXECUTIVE REASONING & CONTINUOUS LEARNING ENGINE (v4.0)
   Claude-Caliber Professional Intelligence for Collekt (collektng.com)
   - 2-Second Deliberate Thinking Cadence & Context-Aligned Responses
   - Natural Conversational Intelligence (Gratitude, Greetings, Follow-ups)
   - Strict Zero-Disclosure of Internal Filenames (.html, .js, .css)
   - Proactive Name Personalization & Persistent Conversational Memory
============================================================================ */

(function (global) {
  const STORAGE_KEYS = {
    THREADS: 'kolly_chatgpt_threads_v2',
    ACTIVE_THREAD: 'kolly_chatgpt_active_thread_v2',
    LEARNED_MEMORY: 'kolly_learned_knowledge_v2',
    GEMINI_KEY: 'collekt_gemini_api_key'
  };

  const THINKING_DURATION_MS = 2000;

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
      if (/\.html\b/i.test(url)) {
        return `**${cleanLabel}**`;
      }
      return match;
    });

    out = out.replace(/\(using\s+[a-z0-9_-]+\.html\)/gi, '(via **Post Opportunity**)');
    for (const [file, friendly] of Object.entries(PAGE_NAME_MAP)) {
      const escaped = file.replace('.', '\\.');
      const regex = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:collektng\\.com\\/)?\\b${escaped}\\b`, 'gi');
      out = out.replace(regex, friendly);
    }

    out = out.replace(/(?:https?:\/\/)?(?:www\.)?(?:collektng\.com\/)?\b([a-z0-9_-]+)\.(?:html|js|css)\b/gi, (_, name) => {
      const clean = name.replace(/[-_]/g, ' ');
      return `**${clean.charAt(0).toUpperCase() + clean.slice(1)}**`;
    });

    return out;
  }

  /* --------------------------------------------------------------------------
     1. SESSION USER & PERSISTENT MEMORY HELPERS
  -------------------------------------------------------------------------- */
  function getSessionUser() {
    try {
      const u = JSON.parse(localStorage.getItem('collekt_user') || 'null');
      if (u && typeof u === 'object') return u;
    } catch (e) {}
    return null;
  }

  function getSessionFirstName() {
    const u = getSessionUser();
    const rawName = u && (u.name || u.full_name || u.company_name);
    if (!rawName || typeof rawName !== 'string') return null;
    const cleaned = rawName.trim();
    if (!cleaned || cleaned.includes('@')) return null;
    return cleaned.split(/\s+/)[0];
  }

  function getLearnedMemory() {
    let mem = {
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
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEARNED_MEMORY);
      if (raw) {
        mem = Object.assign(mem, JSON.parse(raw));
      }
    } catch (e) {}

    // Sync role from active Collekt session if not yet learned
    const sessionUser = getSessionUser();
    if (sessionUser && !mem.userRole && sessionUser.role) {
      mem.userRole = sessionUser.role === 'company' ? 'company' : 'talent';
    }
    // Clear any accidental conversational phrase that was ever saved as userName
    if (mem.userName && /^(thank|thanks|hello|hi|hey|ok|okay|yes|no|sure|good|great|nice|cool|alright|please|welcome)/i.test(mem.userName.trim())) {
      mem.userName = null;
    }
    return mem;
  }

  function saveLearnedMemory(mem) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEARNED_MEMORY, JSON.stringify(mem));
    } catch (e) {}
  }

  function getEffectiveUserName(mem) {
    return (mem && mem.userName) || getSessionFirstName() || null;
  }

  /* --------------------------------------------------------------------------
     2. COMMERCIAL BENCHMARKS & PROJECT SCOPING MODELS (NAIRA ₦)
  -------------------------------------------------------------------------- */
  const FEE_GUIDES = [
    {
      name: 'Oil, Gas, Subsea, Piping & Mechanical Engineering',
      keywords: ['subsea', 'piping', 'pipeline', 'offshore', 'epc', 'mechanical', 'process', 'coren', 'rig', 'oil', 'gas', 'welding', 'hazop', 'ndt', 'instrumentation', 'turbine', 'rotating equipment', 'cathodic'],
      shortSprint: '₦650,000 – ₦1,200,000 (1–2 weeks • Technical Audit / P&ID Review / Stress Check)',
      standardProject: '₦1,800,000 – ₦3,500,000 (3–6 weeks • Full Engineering Package / Isometrics / Tie-In Spec)',
      complexPackage: '₦5,000,000 – ₦14,500,000+ (2–3 months • Multi-Discipline FEED / EPC Work Package)',
      recommendedSplit: '30% Basis of Design & P&ID Verification • 40% 3D Modeling, Stress Analysis & Isometrics • 30% AFC COREN-Stamped Handover',
      deliverables: 'Basis of Design (BOD), P&IDs, Pipe Stress Analysis Report (Caesar II), Isometric Drawings, and Material Take-Off (MTO) / BOQ.',
      keySkills: 'COREN Registration, AutoCAD Plant 3D, Caesar II, PDMS/E3D, ASME B31.3 / API compliance, NUPRC/NCDMB familiarity'
    },
    {
      name: 'Civil, Structural, Electrical, Commercial Solar & HSE',
      keywords: ['civil', 'solar', 'electrical', 'inverter', 'construction', 'boq', 'quantity surveyor', 'architect', 'hse', 'safety', 'building', 'warehouse', 'substation', 'structural', 'foundation', 'surveying', 'geotechnical', 'hvac'],
      shortSprint: '₦400,000 – ₦850,000 (1–2 weeks • Site Assessment, Load Audit & Itemized BOQ)',
      standardProject: '₦1,350,000 – ₦2,600,000 (3–6 weeks • Detailed Structural/Electrical Design & Supervision)',
      complexPackage: '₦4,000,000 – ₦11,000,000+ (2–3 months • Full Turnkey Civil/Solar EPC Supervision)',
      recommendedSplit: '30% Site Survey, Load/Soil Audit & Priced BOQ • 40% Detailed Engineering Drawings & Procurement Spec • 30% Testing, Commissioning & As-Built Sign-Off',
      deliverables: 'Site Survey Report, Structural/Single-Line Diagrams, Itemized Bill of Quantities (BOQ), QA/QC Inspection Logs, and Commissioning Certificate.',
      keySkills: 'COREN / NIQS / NEMSA / NEBOSH HSE certifications, Eurocode/BS structural standards, commercial BOQ costing'
    },
    {
      name: 'Software Engineering, Fintech, Web, Mobile & AI Systems',
      keywords: ['software', 'developer', 'app', 'mobile', 'website', 'web', 'frontend', 'backend', 'fullstack', 'react', 'node', 'python', 'flutter', 'fintech', 'api', 'cybersecurity', 'qa', 'platform', 'mvp', 'saas', 'devops', 'cloud', 'database'],
      shortSprint: '₦450,000 – ₦900,000 (1–2 weeks • Feature Sprint, API Integration, or Security Audit)',
      standardProject: '₦1,500,000 – ₦3,200,000 (3–6 weeks • Production Web/Mobile MVP or Core System Build)',
      complexPackage: '₦4,500,000 – ₦12,000,000+ (2–3 months • Full Enterprise Platform, Fintech Ledger, or Multi-App Ecosystem)',
      recommendedSplit: '25% System Architecture, Database Schema & Staging Prototype • 50% Core Backend APIs, Payment/Auth Integration & Frontend Build • 25% Automated QA, Security Hardening & Production Deployment',
      deliverables: 'System Architecture Document, Interactive Staging Deployment, Full Git Repository & CI/CD Pipeline, API Documentation, and Post-Launch Handover.',
      keySkills: 'Production GitHub track record, clean API architecture, Paystack/KoraPay/NIBSS integration experience, OWASP security & automated testing'
    },
    {
      name: 'Product Design (UI/UX), Brand Systems & Executive Pitch Decks',
      keywords: ['ui', 'ux', 'design', 'designer', 'figma', 'brand', 'logo', 'pitch deck', 'video', 'graphic', 'prototype', 'wireframe', 'redesign', 'motion', '3d'],
      shortSprint: '₦280,000 – ₦600,000 (1–2 weeks • UX Audit, Key Screens, or Investor Pitch Deck)',
      standardProject: '₦850,000 – ₦1,800,000 (3–5 weeks • End-to-End Web & Mobile Product UI/UX)',
      complexPackage: '₦2,500,000 – ₦5,500,000+ (6–10 weeks • Multi-Platform Design System & Brand Architecture)',
      recommendedSplit: '30% Discovery, User Flows & Low-Fidelity Wireframes • 45% High-Fidelity Responsive UI & Interactive Figma Prototype • 25% Component Token Library & Developer Handoff',
      deliverables: 'User Journey Maps, Wireframes, Clickable High-Fidelity Figma Prototype, Design System (Typography, Color Tokens, Components), and Exported Assets.',
      keySkills: 'Component-driven Figma systems, mobile-first B2B/Fintech UX, dark/light theme accessibility'
    },
    {
      name: 'Finance, Accounting, Tax Advisory, Audit & Corporate Legal',
      keywords: ['finance', 'accountant', 'accounting', 'audit', 'tax', 'ican', 'acca', 'legal', 'lawyer', 'contract', 'ndpa', 'cac', 'financial model', 'valuation', 'due diligence', 'wht', 'vat', 'cfo', 'bookkeeping'],
      shortSprint: '₦250,000 – ₦550,000 (1–2 weeks • Contract Drafting, Tax Review, or Regulatory Filing)',
      standardProject: '₦800,000 – ₦2,200,000 (3–5 weeks • Financial Model, Statutory Audit Prep, or Due Diligence)',
      complexPackage: '₦2,500,000 – ₦7,500,000+ (Full Corporate Audit, Transaction Advisory, or Retained Compliance)',
      recommendedSplit: '35% Data Room Diagnostic & Regulatory Gap Analysis • 40% Draft Financial Model / Audit Schedule / Legal Instruments • 25% Final Certified Report & Board Presentation',
      deliverables: 'Diagnostic Memo, Dynamic 3-Statement Financial Model or Audit Report, FIRS/CAC/NDPA Compliance Schedules, and Stamped Executive Sign-Off.',
      keySkills: 'ICAN / ACCA / NBA accreditation, IFRS standards, FIRS tax & WHT structuring, NDPA 2023 & CAMA 2020 compliance'
    },
    {
      name: 'Data Analytics, Business Intelligence, Operations & Project Management',
      keywords: ['data', 'analyst', 'analytics', 'power bi', 'tableau', 'sql', 'excel', 'project manager', 'pmp', 'scrum', 'operations', 'supply chain', 'procurement', 'logistics', 'hr', 'recruitment', 'strategy', 'consultant', 'marketing', 'seo', 'content', 'copywriter'],
      shortSprint: '₦300,000 – ₦650,000 (1–2 weeks • Diagnostic Audit, KPI Dashboard, or Operational Playbook)',
      standardProject: '₦900,000 – ₦2,100,000 (3–6 weeks • End-to-End Implementation, BI Pipeline, or Project Delivery)',
      complexPackage: '₦2,800,000 – ₦6,500,000+ (2–3 months • Enterprise Transformation, PMO Setup, or Multi-Unit Rollout)',
      recommendedSplit: '30% Baseline Audit, Requirements & KPI Framework • 45% Core Implementation, Dashboards & Process Execution • 25% Team Handover, Documentation & Performance Sign-Off',
      deliverables: 'Diagnostic & Strategy Blueprint, Live Dashboards / Trackers / SOPs, Execution Reports, and Handover Documentation.',
      keySkills: 'PMP / PRINCE2 / CBAP / BI certifications, measurable ROI track record, Nigerian corporate & industrial execution experience'
    }
  ];

  /* --------------------------------------------------------------------------
     3. CONTINUOUS LEARNING & NAME EXTRACTION
  -------------------------------------------------------------------------- */
  const NON_NAME_WORDS = /^(thank|thanks|thank\s+you|thx|ty|appreciate|hello|hi|hey|yo|good\s+morning|good\s+afternoon|good\s+evening|ok|okay|k|alright|got\s+it|understood|sure|yes|yeah|yep|no|nope|nah|cool|great|nice|awesome|perfect|fine|well\s+done|weldone|bye|goodbye|later|help|please|what|how|why|where|when|who|can|collekt|escrow|fee|budget|hire|job|wallet|skip|explain|draft|write|suggest|test|testing)$/i;

  function extractNameIfProvided(clean, mem) {
    const explicitMatch = clean.match(/^(?:please\s+)?(?:you can\s+)?(?:call me|my name is|i am called|i'm called|name is)\s+([A-Za-z][A-Za-z0-9\s.-]{1,24})$/i) ||
                          clean.match(/\b(?:call me|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (explicitMatch && explicitMatch[1]) {
      const candidate = explicitMatch[1].replace(/[.!?,]+$/, '').trim();
      if (!NON_NAME_WORDS.test(candidate)) {
        return candidate;
      }
    }

    if (mem.awaitingName) {
      const stripped = clean.replace(/[.!?,]+$/g, '').trim();
      const words = stripped.split(/\s+/);
      const hasNonName = NON_NAME_WORDS.test(stripped) ||
                         /\b(thank|thanks|hello|hi|hey|ok|okay|yes|no|what|how|why|where|when|who|can|help|collekt|escrow|fee|budget|hire|job|wallet|skip|later|explain|draft|write|suggest|need|want|looking|work|project|money|account)\b/i.test(stripped);
      if (words.length >= 1 && words.length <= 2 && stripped.length >= 2 && stripped.length <= 22 && !hasNonName && /^[A-Za-z\s-]+$/.test(stripped)) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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
    } else if (mem.awaitingName) {
      // User replied with a normal message instead of a name; don't trap them in awaitingName
      mem.awaitingName = false;
    }

    if (/\b(we want to hire|we need a|our company|my company|i want to hire|post a job|post an opportunity|looking for a|we are hiring)\b/i.test(lower)) {
      mem.userRole = 'company';
    } else if (/\b(i am a|i'm a|my skills|how much should i charge|how much should i bid|my cv|find work|win projects|win a project|get hired)\b/i.test(lower)) {
      mem.userRole = 'talent';
    }

    for (const fg of FEE_GUIDES) {
      if (fg.keywords.some(k => lower.includes(k))) {
        mem.userIndustry = fg.name;
        mem.topicFrequency[fg.name] = (mem.topicFrequency[fg.name] || 0) + 1;
        break;
      }
    }

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

  function appendNamePromptIfNeeded(replyText, mem, skipNamePrompt = false) {
    const sanitized = sanitizeInternalDetails(replyText);
    if (skipNamePrompt) return sanitized;

    if (!mem.userName && !mem.askedForNameOnce) {
      mem.awaitingName = true;
      mem.askedForNameOnce = true;
      saveLearnedMemory(mem);
      const sessionFirst = getSessionFirstName();
      if (sessionFirst) {
        return `${sanitized}\n\n---\n*By the way, I see you’re signed in as **${sessionFirst}**—should I call you **${sessionFirst}**, or is there another name you prefer?*`;
      }
      return `${sanitized}\n\n---\n*By the way, I’d love to personalize our conversations—**what would you like me to call you?***`;
    }
    return sanitized;
  }

  /* --------------------------------------------------------------------------
     4. CORE CONVERSATIONAL & DOMAIN REASONING (100% ALIGNED WITH USER INPUT)
  -------------------------------------------------------------------------- */
  async function computeAlignedReply(userText, threadHistory = []) {
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase().replace(/[.!?]+$/g, '').trim();
    const { mem, justLearnedName } = learnFromMessage(clean);

    const effectiveName = getEffectiveUserName(mem);
    const nameAddress = effectiveName ? `, **${effectiveName}**` : '';

    // Find the last assistant message in threadHistory for contextual continuity
    let lastAssistantMsg = '';
    for (let i = threadHistory.length - 1; i >= 0; i--) {
      if (threadHistory[i] && threadHistory[i].role === 'assistant' && threadHistory[i].content) {
        lastAssistantMsg = threadHistory[i].content;
        break;
      }
    }

    // 1. User just shared their preferred name (or confirmed "Yes, call me Dave")
    if (justLearnedName && clean.split(/\s+/).length <= 6) {
      return sanitizeInternalDetails(
        `Pleasure to meet you, **${mem.userName}**! I’ve saved that and will address you as **${mem.userName}** from now on.\n\nWhat would you like to tackle today? Whether you want to win a project in the **Marketplace**, structure a **Collektion** proposal, or price a milestone scope in Naira (\`₦\`), I’m ready.`
      );
    }

    // 2. GRATITUDE & APPRECIATION ("thank you", "thanks", "appreciate it", "that helps", "well done", etc.)
    const isGratitude = /^(?:thank\s*you|thanks|thank\s*u|thx|ty|many\s*thanks|thanks\s*a\s*lot|thank\s*you\s*so\s*much|thank\s*you\s*very\s*much|thank\s*you\s*kolly|thanks\s*kolly|i\s*appreciate(?:\s*it|\s*that)?|appreciate\s*it|appreciated|grateful|that\s*helps(?:\s*a\s*lot)?|very\s*helpful|super\s*helpful|well\s*done|weldone|good\s*job|great\s*job)\b/i.test(lower) ||
                        (clean.split(/\s+/).length <= 6 && /\b(thank\s*you|thanks|appreciate\s*it)\b/i.test(lower) && !/\b(how|what|where|why|when|can|could|help\s+me)\b/i.test(lower));

    if (isGratitude) {
      let contextFollowUp = `Whenever you want to review an opportunity in the **Marketplace**, draft a **Collektion** proposal, or check a milestone budget, just reach out—I’m right here.`;
      if (/wallet|withdraw|nuban|escrow/i.test(lastAssistantMsg)) {
        contextFollowUp = `If you need any help setting up your **Wallet**, verifying a milestone, or preparing your next **Collektion**, just let me know anytime.`;
      } else if (/₦|milestone|benchmark|scope/i.test(lastAssistantMsg)) {
        contextFollowUp = `Whenever you're ready to turn that scope into a live brief or a **Collektion** proposal, just say the word.`;
      } else if (/profile|shield|verify|nin/i.test(lastAssistantMsg)) {
        contextFollowUp = `Good luck completing your **Profile** verification—let me know once you're ready to pitch for your first project!`;
      }
      return sanitizeInternalDetails(
        `You're very welcome${nameAddress}! I'm glad that was helpful. ${contextFollowUp}`
      );
    }

    // 3. GREETINGS & CHECK-INS ("hello", "hi", "hey", "good morning", "how are you", "how far", etc.)
    const isGreeting = /^(?:hello|hi|hey|hi\s+there|hello\s+there|hey\s+kolly|hi\s+kolly|hello\s+kolly|good\s*morning|good\s*afternoon|good\s*evening|greetings|how\s*are\s*you(?:\s*doing)?|how\s*far|what'?s\s*up|are\s*you\s*there|yo)\b/i.test(lower) &&
                       clean.split(/\s+/).length <= 7 &&
                       !/\b(explain|what\s+is|how\s+does|how\s+do\s+i|how\s+much|fee|price|escrow|wallet|hire|job|bid)\b/i.test(lower);

    if (isGreeting) {
      const asksHowAreYou = /how\s*are\s*you|how\s*far|what'?s\s*up/i.test(lower);
      let timeGreeting = 'Hello';
      if (/morning/i.test(lower)) timeGreeting = 'Good morning';
      else if (/afternoon/i.test(lower)) timeGreeting = 'Good afternoon';
      else if (/evening/i.test(lower)) timeGreeting = 'Good evening';

      const statusLine = asksHowAreYou
        ? `I'm doing very well and ready to assist you!`
        : `Great to have you here on Collekt.`;

      const roleHint = mem.userRole === 'company'
        ? `Are you looking to scope and post a new opportunity today, benchmark Naira rates for a specialist, or review incoming **Collektions**?`
        : `Would you like help winning your next project in the **Marketplace**, writing a standout **Collektion** proposal, or checking Nigerian market fees for your discipline?`;

      return appendNamePromptIfNeeded(
        `${timeGreeting}${nameAddress}! ${statusLine}\n\n${roleHint}`,
        mem
      );
    }

    // 4. SHORT AFFIRMATIONS & ACKNOWLEDGMENTS ("ok", "okay", "alright", "got it", "understood", "cool", "great", "nice", "makes sense", "i see")
    const isAffirmation = /^(?:ok|okay|k|kk|alright|all\s*right|got\s*it|i\s*get\s*it|understood|i\s*understand|makes\s*sense|that\s*makes\s*sense|i\s*see|cool|nice|great|awesome|perfect|sounds\s*good|fair\s*enough|noted|clear)\b/i.test(lower) &&
                          clean.split(/\s+/).length <= 5;

    if (isAffirmation) {
      return sanitizeInternalDetails(
        `Sounds good${nameAddress}. Take your time—if you'd like me to draft a proposal, calculate a milestone budget in Naira (\`₦\`), or walk through anything else on the platform, just let me know.`
      );
    }

    // 5. POSITIVE CONFIRMATION ("yes", "yeah", "sure", "please do", "go ahead", "let's do it")
    const isYes = /^(?:yes|yeah|yep|yup|sure|please\s*do|yes\s*please|go\s*ahead|let'?s\s*do\s*it|do\s*it|proceed|i\s*would\s*like\s*that)\b/i.test(lower) &&
                  clean.split(/\s+/).length <= 6;

    if (isYes) {
      // Check if previous turn was asking whether to use their session first name
      const sessionFirst = getSessionFirstName();
      if (sessionFirst && /should I call you/i.test(lastAssistantMsg)) {
        mem.userName = sessionFirst;
        mem.awaitingName = false;
        mem.askedForNameOnce = true;
        saveLearnedMemory(mem);
        return sanitizeInternalDetails(
          `Wonderful, **${sessionFirst}**—I'll address you as **${sessionFirst}** going forward. What project or question can I help you with right now?`
        );
      }

      // If previous assistant message offered to draft a brief, Collektion, or milestone breakdown
      if (/draft|collektion|brief|milestone|₦/i.test(lastAssistantMsg)) {
        const domain = mem.userIndustry || 'Technical & Professional Services';
        const total = mem.userBudget || 1800000;
        return sanitizeInternalDetails(
          `Here is a ready-to-use **3-Stage Milestone & Collektion Structure**${nameAddress} (using a reference budget of **₦${total.toLocaleString()}** for **${domain}**):\n\n` +
          `* **Milestone 1 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Discovery, Technical Specification & Mobilization**\n` +
          `  * *Deliverable:* Approved execution plan, technical specification, and schedule sign-off.\n` +
          `* **Milestone 2 — 40% (\`₦${Math.round(total * 0.40).toLocaleString()}\`): Core Execution & Quality Review**\n` +
          `  * *Deliverable:* Primary work package / staging build submitted for client inspection.\n` +
          `* **Milestone 3 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Final Testing, Sign-Off & Handover**\n` +
          `  * *Deliverable:* Completed deliverables, documentation, and final handover.\n\n` +
          `Tell me the **exact role or project title** (and your preferred Naira figure) if you'd like me to customize the wording for your specific brief.`
        );
      }

      return sanitizeInternalDetails(
        `Let's do it${nameAddress}. Tell me the specific project role, question, or Naira (\`₦\`) budget you have in mind, and I'll give you a tailored breakdown right away.`
      );
    }

    // 6. DECLINING / CLOSING ("no", "nope", "not now", "nothing else", "that's all", "bye", "goodbye")
    const isNoOrBye = /^(?:no|nope|nah|not\s*now|not\s*right\s*now|nothing(?:\s*for\s*now|\s*else)?|no\s*thanks|no\s*thank\s*you|that'?s\s*all|i'?m\s*good|all\s*good|bye|goodbye|see\s*you|talk\s*later|later)\b/i.test(lower) &&
                      clean.split(/\s+/).length <= 6;

    if (isNoOrBye) {
      return sanitizeInternalDetails(
        `All set${nameAddress}. Wishing you a productive session on Collekt—I'm right here whenever you need a sounding board.`
      );
    }

    // 7. Custom Memory Instruction ("Remember that...")
    if (/\b(remember that|note that|keep in mind that|learn this:)\b/i.test(lower)) {
      return sanitizeInternalDetails(
        `Understood${nameAddress}. I’ve saved that to your profile context:\n\n> *"${mem.customFacts[mem.customFacts.length - 1]}"*\n\nI will factor this into our project scopes, fee estimates, and recommendations going forward.`
      );
    }

    // 8. Memory / Identity Inspection ("What do you know about me?", "What is my name?", "Who am I?")
    if (/\b(what do you know about me|what is my name|do you know my name|who am i|what have you learned|do you remember me|my memory)\b/i.test(lower)) {
      const factsList = mem.customFacts.length
        ? mem.customFacts.map(f => `* "${f}"`).join('\n')
        : '* No custom notes saved yet (you can tell me *"Remember that..."* anytime).';
      return sanitizeInternalDetails(
        `Here is what I currently know from your session${nameAddress}:\n\n` +
        `* **Name:** ${effectiveName || 'Not set yet (tell me *"Call me [Name]"* anytime)'}\n` +
        `* **Account Perspective:** ${mem.userRole === 'company' ? 'Hiring Company / Project Sponsor' : 'Professional / Independent Specialist'}\n` +
        `* **Primary Domain Focus:** ${mem.userIndustry || 'B2B Engineering, Technology & Consulting'}\n` +
        `* **Reference Budget:** ${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'None specified yet'}\n` +
        `* **Questions Explored Together:** ${mem.questionsAskedCount}\n\n` +
        `**Saved Notes:**\n${factsList}`
      );
    }

    // 9. Getting Started / New Account / "0 Active Collektions" / "How do I start?" / "How do I win my first project?"
    if (/\b(how do i start|how to start|get started|getting started|what should i do first|what do i do now|i am new|i'm new|new here|first project|win my first|0 active|zero earnings|no collektions|nothing on my dashboard)\b/i.test(lower)) {
      if (mem.userRole === 'company') {
        return appendNamePromptIfNeeded(
          `### How to Launch Your First Project on Collekt${nameAddress}\n\n` +
          `Here is the fastest way to go from a new company account to an active, escrow-protected project:\n\n` +
          `1. **Complete Company Verification:** Open **Company Profile** in your sidebar and add your **CAC RC/BN Number**, **FIRS TIN**, and Director **NIN** to earn the **Collekt Shield Badge**.\n` +
          `2. **Publish a Structured Brief:** Click **Post Opportunity** in the sidebar. Define your project scope, required certifications (e.g., *COREN, ICAN, or GitHub portfolio*), total Naira (\`₦\`) budget, and a 3-stage milestone schedule.\n` +
          `3. **Shortlist & Fund Milestone 1:** Review incoming **Collektions** from verified specialists, interview your top choice in **Messages**, and lock Milestone 1 in your **Wallet** escrow to kick off work safely.`,
          mem
        );
      }
      return appendNamePromptIfNeeded(
        `### How to Win Your First Project on Collekt${nameAddress}\n\n` +
        `If your dashboard currently shows **0 Active Collektions** and **₦0 Earnings**, here are the exact 3 steps to land your first contract:\n\n` +
        `1. **Push Your Profile Strength to 100%:**\n` +
        `   * Open **Profile** in the left sidebar and complete every item in your checklist: **Profile photo**, **Bio / Summary**, **Technical skills**, **CV / Resume**, **Certifications** (e.g., *COREN, ICAN, PMP*), and **NIN Identity Verification**.\n` +
        `   * Reaching 100% unlocks the **Collekt Shield Badge**, which puts your applications at the top of company shortlists.\n` +
        `2. **Select a Matching Tender in the Marketplace:**\n` +
        `   * Click **Marketplace** in your sidebar (or the **Browse Marketplace** button on your **Overview** page) and filter for opportunities that match your core discipline.\n` +
        `3. **Submit a Structured 3-Milestone "Collektion":**\n` +
        `   * Instead of a generic cover letter, break your proposed fee into **3 clear milestones** (*30% Specification & Mobilization • 40% Core Execution • 30% Final Handover*). Tell me what role you specialize in and I can write a custom **Collektion** template for you right now!`,
        mem
      );
    }

    // 10. Specific Question: "What is a Collektion?"
    if (/\b(what is a collektion|what are collektions|meaning of collektion|explain collektion|define collektion)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### What is a "Collektion"?\n\n` +
        `On Collekt, a **Collektion** is a structured technical and commercial proposal submitted by a verified professional to win a company’s project opportunity.\n\n` +
        `Unlike an informal quote, every **Collektion** includes:\n` +
        `* **1. Technical Approach & Pitch:** How you will solve the client's specific problem and the relevant experience/certifications you bring.\n` +
        `* **2. Total Naira (\`₦\`) Fee & Timeline:** Your proposed contract sum and delivery duration.\n` +
        `* **3. Milestone Escrow Schedule:** A 2-to-3 phase breakdown showing what deliverable the company will inspect before releasing each tranche of funds from escrow.\n\n` +
        `You can track all your submitted or received proposals anytime under **Collektions** in the left sidebar.`,
        mem
      );
    }

    // 11. Specific Question: Withdrawing Money / Payouts to Bank Account
    if (/\b(withdraw|withdrawal|cash\s*out|payout|get paid|transfer to my bank|move money to bank)\b/i.test(lower) && !/\b(what is collekt)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How to Withdraw Earnings to Your Nigerian Bank Account${nameAddress}\n\n` +
        `Once a client approves a milestone deliverable, those funds move immediately from **Escrow** into your **Available Wallet Balance**. To withdraw:\n\n` +
        `1. Open **Wallet** from your left sidebar and click **Withdraw Funds**.\n` +
        `2. Select your Nigerian bank (all commercial banks as well as Moniepoint, OPay, Kuda, PalmPay, etc. are supported) and enter your **10-digit NUBAN account number**—Collekt automatically verifies your account name.\n` +
        `3. Enter the Naira (\`₦\`) amount, confirm with your security OTP, and submit. Transfers settle directly to your bank account via CBN-licensed NIBSS/Paystack rails.`,
        mem
      );
    }

    // 12. Specific Question: Funding Wallet / Deposit / Dedicated NUBAN
    if (/\b(fund wallet|fund my wallet|deposit|add money|top up|nuban|virtual account|how to pay|paystack|korapay)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How to Fund Your Collekt Wallet & Escrow${nameAddress}\n\n` +
        `1. Open **Wallet** in your left sidebar and click **Fund Wallet**.\n` +
        `2. **Dedicated Virtual Account (NUBAN):** Transfer Naira (\`₦\`) directly from your corporate or personal banking app to your assigned Collekt virtual bank account—your **Wallet** balance updates automatically within seconds.\n` +
        `3. **Instant Checkout:** Alternatively, fund via corporate debit card, USSD, or bank transfer through our integrated Paystack / KoraPay checkout.\n` +
        `4. Once funded, you can lock the exact amount for Milestone 1 into **Escrow** so your chosen specialist can begin execution safely.`,
        mem
      );
    }

    // 13. Specific Question: Disputes, Refunds, Cancellations, or Unresponsive Party
    if (/\b(dispute|refund|cancel|client won't pay|refuse to pay|bad work|poor quality|delayed|unresponsive|arbitration|freeze)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How Collekt Handles Disputes, Delays & Refunds${nameAddress}\n\n` +
        `Because milestone funds are held in neutral **Escrow** before work starts, neither side is ever left exposed:\n\n` +
        `* **Immediate Escrow Freeze:** If a deliverable does not match the agreed acceptance criteria—or if a party becomes unresponsive—raising a dispute on the milestone immediately freezes the escrowed Naira (\`₦\`) balance.\n` +
        `* **5-Business-Day Remediation Window:** The specialist is given a structured 5-day window to address technical review comments against the original scope.\n` +
        `* **Evidence-Based Resolution:** If unresolved, Collekt’s dispute team inspects the timestamped **Messages** workspace, uploaded files, and milestone terms (governed under Nigeria’s *Arbitration and Mediation Act 2023*) to issue a fair release, partial split, or full refund to the client’s **Wallet**.`,
        mem
      );
    }

    // 14. Specific Question: Platform Fees, Commissions & Founding 50
    if (/\b(platform fee|commission|how much does collekt charge|collekt fee|is collekt free|subscription|founding 50|pioneer)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### Collekt Platform Fees & The Founding 50 Pilot${nameAddress}\n\n` +
        `* **Free Account & Bidding:** Creating an account, verifying your credentials, and browsing opportunities on Collekt is free.\n` +
        `* **Standard Milestone Commission:** On standard completed contracts, Collekt charges a 15% platform & escrow protection fee on released milestones.\n` +
        `* **Founding 50 Pilot (0% Fee Waiver):** Pioneer companies selected for the **Founding 50 Program** enjoy **0% platform and escrow fees across their first 3 projects**, plus a **48-hour curated specialist shortlist** from our vetting team.`,
        mem
      );
    }

    // 15. Specific Question: Tax, WHT & VAT Calculations
    if (/\b(tax|wht|withholding|vat|net payout|deduction|firs)\b/i.test(lower)) {
      const gross = mem.userBudget || 2500000;
      const vat = Math.round(gross * 0.075);
      const whtCorp = Math.round(gross * 0.10);
      const whtInd = Math.round(gross * 0.05);
      return appendNamePromptIfNeeded(
        `### Nigerian Commercial Tax & Escrow Settlement Breakdown\n\n` +
        `Using a reference contract value of **₦${gross.toLocaleString()}**${mem.userBudget ? ' (from the figure you mentioned)' : ' (share your exact Naira contract sum and I will recalculate instantly)'}:\n\n` +
        `* **Gross Contract Sum:** \`₦${gross.toLocaleString()}\`\n` +
        `* **Value Added Tax (VAT @ 7.5%):** \`₦${vat.toLocaleString()}\` *(Added on corporate invoices and remitted to FIRS)*\n` +
        `* **Withholding Tax (WHT):**\n` +
        `  * **Corporate / Technical / Consultancy (10%):** \`₦${whtCorp.toLocaleString()}\` *(Issued as a FIRS WHT credit note to the vendor’s TIN)*\n` +
        `  * **Individual Specialist / Direct Supply (5%):** \`₦${whtInd.toLocaleString()}\`\n\n` +
        `**Tip:** Always state in your **Collektion** milestone description whether your quoted Naira fee is *exclusive* or *inclusive* of VAT and WHT.`,
        mem
      );
    }

    // 16. Specific Question: Identity & Credential Verification (NIN, BVN, CAC, COREN, Shield Badge)
    if (/\b(verify|verification|nin|bvn|cac|tin|shield|badge|coren|ican|certificate|upload cv|resume|profile strength)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How to Complete Verification & Earn the Collekt Shield Badge${nameAddress}\n\n` +
        `* **For Professionals / Specialists:** Open **Profile** in your sidebar. Upload your profile photo, bio, technical skills, CV/resume, and professional certificates (**COREN, ICAN, ACCA, PMP, HSE**), then complete your **11-digit NIN Identity Verification**.\n` +
        `* **For Companies:** Open **Company Profile** and submit your **CAC RC/BN registration**, **FIRS TIN**, and Director **NIN**.\n` +
        `* **The Collekt Shield Badge:** Once your profile hits 100% completion and your identity is verified, your account displays the **Collekt Shield**, signaling to clients and partners that you are vetted for instant escrow engagements.`,
        mem
      );
    }

    // 17. Specific Question: Messages, Calls & Interviews
    if (/\b(message|messages|chat|call|video call|voice call|interview|contact|talk to client|send file|attachment)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### Communicating & Interviewing in Messages${nameAddress}\n\n` +
        `Open **Messages** from your left sidebar to collaborate directly with hiring companies or shortlisted specialists:\n\n` +
        `* **Encrypted Real-Time Chat:** Instant messaging with delivery and read receipts.\n` +
        `* **Technical File Sharing:** Attach drawings, BOQs, PDFs, or scope documents directly inside the thread.\n` +
        `* **Built-In Voice & Video Calls:** Click the **Voice Call** or **Video Call** icon in the conversation header to run technical alignment interviews without leaving Collekt.`,
        mem
      );
    }

    // 18. Specialized Intent: Drafting a Scope of Work (SOW), Job Brief, or "Collektion" Proposal
    const wantsDraftOrProposal = /\b(draft|write|prepare|create|sample|template|help me write)\b/i.test(lower) &&
                                 /\b(proposal|collektion|pitch|scope|sow|brief|job|description|agreement|contract|cover letter)\b/i.test(lower);

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
      const total = mem.userBudget || 2000000;

      return appendNamePromptIfNeeded(
        `### Executive Draft: Structured Scope & Milestone Schedule (${domain})\n\n` +
        `Here is a crisp, ready-to-use structure${nameAddress} for **Collektions** (if bidding as a specialist) or **Post Opportunity** (if publishing a company brief):\n\n` +
        `#### 1. Objective & Executive Summary\n` +
        `> Delivery of a verified **${domain}** work package executed to industry standards and governed under Collekt Milestone Escrow.\n\n` +
        `#### 2. Key Deliverables\n` +
        `* ${deliverables}\n\n` +
        `#### 3. 3-Stage Milestone Escrow Schedule (Reference Total: ₦${total.toLocaleString()})\n` +
        `* **Milestone 1 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Discovery, Specification & Mobilization**\n` +
        `  * *Acceptance Criteria:* Client sign-off on technical specification, execution plan, and schedule.\n` +
        `* **Milestone 2 — 40% (\`₦${Math.round(total * 0.40).toLocaleString()}\`): Core Execution & Interim Inspection**\n` +
        `  * *Acceptance Criteria:* Submission of primary engineering/software/advisory package for review.\n` +
        `* **Milestone 3 — 30% (\`₦${Math.round(total * 0.30).toLocaleString()}\`): Final Testing, Sign-Off & Handover**\n` +
        `  * *Acceptance Criteria:* Resolution of review comments and complete handover of final deliverables.\n\n` +
        `*Share your exact project title or target Naira budget and I will customize this word-for-word for you.*`,
        mem
      );
    }

    // 19. Commercial Pricing, Suggestive Fees & Project Scoping (Matched or Dynamic Role)
    const asksAboutFeeOrScope = /\b(fee|fees|price|pricing|cost|charge|budget|how much|estimate|rate|rates|salary|pay|scope|milestone|milestones|hire|hiring|need a|looking for|bid|bidding)\b/i.test(lower);

    if (matchedFeeGuide && asksAboutFeeOrScope) {
      const budgetNote = mem.userBudget
        ? `\n\n#### Tailored Escrow Split for Your ₦${mem.userBudget.toLocaleString()} Budget\n* **Milestone 1 (30% — \`₦${Math.round(mem.userBudget * 0.3).toLocaleString()}\`):** Technical specification, mobilization & initial design sign-off.\n* **Milestone 2 (40% — \`₦${Math.round(mem.userBudget * 0.4).toLocaleString()}\`):** Core execution, interim inspection & verification.\n* **Milestone 3 (30% — \`₦${Math.round(mem.userBudget * 0.3).toLocaleString()}\`):** Final testing, commissioning & complete handover.`
        : '';

      return appendNamePromptIfNeeded(
        `### Nigerian Market Fee Benchmark & Escrow Structure: ${matchedFeeGuide.name}\n\n` +
        `${effectiveName ? `Here is an executive breakdown for you, **${effectiveName}**, based` : 'Based'} on current Nigerian B2B benchmarks on **Collekt**:\n\n` +
        `* **Short Diagnostic / Sprint (1–2 Weeks):** \`${matchedFeeGuide.shortSprint}\`\n` +
        `* **Standard Project Execution (3–6 Weeks):** \`${matchedFeeGuide.standardProject}\`\n` +
        `* **Complex / Senior Package (2–3 Months):** \`${matchedFeeGuide.complexPackage}\`\n\n` +
        `#### Recommended Milestone Escrow Split\n` +
        `* **${matchedFeeGuide.recommendedSplit}**\n` +
        `* **Core Deliverables:** ${matchedFeeGuide.deliverables}${budgetNote}\n` +
        `* **Vetting Standard:** ${matchedFeeGuide.keySkills}`,
        mem
      );
    }

    // Dynamic Fee & Scope Estimator when user asks about fees/scoping/hiring for ANY role or task not in preset keywords
    if (asksAboutFeeOrScope) {
      const refBudget = mem.userBudget || 1500000;
      return appendNamePromptIfNeeded(
        `### Suggested Nigerian Market Fees & Milestone Escrow Structure${nameAddress}\n\n` +
        `For your request (*"${clean}"*), here is how we benchmark and structure B2B engagements in Naira (\`₦\`) on **Collekt**:\n\n` +
        `* **Focused Diagnostic / Short Sprint (1–2 Weeks):** \`₦350,000 – ₦750,000\`\n` +
        `* **Standard Turnkey Project (3–6 Weeks):** \`₦1,200,000 – ₦2,800,000\`\n` +
        `* **Senior / Multi-Discipline Work Package (2–3 Months):** \`₦3,500,000 – ₦9,000,000+\`\n\n` +
        `#### Recommended 3-Stage Milestone Escrow Split (Reference: ₦${refBudget.toLocaleString()})\n` +
        `1. **Milestone 1 — 30% (\`₦${Math.round(refBudget * 0.30).toLocaleString()}\`): Specification & Mobilization** — Lock funds in escrow upon scope and schedule alignment.\n` +
        `2. **Milestone 2 — 40% (\`₦${Math.round(refBudget * 0.40).toLocaleString()}\`): Core Execution & Review** — Released upon inspection of primary project deliverables.\n` +
        `3. **Milestone 3 — 30% (\`₦${Math.round(refBudget * 0.30).toLocaleString()}\`): Final Sign-Off & Handover** — Released upon final quality verification.\n\n` +
        `*Tell me the exact discipline (e.g., Piping/Subsea Engineering, Civil/Solar EPC, Software/Fintech, UI/UX, or Finance/Audit) and project duration, and I will narrow this to exact role rates.*`,
        mem
      );
    }

    // 20. Core Platform Knowledge Topics (About Collekt, Escrow, Hiring, Talent, Navigation)
    if (/\b(what is collekt|about collekt|what do you do|what does collekt do|explain collekt|who are you|what can you do|what is this platform|how does collekt work|tell me about collekt)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `**Collekt** is Nigeria’s verified B2B project marketplace and milestone-escrow platform${nameAddress}. We connect companies commissioning critical engineering, technology, and corporate work with identity- and credential-vetted specialists.\n\n` +
        `Here is how Collekt works end-to-end:\n\n` +
        `1. **Multi-Layer Vetted Talent:** Specialists verify their identity (**NIN/BVN**) and professional credentials (**COREN, ICAN, ACCA, NBA**, or technical portfolios) to earn the **Collekt Shield Badge**.\n` +
        `2. **Structured Briefs & "Collektions":** Companies publish opportunities under **Post Opportunity**, and specialists submit **Collektions**—proposals with clear deliverables and a 3-stage Naira (\`₦\`) milestone schedule.\n` +
        `3. **Zero-Risk Milestone Escrow:** Companies fund a **Dedicated Virtual Account (NUBAN)** in their **Wallet**. Funds are locked in escrow before work starts and released immediately as each milestone deliverable is approved.\n` +
        `4. **Integrated Workspace:** Encrypted chat, file sharing, and HD voice/video calls live inside **Messages**.`,
        mem
      );
    }

    if (/\b(escrow|safe|protect|50% upfront|upfront|trust|security|guarantee)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How Collekt’s Milestone Escrow Protects Both Sides${nameAddress}\n\n` +
        `Traditional contracting in Nigeria forces an unfair risk: paying 50% upfront exposes the client to non-delivery, while working without an advance exposes the specialist to non-payment. Collekt solves both:\n\n` +
        `* **1. Dedicated NUBAN Escrow Funding:** Before kickoff, the hiring company funds the active milestone into a dedicated escrow account via their **Wallet**.\n` +
        `* **2. Verified Proof of Funds:** The specialist sees **Escrow Funded** on their dashboard before investing a single hour of work.\n` +
        `* **3. Deliverable Inspection & Instant Release:** When the specialist submits the milestone deliverable and the client clicks **Approve Milestone**, the funds are credited immediately to the specialist’s **Wallet** for instant bank withdrawal.`,
        mem
      );
    }

    if (/\b(navigate|where is|find page|menu|sidebar|dashboard|settings|dark mode|around)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### Navigating Your Collekt Workspace${nameAddress}\n\n` +
        `Everything is accessible from your left sidebar:\n\n` +
        `* **Overview:** Track your active Collektions, projects won, total Naira earnings, and profile completion checklist.\n` +
        `* **Marketplace:** Browse live project tenders and apply—or filter verified specialists by skill and certification.\n` +
        `* **Post Opportunity** *(Company accounts)*: Publish a new project tender with milestone budgets.\n` +
        `* **Collektions:** Manage your submitted or received proposals and active milestone contracts.\n` +
        `* **Messages:** Real-time encrypted chat, file sharing, and voice/video calling.\n` +
        `* **Wallet:** Fund project escrow via your Dedicated Virtual Account (NUBAN) or withdraw earnings to your Nigerian bank account.\n` +
        `* **Profile & Settings:** Complete verification, upload your CV/certificates, or switch between Light and Dark Mode.`,
        mem
      );
    }

    // 21. Domain Mentioned Without Explicit Fee Keyword
    if (matchedFeeGuide) {
      return appendNamePromptIfNeeded(
        `### ${matchedFeeGuide.name} on Collekt${nameAddress}\n\n` +
        `Here is how **${matchedFeeGuide.name}** projects are structured and priced on the platform:\n\n` +
        `* **Standard Project Benchmark (3–6 Weeks):** \`${matchedFeeGuide.standardProject}\` (or \`${matchedFeeGuide.shortSprint}\` for a 1–2 week diagnostic sprint).\n` +
        `* **Recommended Milestone Split:** ${matchedFeeGuide.recommendedSplit}.\n` +
        `* **Expected Deliverables:** ${matchedFeeGuide.deliverables}\n\n` +
        `Would you like me to **draft a project brief** for this discipline, **write a winning Collektion proposal**, or **break down a specific Naira budget**?`,
        mem
      );
    }

    // 22. Live LLM Reasoning (Direct Gemini Key or Netlify /api/gemini Gateway) for Open-Ended Questions
    const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
    const recentTurns = threadHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Kolly'}: ${m.content}`).join('\n');
    const claudeSystemPrompt = `You are Kolly, the Senior Executive & Technical Advisor for Collekt (collektng.com), Nigeria's verified B2B project marketplace and milestone-escrow platform.
Think, reason, and respond with the analytical clarity, warmth, and executive polish of Anthropic's Claude.
CRITICAL RULES:
1. Directly answer and align with what the user just asked or said ("${clean}"). Do NOT output a generic menu if they asked a specific question or made a conversational remark.
2. NEVER mention or output any internal filenames such as .html, .js, .css, post-job.html, wallet.html, dashboard.html, etc.
3. Refer to platform sections only by their clean UI names: **Overview**, **Marketplace**, **Post Opportunity**, **Collektions**, **Messages**, **Wallet**, and **Profile**.
4. Ground commercial advice in Nigerian Naira (₦), CBN-licensed NUBAN escrow rails, and COREN/ICAN/NBA accreditations.
User Name: ${effectiveName || 'Member'}. User Role: ${mem.userRole || 'professional'}.`;

    if (apiKey && apiKey.startsWith('AIza')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1800);
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${claudeSystemPrompt}\n\nConversation History:\n${recentTurns}\n\nUser: ${clean}` }] }]
          })
        });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) return appendNamePromptIfNeeded(aiText, mem);
        }
      } catch (e) {}
    }

    // Try serverless /api/gemini gateway with fast timeout
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1750);
      const sessionUser = getSessionUser();
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: 'kolly_chat',
          prompt: clean,
          context: `History:\n${recentTurns}\nUser Name: ${effectiveName || 'Member'}, Role: ${mem.userRole || 'professional'}`,
          user_id: sessionUser ? sessionUser.id : undefined,
          email: sessionUser ? sessionUser.email : undefined
        })
      });
      clearTimeout(timer);
      if (resp.ok) {
        const json = await resp.json();
        const reply = json && (json.reply || json.response);
        if (reply) return appendNamePromptIfNeeded(reply, mem);
      }
    } catch (e) {}

    // 23. Context-Aligned Direct Response for Any Custom Question
    return appendNamePromptIfNeeded(
      `Regarding **"${clean}"**${nameAddress}:\n\n` +
      `On **Collekt**, we handle this through our verified B2B workspace and **Milestone Escrow** framework:\n\n` +
      `* **If you are looking to execute or bid on this:** You can browse matching briefs in the **Marketplace** and submit a **Collektion** broken into 3 verifiable Naira (\`₦\`) milestones (*30% Mobilization • 40% Core Delivery • 30% Final Handover*).\n` +
      `* **If you are scoping or hiring for this:** You can publish the brief under **Post Opportunity**, review vetted specialists, and lock Milestone 1 in your **Wallet** escrow so funds are only released when you approve the work.\n\n` +
      `Would you like me to **suggest exact Nigerian Naira (\`₦\`) fees** for this, or **draft a tailored scope/proposal** for it?`,
      mem
    );
  }

  /**
   * Public generateReply: Enforces a deliberate 2-second (2000ms) thinking cadence
   * before returning a response that directly aligns with what the user asked.
   */
  async function generateReply(userText, threadHistory = []) {
    const startTime = Date.now();
    const reply = await computeAlignedReply(userText, threadHistory);
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, THINKING_DURATION_MS - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    return reply;
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
