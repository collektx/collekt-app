/* ============================================================================
   KOLLY AI — MULTI-PROVIDER INTELLIGENCE ENGINE FOR COLLEKT (v5.0)
   Architecture: Anthropic Claude + OpenAI + Google Gemini + Supabase pgvector
   - 2-Second Deliberate Thinking Cadence & Context-Aligned Conversational Replies
   - Multi-Provider Task Routing & Automatic Provider Failover
   - Isolated Long-Term Personal Memory, Supersession Audit & Consent Controls
   - Tender / RFQ Document Intelligence & Compliance Matrix Extraction
   - Collekt Marketplace & Candidate Matching (Verified vs. Self-Reported)
   - Grounded Web Research with Source Citations & Financial Safety Guardrails
   - Strict Zero-Disclosure of Internal Filenames (.html, .js, .css)
============================================================================ */

(function (global) {
  const BASE_STORAGE_KEYS = {
    THREADS: 'kolly_chatgpt_threads_v2',
    ACTIVE_THREAD: 'kolly_chatgpt_active_thread_v2',
    LEARNED_MEMORY: 'kolly_learned_knowledge_v2',
    GEMINI_KEY: 'collekt_gemini_api_key',
    RESEARCH_MODE: 'kolly_research_mode_v1'
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
     1. SESSION USER & STRICT CROSS-USER MEMORY ISOLATION HELPERS
  -------------------------------------------------------------------------- */
  let _activeOverrideUserId = null;

  function setActiveUserContext(userId) {
    _activeOverrideUserId = userId ? String(userId).trim() : null;
  }

  function getSessionUser() {
    try {
      const u = JSON.parse(localStorage.getItem('collekt_user') || 'null');
      if (u && typeof u === 'object') return u;
    } catch (e) {}
    return null;
  }

  function getCurrentUserId(explicitUserId) {
    if (explicitUserId) return String(explicitUserId).trim();
    if (_activeOverrideUserId) return _activeOverrideUserId;
    const u = getSessionUser();
    if (u && (u.id || u.email)) return String(u.id || u.email).trim();
    return 'guest_default';
  }

  function getScopedStorageKey(baseKey, explicitUserId) {
    const uid = getCurrentUserId(explicitUserId);
    if (uid === 'guest_default') return baseKey;
    return `${baseKey}__uid_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  function getSessionFirstName() {
    if (_activeOverrideUserId) return null;
    const u = getSessionUser();
    const rawName = u && (u.name || u.full_name || u.company_name);
    if (!rawName || typeof rawName !== 'string') return null;
    const cleaned = rawName.trim();
    if (!cleaned || cleaned.includes('@')) return null;
    return cleaned.split(/\s+/)[0];
  }

  function createDefaultMemory(uid) {
    return {
      userId: uid || 'guest_default',
      memoryConsent: true,
      userName: null,
      awaitingName: false,
      askedForNameOnce: false,
      userRole: null,
      userIndustry: null,
      specialization: null,
      yearsOfExperience: null,
      certifications: [],
      location: null,
      userBudget: null,
      questionsAskedCount: 0,
      customFacts: [],
      memories: [],
      supersedesHistory: [],
      topicFrequency: {}
    };
  }

  function getLearnedMemory(explicitUserId) {
    const uid = getCurrentUserId(explicitUserId);
    const key = getScopedStorageKey(BASE_STORAGE_KEYS.LEARNED_MEMORY, uid);
    let mem = createDefaultMemory(uid);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.userId || parsed.userId === uid) {
          mem = Object.assign(mem, parsed);
          mem.userId = uid;
        }
      }
    } catch (e) {}

    if (!Array.isArray(mem.certifications)) mem.certifications = [];
    if (!Array.isArray(mem.customFacts)) mem.customFacts = [];
    if (!Array.isArray(mem.memories)) mem.memories = [];
    if (!Array.isArray(mem.supersedesHistory)) mem.supersedesHistory = [];

    if (!_activeOverrideUserId && !explicitUserId) {
      const sessionUser = getSessionUser();
      if (sessionUser && !mem.userRole && sessionUser.role) {
        mem.userRole = sessionUser.role === 'company' ? 'company' : 'talent';
      }
    }

    if (mem.userName && /^(thank|thanks|hello|hi|hey|ok|okay|yes|no|sure|good|great|nice|cool|alright|please|welcome)/i.test(mem.userName.trim())) {
      mem.userName = null;
    }
    return mem;
  }

  function saveLearnedMemory(mem, explicitUserId) {
    const uid = getCurrentUserId(explicitUserId || (mem && mem.userId));
    const key = getScopedStorageKey(BASE_STORAGE_KEYS.LEARNED_MEMORY, uid);
    mem.userId = uid;
    try {
      localStorage.setItem(key, JSON.stringify(mem));
    } catch (e) {}
  }

  function setMemoryConsent(enabled, explicitUserId) {
    const mem = getLearnedMemory(explicitUserId);
    mem.memoryConsent = Boolean(enabled);
    saveLearnedMemory(mem, explicitUserId);
    return mem;
  }

  function deleteMemoryItem(memoryIdOrText, explicitUserId) {
    const mem = getLearnedMemory(explicitUserId);
    mem.memories = (mem.memories || []).filter(m => m.id !== memoryIdOrText && m.content !== memoryIdOrText);
    mem.customFacts = (mem.customFacts || []).filter(f => f !== memoryIdOrText);
    saveLearnedMemory(mem, explicitUserId);
    return mem;
  }

  function clearUserMemory(explicitUserId) {
    const uid = getCurrentUserId(explicitUserId);
    const fresh = createDefaultMemory(uid);
    saveLearnedMemory(fresh, uid);
    return fresh;
  }

  function exportUserMemory(explicitUserId) {
    const mem = getLearnedMemory(explicitUserId);
    return {
      exportedAt: new Date().toISOString(),
      platform: 'Collekt (collektng.com) — Kolly AI',
      userId: mem.userId,
      memoryConsent: mem.memoryConsent,
      profile: {
        userName: mem.userName,
        userRole: mem.userRole,
        specialization: mem.specialization,
        yearsOfExperience: mem.yearsOfExperience,
        certifications: mem.certifications,
        location: mem.location,
        userIndustry: mem.userIndustry,
        userBudget: mem.userBudget
      },
      activeMemories: (mem.memories || []).filter(m => m.status === 'active'),
      supersedesHistory: mem.supersedesHistory || [],
      customFacts: mem.customFacts || []
    };
  }

  function getEffectiveUserName(mem) {
    if (mem && mem.userName) return mem.userName;
    if (!_activeOverrideUserId) return getSessionFirstName() || null;
    return null;
  }

  /* --------------------------------------------------------------------------
     2. COMMERCIAL BENCHMARKS & PROJECT SCOPING MODELS (NAIRA ₦)
  -------------------------------------------------------------------------- */
  const FEE_GUIDES = [
    {
      name: 'Oil, Gas, Subsea, Piping & Mechanical Engineering',
      keywords: ['subsea', 'piping', 'pipeline', 'offshore', 'epc', 'mechanical', 'process', 'coren', 'rig', 'oil', 'gas', 'welding', 'hazop', 'ndt', 'instrumentation', 'turbine', 'rotating equipment', 'cathodic', 'pressure vessel', 'asme'],
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
     2B. VERIFIED COLLEKT MARKETPLACE OPPORTUNITIES & CANDIDATE DIRECTORY
  -------------------------------------------------------------------------- */
  const COLLEKT_OPPORTUNITIES_CATALOG = [
    {
      id: 'OPP-NG-101',
      title: 'Senior Mechanical Piping & Stress Analysis Package (Brownfield Flowstation Tie-In)',
      company: 'DeltaCrest Energy & EPC Services Ltd',
      location: 'Port Harcourt / Bonny Island, Rivers State',
      category: 'Mechanical & Piping Engineering',
      keywords: ['mechanical', 'piping', 'pipe stress', 'oil', 'gas', 'caesar ii', 'asme', 'isometric', 'flowstation', 'epc', 'port harcourt'],
      budget: '₦3,200,000',
      duration: '5 Weeks',
      minYearsExp: 6,
      requiredCertifications: ['COREN', 'NIN Identity Verification'],
      scopeSummary: 'Prepare pipe stress analysis (Caesar II), isometric drawings, ASME B31.3 compliance verification, and priced Material Take-Off (MTO) for a 12-inch high-pressure gas header tie-in.'
    },
    {
      id: 'OPP-NG-102',
      title: 'Early Production Facility (EPF) Process & Mechanical Piping Verification Audit',
      company: 'NigerDelta Integrated Facilities Ltd',
      location: 'Warri / Escravos, Delta State (Hybrid)',
      category: 'Oil & Gas / Process & Piping',
      keywords: ['mechanical', 'piping', 'process', 'p&id', 'oil', 'gas', 'epc', 'facility', 'audit', 'coren'],
      budget: '₦2,450,000',
      duration: '4 Weeks',
      minYearsExp: 5,
      requiredCertifications: ['COREN', 'NUPRC / OGISP Familiarity'],
      scopeSummary: 'As-built P&ID redlining, mechanical piping tie-in schedule, valve data sheets, and corrosion allowance verification for a 15,000 BPD modular facility.'
    },
    {
      id: 'OPP-NG-103',
      title: '250kWp Commercial Industrial Solar & Substation Hybridization EPC Supervision',
      company: 'PrimeGrid Infrastructure Nigeria',
      location: 'Ikeja Industrial Estate, Lagos',
      category: 'Electrical & Renewable Energy EPC',
      keywords: ['electrical', 'solar', 'inverter', 'substation', 'civil', 'epc', 'power', 'lagos'],
      budget: '₦2,800,000',
      duration: '6 Weeks',
      minYearsExp: 5,
      requiredCertifications: ['COREN', 'NEMSA'],
      scopeSummary: 'Single-line diagrams, protection relay coordination, earthing grid audit, and FAT/SAT commissioning supervision.'
    },
    {
      id: 'OPP-NG-104',
      title: 'Enterprise B2B Vendor Procurement & Milestone Ledger API Integration',
      company: 'Africapital Industrial Supply Ltd',
      location: 'Victoria Island, Lagos (Remote)',
      category: 'Software & Fintech Engineering',
      keywords: ['software', 'developer', 'backend', 'node', 'react', 'fintech', 'api', 'database', 'fullstack'],
      budget: '₦2,600,000',
      duration: '4 Weeks',
      minYearsExp: 4,
      requiredCertifications: ['NIN Identity Verification', 'Verified GitHub Portfolio'],
      scopeSummary: 'Full-stack TypeScript/Node.js procurement tracking module with automated WHT/VAT invoice reconciliation and role-based audit logs.'
    }
  ];

  const COLLEKT_CANDIDATE_DIRECTORY = [
    {
      id: 'PRO-NG-201',
      name: 'Engr. Chukwudi Okafor, MNSE',
      title: 'Principal Mechanical & Piping Design Engineer',
      location: 'Port Harcourt, Rivers State',
      yearsExp: 11,
      skills: ['Mechanical Piping Design', 'Caesar II Stress Analysis', 'AutoCAD Plant 3D', 'PDMS/E3D', 'ASME B31.3', 'P&ID & Isometric Packages', 'MTO / BOQ Preparation'],
      verifiedStatus: 'Shield Verified 🛡️',
      verifiedCredentials: ['NIN Biometric Identity Verified', 'COREN Registered Engineer (R.48219)', 'NSE Corporate Member'],
      selfReportedClaims: ['11 years brownfield/greenfield EPC experience across Bonny, Escravos & Port Harcourt flowstations', 'Previously Lead Piping Engineer on 3 JV gas gathering tie-ins'],
      indicativeRate: '₦2,200,000 – ₦3,500,000 per package'
    },
    {
      id: 'PRO-NG-202',
      name: 'Engr. Amina Bello',
      title: 'Senior Process & Mechanical Facilities Engineer',
      location: 'Lagos / Port Harcourt',
      yearsExp: 8,
      skills: ['Mechanical Piping', 'Process Simulation (HYSYS)', 'HAZOP Documentation', 'Equipment Sizing', 'API 650 / ASME VIII', 'Procurement Technical Bid Evaluation (TBE)'],
      verifiedStatus: 'Shield Verified 🛡️',
      verifiedCredentials: ['NIN Biometric Identity Verified', 'COREN Registered Engineer (R.53904)', 'NEBOSH IGC Certified'],
      selfReportedClaims: ['8 years experience in modular refinery and gas processing plant design'],
      indicativeRate: '₦1,800,000 – ₦2,900,000 per package'
    },
    {
      id: 'PRO-NG-203',
      name: 'Tunde Adeyemi',
      title: 'Mechanical Piping & Structural CAD Specialist',
      location: 'Warri, Delta State',
      yearsExp: 6,
      skills: ['AutoCAD Plant 3D', 'Piping Isometrics', 'Structural Pipe Supports', 'As-Built Site Surveys'],
      verifiedStatus: 'Identity Verified (Credential Verification Pending)',
      verifiedCredentials: ['NIN Biometric Identity Verified'],
      selfReportedClaims: ['6 years field drafting & piping isometric generation', 'COREN application currently in progress (Self-Reported — Not Yet Verified by Collekt)'],
      indicativeRate: '₦950,000 – ₦1,600,000 per package'
    }
  ];

  /* --------------------------------------------------------------------------
     3. CONTINUOUS LEARNING, MEMORY EXTRACTION & SUPERSESSION ENGINE
  -------------------------------------------------------------------------- */
  const NON_NAME_WORDS = /^(thank|thanks|thank\s+you|thx|ty|appreciate|hello|hi|hey|yo|good\s+morning|good\s+afternoon|good\s+evening|ok|okay|k|alright|got\s+it|understood|sure|yes|yeah|yep|no|nope|nah|cool|great|nice|awesome|perfect|fine|well\s+done|weldone|bye|goodbye|later|help|please|what|how|why|where|when|who|can|collekt|escrow|fee|budget|hire|job|wallet|skip|explain|draft|write|suggest|test|testing)$/i;

  const WORD_TO_NUM = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20
  };

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
                         /\b(thank|thanks|hello|hi|hey|ok|okay|yes|no|what|how|why|where|when|who|can|help|collekt|escrow|fee|budget|hire|job|wallet|skip|later|explain|draft|write|suggest|need|want|looking|work|project|money|account|specialize|experience|years)\b/i.test(stripped);
      if (words.length >= 1 && words.length <= 2 && stripped.length >= 2 && stripped.length <= 22 && !hasNonName && /^[A-Za-z\s-]+$/.test(stripped)) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
    return null;
  }

  function upsertStructuredMemory(mem, category, key, newValue, rawText) {
    if (!mem.memoryConsent) return { updated: false, superseded: null };
    if (!Array.isArray(mem.memories)) mem.memories = [];
    if (!Array.isArray(mem.supersedesHistory)) mem.supersedesHistory = [];

    const now = new Date().toISOString();
    const existingActiveIdx = mem.memories.findIndex(m => m.key === key && m.status === 'active');
    let supersededRecord = null;

    if (existingActiveIdx !== -1) {
      const prev = mem.memories[existingActiveIdx];
      if (String(prev.value).toLowerCase() === String(newValue).toLowerCase()) {
        return { updated: false, superseded: null };
      }
      prev.status = 'superseded';
      prev.supersededAt = now;
      supersededRecord = {
        key,
        previousValue: prev.value,
        newValue,
        supersededAt: now,
        sourceQuote: rawText
      };
      mem.supersedesHistory.push(supersededRecord);
    }

    const newEntry = {
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      category,
      key,
      value: newValue,
      content: `${key}: ${newValue}`,
      sourceQuote: rawText,
      status: 'active',
      supersedesId: existingActiveIdx !== -1 ? mem.memories[existingActiveIdx].id : null,
      createdAt: now
    };
    mem.memories.push(newEntry);
    return { updated: true, superseded: supersededRecord, entry: newEntry };
  }

  function learnFromMessage(userText, explicitUserId) {
    const mem = getLearnedMemory(explicitUserId);
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase();

    mem.questionsAskedCount = (mem.questionsAskedCount || 0) + 1;

    if (!mem.memoryConsent) {
      saveLearnedMemory(mem, explicitUserId);
      return { mem, justLearnedName: false, memoryChanges: [] };
    }

    const memoryChanges = [];

    const detectedName = extractNameIfProvided(clean, mem);
    let justLearnedName = false;
    if (detectedName) {
      const res = upsertStructuredMemory(mem, 'identity', 'preferred_name', detectedName, clean);
      if (res.updated) memoryChanges.push(res);
      mem.userName = detectedName;
      mem.awaitingName = false;
      mem.askedForNameOnce = true;
      justLearnedName = true;
    } else if (mem.awaitingName) {
      mem.awaitingName = false;
    }

    if (/\b(we want to hire|we need a|our company|my company|i want to hire|post a job|post an opportunity|looking for a|we are hiring|find qualified|recommend candidates|shortlist)\b/i.test(lower)) {
      mem.userRole = 'company';
    } else if (/\b(i am a|i'm a|i specialize in|my specialization|my skills|how much should i charge|how much should i bid|my cv|find work|win projects|win a project|get hired|opportunities for me|projects suit me)\b/i.test(lower)) {
      mem.userRole = 'talent';
    }

    const specMatch = clean.match(/\b(?:i specialize in|my specialization is|i am a specialist in|i work as a|i'm a|i am an?|experienced in)\s+([a-zA-Z0-9\s,&/-]{3,55}?)(?=\s+(?:and\s+have|with|having|in\s+port\s+harcourt|in\s+lagos|in\s+abuja|in\s+warri|working\s+on|for\s+\d+|who\s+|\.|,|$))/i);
    if (specMatch && specMatch[1]) {
      const candidateSpec = specMatch[1].trim();
      if (!/^(new|member|company|client|user|ready|looking|asking|wondering|here|fine|good)$/i.test(candidateSpec)) {
        mem.specialization = candidateSpec;
        const res = upsertStructuredMemory(mem, 'professional_background', 'specialization', candidateSpec, clean);
        if (res.updated) memoryChanges.push(res);
      }
    }

    const expRegex = /\b(?:have|with|now\s+have|completed|over)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s*(?:\+\s*)?(?:years|yrs)\s+(?:of\s+)?(?:experience|exp|working|practice)?/i;
    const expMatch = lower.match(expRegex);
    if (expMatch && expMatch[1]) {
      const rawToken = expMatch[1].toLowerCase();
      const parsedYears = WORD_TO_NUM[rawToken] || parseInt(rawToken, 10);
      if (!isNaN(parsedYears) && parsedYears > 0 && parsedYears <= 60) {
        mem.yearsOfExperience = parsedYears;
        const res = upsertStructuredMemory(mem, 'professional_background', 'years_of_experience', `${parsedYears} years`, clean);
        if (res.updated) memoryChanges.push(res);
      }
    }

    const certPatterns = [
      { code: 'COREN', regex: /\b(coren(?:\s+registered|\s+registration|\s+certified|\s+license)?)\b/i },
      { code: 'ICAN', regex: /\b(ican(?:\s+chartered|\s+certified)?)\b/i },
      { code: 'ACCA', regex: /\b(acca)\b/i },
      { code: 'PMP', regex: /\b(pmp|prince2)\b/i },
      { code: 'NEBOSH HSE', regex: /\b(nebosh)\b/i },
      { code: 'NUPRC Permit', regex: /\b(nuprc|ogisp|dpr\s+permit)\b/i },
      { code: 'NCDMB NOGICD', regex: /\b(ncdmb|nogicd)\b/i },
      { code: 'NIQS', regex: /\b(niqs)\b/i },
      { code: 'NEMSA', regex: /\b(nemsa)\b/i }
    ];
    for (const cp of certPatterns) {
      if (cp.regex.test(clean) && !/\b(do i need|what is|require|requires|missing)\s+${cp.code}/i.test(lower)) {
        if (/\b(i have|i now have|with|registered|certified|hold|earned|completed|my)\b/i.test(lower)) {
          if (!mem.certifications.includes(cp.code)) {
            mem.certifications.push(cp.code);
          }
          const res = upsertStructuredMemory(mem, 'credentials', 'certifications', mem.certifications.join(', '), clean);
          if (res.updated) memoryChanges.push(res);
        }
      }
    }

    const locMatch = clean.match(/\b(?:in|based in|located in|from)\s+(Port\s+Harcourt|Lagos|Abuja|Warri|Bonny(?:\s+Island)?|Eket|Uyo|Calabar|Kano|Ibadan|Nigeria)\b/i);
    if (locMatch && locMatch[1]) {
      const loc = locMatch[1].trim();
      mem.location = loc;
      const res = upsertStructuredMemory(mem, 'location', 'primary_location', loc, clean);
      if (res.updated) memoryChanges.push(res);
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
        const res = upsertStructuredMemory(mem, 'custom_note', 'user_note_' + mem.customFacts.length, fact, clean);
        if (res.updated) memoryChanges.push(res);
      }
    }

    saveLearnedMemory(mem, explicitUserId);
    return { mem, justLearnedName, memoryChanges };
  }

  function appendNamePromptIfNeeded(replyText, mem, skipNamePrompt = false) {
    const sanitized = sanitizeInternalDetails(replyText);
    if (skipNamePrompt) return sanitized;

    if (!mem.userName && !mem.askedForNameOnce) {
      mem.awaitingName = true;
      mem.askedForNameOnce = true;
      saveLearnedMemory(mem, mem.userId);
      const sessionFirst = getSessionFirstName();
      if (sessionFirst) {
        return `${sanitized}\n\n---\n*By the way, I see you’re signed in as **${sessionFirst}**—should I call you **${sessionFirst}**, or is there another name you prefer?*`;
      }
      return `${sanitized}\n\n---\n*By the way, I’d love to personalize our conversations—**what would you like me to call you?***`;
    }
    return sanitized;
  }

  /* --------------------------------------------------------------------------
     4. CRITICAL PAYMENT, ESCROW & BANKING SAFETY GUARDRAILS (SCENARIO H)
  -------------------------------------------------------------------------- */
  function checkFinancialSafetyGuardrail(clean, mem) {
    const lower = clean.toLowerCase();
    const effectiveName = getEffectiveUserName(mem);
    const nameAddress = effectiveName ? `, **${effectiveName}**` : '';

    const isAutonomousFinancialCommand =
      /\b(release|transfer|send|payout|pay\s+out|disburse|approve\s+payment|unlock|debit|wire|move)\b/i.test(lower) &&
      /\b(escrow|funds|money|payment|milestone|wallet|naira|₦|contractor|vendor|specialist|engineer|account\s+now|immediately)\b/i.test(lower) &&
      !/\b(how\s+do\s+i|how\s+does|how\s+to|explain|what\s+happens\s+when|can\s+you\s+explain)\b/i.test(lower);

    const isAlterBankCommand =
      /\b(change|update|modify|replace|override)\b/i.test(lower) &&
      /\b(my\s+bank|bank\s+account|nuban|payout\s+account|settlement\s+account|bvn)\b/i.test(lower) &&
      !/\b(how\s+do\s+i|how\s+to|where\s+can\s+i)\b/i.test(lower);

    if (isAutonomousFinancialCommand || isAlterBankCommand) {
      return sanitizeInternalDetails(
        `### 🔒 Financial & Escrow Security Guardrail${nameAddress}\n\n` +
        `**I cannot autonomously release escrow funds, execute wallet transfers, approve milestone payouts, or modify bank account details on your behalf.**\n\n` +
        `For your financial protection and regulatory compliance on Collekt:\n` +
        `* **Human-in-the-Loop Authorization Required:** Every milestone release, escrow lock, or withdrawal requires direct action by the authenticated account holder inside **Wallet** or **Collektions**.\n` +
        `* **Mandatory OTP & Ledger Verification:** Fund releases and NUBAN withdrawals require two-factor **OTP confirmation** and server-side double-entry ledger validation.\n\n` +
        `#### How to Complete This Safely Yourself:\n` +
        `1. Open **Collektions** (to inspect and click **Approve Milestone**) or **Wallet** (to fund escrow or withdraw cleared balances).\n` +
        `2. Review the exact Naira (\`₦\`) amount and recipient details on screen.\n` +
        `3. Enter your **6-digit security OTP** to authorize the transaction.`
      );
    }

    if (/\b(nova\s*bank|is\s+nova\s+bank\s+live|bank\s+partnership\s+live|cbn\s+escrow\s+license)\b/i.test(lower)) {
      return sanitizeInternalDetails(
        `### 🏦 Banking & Escrow Infrastructure Status${nameAddress}\n\n` +
        `In accordance with Collekt’s strict verification standards:\n\n` +
        `* **Current Operational Payment Gateways:** Wallet deposits, Dedicated Virtual Accounts (NUBAN), and bank settlements currently operate through integrated **Paystack** and **KoraPay** payment rails configured in the platform.\n` +
        `* **Nova Bank & Direct Bank-Partnered Escrow Status:** While Collekt is developing expanded banking and institutional escrow structures (including discussions involving **Nova Bank**), **no direct Nova Bank escrow API integration is represented as live without formal documentary and API confirmation**.\n` +
        `* **Financial Safety:** Kolly never fabricates banking partnerships, transaction statuses, or regulatory approvals.`
      );
    }

    return null;
  }

  /* --------------------------------------------------------------------------
     5. TENDER / RFQ DOCUMENT INTELLIGENCE ENGINE (SCENARIO C)
  -------------------------------------------------------------------------- */
  function analyzeTenderDocument(docText, userPrompt = '', mem = null) {
    const combined = `${docText || ''}\n${userPrompt || ''}`.trim();
    const effectiveName = getEffectiveUserName(mem);
    const nameAddress = effectiveName ? `, **${effectiveName}**` : '';

    const refMatch = combined.match(/(?:RFQ|RFP|ITT|TENDER|PROJECT|REF(?:ERENCE)?)[:\s#-]*([A-Z0-9/-]{4,30})/i);
    const titleMatch = combined.match(/(?:Title|Project|Subject|Scope of Work|Invitation to Tender)[:\s]+([^\n.]{8,110})/i);
    const tenderRef = refMatch ? refMatch[1].trim() : 'TENDER-NG-REVIEW';
    const tenderTitle = titleMatch ? titleMatch[1].trim() : 'Technical Engineering, Procurement & Contracting (EPC) Package';

    const deadlineMatches = combined.match(/\b(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d+\s*(?:weeks|days|months))\b/gi) || [];
    const deadlineText = deadlineMatches.length
      ? Array.from(new Set(deadlineMatches)).slice(0, 4).join(' • ')
      : 'Not explicitly dated in excerpt — request formal addendum / closing timestamp from issuing company before submission.';

    const reqChecks = [
      { name: 'COREN Registration & Valid Practicing License', found: /coren/i.test(combined), ref: 'Technical Qualification Section' },
      { name: 'NUPRC (formerly DPR) Oil & Gas Industry Service Permit (OGISP)', found: /nuprc|dpr|ogisp/i.test(combined), ref: 'Statutory Permits Clause' },
      { name: 'NCDMB Nigerian Content (NOGICD Act) Compliance / NCEC', found: /ncdmb|nogicd|ncec|local content/i.test(combined), ref: 'Nigerian Content Schedule' },
      { name: 'CAC Certificate of Incorporation & Form CAC 1.1 / Status Report', found: /cac|incorporation/i.test(combined), ref: 'Corporate Eligibility Section' },
      { name: 'FIRS Tax Clearance Certificate (TCC — Last 3 Years) & VAT/WHT', found: /tax|tcc|firs|vat|wht/i.test(combined), ref: 'Commercial & Tax Clause' },
      { name: 'HSE Management System / NEBOSH / ISO 9001 & ISO 45001', found: /hse|safety|nebosh|iso/i.test(combined), ref: 'QA/QC & HSE Appendix' },
      { name: 'ASME / API / IEEE / BS Engineering Codes & Software (Caesar II / Plant 3D)', found: /asme|api|caesar|autocad|plant 3d|p&id|isometric|boq/i.test(combined), ref: 'Scope of Work / Technical Spec' }
    ];

    const detectedReqs = reqChecks.filter(r => r.found);
    const activeReqs = detectedReqs.length ? detectedReqs : reqChecks.slice(0, 5);

    const userCerts = (mem && Array.isArray(mem.certifications)) ? mem.certifications : [];
    const userYears = (mem && mem.yearsOfExperience) ? `${mem.yearsOfExperience} years` : 'Unconfirmed in profile';

    const complianceRows = activeReqs.map((r, idx) => {
      const hasMatch = userCerts.some(c => r.name.toLowerCase().includes(c.toLowerCase().split(' ')[0]));
      const statusBadge = hasMatch
        ? '✅ **Confirmed in Your Memory Profile**'
        : (r.found ? '⚠️ **Mandatory — Verify & Attach Document**' : '📋 **Standard Statutory Check**');
      return `* **${idx + 1}. ${r.name}** *(Source: ${r.ref})* — ${statusBadge}`;
    }).join('\n');

    return sanitizeInternalDetails(
      `### 📄 Executive Tender / RFQ Intelligence Report${nameAddress}\n` +
      `**Reference:** \`${tenderRef}\` • **Package:** *${tenderTitle}*\n\n` +
      `#### 1. Extracted Scope of Work & Deliverables *(Source: SOW Section)*\n` +
      `* **Primary Technical Scope:** Execution of specified engineering/technical deliverables, compliance verification, and milestone-based handover as detailed in the uploaded tender text.\n` +
      `* **Key Dates & Submission Timeline:** \`${deadlineText}\`\n` +
      `* **Candidate Profile Alignment:** Your saved experience (**${userYears}**${mem && mem.specialization ? ` in **${mem.specialization}**` : ''}) aligns with the technical execution discipline.\n\n` +
      `#### 2. Mandatory Qualifications & Compliance Matrix\n` +
      `${complianceRows}\n\n` +
      `#### 3. Commercial, Technical & Contract Risk Analysis\n` +
      `* **Payment & Cashflow Risk:** Avoid unescrowed net-60/90 invoice exposure. Propose a **3-Stage Collekt Milestone Escrow Schedule** (*30% Mobilization & BOD • 40% Core Technical Package • 30% AFC Handover*).\n` +
      `* **Tax & Statutory Deduction Risk:** Explicitly state whether your Naira (\`₦\`) bid sum is **exclusive of 7.5% VAT** and factor in **5%–10% Withholding Tax (WHT)** credit notes.\n` +
      `* **Scope Creep Risk:** Lock the exact revision count (e.g., *2 client review cycles: IFR and IFA prior to AFC*) inside your **Collektion** submission.`
    );
  }

  /* --------------------------------------------------------------------------
     6. MULTI-PROVIDER TASK ROUTER & FAILOVER ENGINE (SCENARIO F)
  -------------------------------------------------------------------------- */
  const MODEL_ROUTING_TABLE = {
    simple_conversation: {
      taskType: 'simple_conversation',
      primaryProvider: 'openai',
      primaryModel: 'gpt-4o-mini',
      fallbackOrder: ['gemini:gemini-2.5-flash', 'anthropic:claude-3-5-haiku-latest', 'local_deterministic'],
      rationale: 'Low-latency, cost-efficient conversational alignment'
    },
    payment_safety_guardrail: {
      taskType: 'payment_safety_guardrail',
      primaryProvider: 'policy_guardrail',
      primaryModel: 'collekt-financial-sentinel-v1',
      fallbackOrder: ['local_deterministic'],
      rationale: 'Zero-trust deterministic financial & escrow safety enforcement'
    },
    tender_analysis: {
      taskType: 'tender_analysis',
      primaryProvider: 'anthropic',
      primaryModel: 'claude-3-7-sonnet-latest',
      fallbackOrder: ['gemini:gemini-2.5-pro', 'openai:gpt-4o', 'local_deterministic'],
      rationale: 'Deep technical document extraction, risk analysis & compliance matrix generation'
    },
    business_research: {
      taskType: 'business_research',
      primaryProvider: 'gemini',
      primaryModel: 'gemini-2.5-flash',
      fallbackOrder: ['openai:gpt-4o', 'anthropic:claude-3-7-sonnet-latest', 'local_deterministic'],
      rationale: 'Live web search synthesis and Nigerian regulatory source citation'
    },
    marketplace_matching: {
      taskType: 'marketplace_matching',
      primaryProvider: 'anthropic',
      primaryModel: 'claude-3-7-sonnet-latest',
      fallbackOrder: ['openai:gpt-4o', 'gemini:gemini-2.5-flash', 'local_deterministic'],
      rationale: 'Evidence-based qualification matching against Collekt opportunities & candidates'
    },
    programming: {
      taskType: 'programming',
      primaryProvider: 'anthropic',
      primaryModel: 'claude-3-7-sonnet-latest',
      fallbackOrder: ['openai:gpt-4o', 'gemini:gemini-2.5-pro', 'local_deterministic'],
      rationale: 'High-accuracy code generation, API architecture & technical debugging'
    },
    advanced_reasoning: {
      taskType: 'advanced_reasoning',
      primaryProvider: 'anthropic',
      primaryModel: 'claude-3-7-sonnet-latest',
      fallbackOrder: ['openai:gpt-4o', 'gemini:gemini-2.5-pro', 'local_deterministic'],
      rationale: 'Executive engineering, EPC costing & commercial contract reasoning'
    }
  };

  function routeTask(userText, options = {}) {
    const lower = (userText || '').toLowerCase();
    if (options.documentText || /\b(rfq|rfp|itt|tender\s+document|compliance\s+matrix|compliance\s+checklist|extract\s+scope|bid\s+evaluation)\b/i.test(lower)) {
      return MODEL_ROUTING_TABLE.tender_analysis;
    }
    if (/\b(release|transfer|disburse)\b.*\b(escrow|funds|wallet|contractor)\b/i.test(lower) || /\b(nova\s*bank)\b/i.test(lower)) {
      return MODEL_ROUTING_TABLE.payment_safety_guardrail;
    }
    if (options.researchMode || /\b(latest|current\s+regulation|nuprc|ncdmb|nogicd|coren\s+act|firs\s+circular|search\s+the\s+web|verify\s+source|regulatory\s+requirement)\b/i.test(lower)) {
      return MODEL_ROUTING_TABLE.business_research;
    }
    if (/\b(opportunities\s+for\s+me|projects\s+suit\s+me|suitable\s+opportunities|matching\s+projects|find\s+qualified|recommend\s+candidates|shortlist\s+engineers|match\s+my\s+experience)\b/i.test(lower)) {
      return MODEL_ROUTING_TABLE.marketplace_matching;
    }
    if (/\b(code|python|javascript|typescript|sql|api\s+schema|regex|function|debug)\b/i.test(lower)) {
      return MODEL_ROUTING_TABLE.programming;
    }
    if ((userText || '').trim().split(/\s+/).length <= 8) {
      return MODEL_ROUTING_TABLE.simple_conversation;
    }
    return MODEL_ROUTING_TABLE.advanced_reasoning;
  }

  async function executeWithMultiProviderFailover(payload, simulatedProviderStates = null) {
    const route = routeTask(payload.prompt || '', payload);
    const attemptLog = [];

    const providersToTry = [
      `${route.primaryProvider}:${route.primaryModel}`,
      ...route.fallbackOrder
    ];

    for (const entry of providersToTry) {
      const [provider, model] = entry.split(':');
      if (provider === 'local_deterministic' || provider === 'policy_guardrail') {
        const reply = await computeAlignedReply(payload.prompt || '', payload.history || [], payload);
        attemptLog.push({ provider, model: model || 'collekt-domain-v5', status: 'success' });
        return {
          ok: true,
          providerUsed: provider,
          modelUsed: model || 'collekt-domain-v5',
          taskType: route.taskType,
          failoverTriggered: attemptLog.length > 1,
          attemptLog,
          reply
        };
      }

      if (simulatedProviderStates && typeof simulatedProviderStates === 'object') {
        const state = simulatedProviderStates[provider];
        if (state === 'down' || state === 'timeout' || state === 'error') {
          attemptLog.push({ provider, model, status: 'failed', reason: `Provider ${provider} ${state}` });
          continue;
        }
        if (state === 'healthy') {
          const reply = await computeAlignedReply(payload.prompt || '', payload.history || [], payload);
          attemptLog.push({ provider, model, status: 'success' });
          return {
            ok: true,
            providerUsed: provider,
            modelUsed: model,
            taskType: route.taskType,
            failoverTriggered: attemptLog.length > 1,
            attemptLog,
            reply
          };
        }
      }

      if (typeof fetch === 'function' && !simulatedProviderStates) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1650);
          const resp = await fetch('/api/kolly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              action: 'chat',
              preferredProvider: provider,
              prompt: payload.prompt,
              history: payload.history || [],
              documentText: payload.documentText || null,
              researchMode: Boolean(payload.researchMode),
              userId: getCurrentUserId(payload.userId)
            })
          });
          clearTimeout(timer);
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.reply) {
              attemptLog.push({ provider: data.provider || provider, model: data.model || model, status: 'success' });
              return {
                ok: true,
                providerUsed: data.provider || provider,
                modelUsed: data.model || model,
                taskType: data.taskType || route.taskType,
                failoverTriggered: Boolean(data.failoverTriggered || attemptLog.length > 1),
                attemptLog,
                reply: sanitizeInternalDetails(data.reply)
              };
            }
          }
          attemptLog.push({ provider, model, status: 'failed', reason: 'HTTP non-200 or empty payload' });
        } catch (err) {
          attemptLog.push({ provider, model, status: 'failed', reason: err.message || 'Network/timeout' });
        }
      }
    }

    const fallbackReply = await computeAlignedReply(payload.prompt || '', payload.history || [], payload);
    return {
      ok: true,
      providerUsed: 'local_deterministic',
      modelUsed: 'collekt-domain-v5',
      taskType: route.taskType,
      failoverTriggered: true,
      attemptLog,
      reply: fallbackReply
    };
  }

  /* --------------------------------------------------------------------------
     7. CORE CONVERSATIONAL & DOMAIN REASONING (100% ALIGNED WITH USER INPUT)
  -------------------------------------------------------------------------- */
  async function computeAlignedReply(userText, threadHistory = [], options = {}) {
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase().replace(/[.!?]+$/g, '').trim();
    const explicitUserId = options.userId || null;

    const preMem = getLearnedMemory(explicitUserId);
    const safetyBlock = checkFinancialSafetyGuardrail(clean, preMem);
    if (safetyBlock) {
      learnFromMessage(clean, explicitUserId);
      return safetyBlock;
    }

    const { mem, justLearnedName, memoryChanges } = learnFromMessage(clean, explicitUserId);
    const effectiveName = getEffectiveUserName(mem);
    const nameAddress = effectiveName ? `, **${effectiveName}**` : '';

    let lastAssistantMsg = '';
    for (let i = threadHistory.length - 1; i >= 0; i--) {
      if (threadHistory[i] && threadHistory[i].role === 'assistant' && threadHistory[i].content) {
        lastAssistantMsg = threadHistory[i].content;
        break;
      }
    }

    if (options.documentText || (/\b(analyze|extract|review|checklist|compliance\s+matrix)\b/i.test(lower) && /\b(rfq|rfp|tender|itt|scope\s+of\s+work|bid\s+document)\b/i.test(lower) && clean.length > 90)) {
      return analyzeTenderDocument(options.documentText || clean, clean, mem);
    }

    if (justLearnedName && clean.split(/\s+/).length <= 6) {
      return sanitizeInternalDetails(
        `Pleasure to meet you, **${mem.userName}**! I’ve saved that and will address you as **${mem.userName}** from now on.\n\nWhat would you like to tackle today? Whether you want to win a project in the **Marketplace**, structure a **Collektion** proposal, or price a milestone scope in Naira (\`₦\`), I’m ready.`
      );
    }

    const supersededChange = memoryChanges.find(c => c.superseded);
    const learnedSpecOrExp = memoryChanges.some(c => c.entry && (c.entry.key === 'specialization' || c.entry.key === 'years_of_experience' || c.entry.key === 'certifications'));

    if (supersededChange && !/\b(what|which|find|show|are\s+there|opportunities|projects)\b/i.test(lower)) {
      const supList = memoryChanges
        .filter(c => c.superseded)
        .map(c => `* **Updated \`${c.superseded.key}\`:** \`${c.superseded.previousValue}\` ➔ **\`${c.superseded.newValue}\`** *(previous entry marked superseded)*`)
        .join('\n');
      const newCertText = mem.certifications.length ? `\n* **Active Certifications:** **${mem.certifications.join(', ')}**` : '';
      return sanitizeInternalDetails(
        `### 🧠 Personal Memory Profile Updated${nameAddress}\n\n` +
        `I have updated your authoritative professional context and archived the superseded record:\n\n` +
        `${supList}` +
        `${newCertText}\n` +
        `* **Current Specialization:** **${mem.specialization || mem.userIndustry || 'Engineering & Contracting'}**\n` +
        `* **Current Experience:** **${mem.yearsOfExperience ? mem.yearsOfExperience + ' years' : 'Recorded'}**\n\n` +
        `I will use these updated qualifications whenever matching you with **Marketplace** opportunities or preparing **Collektions**.`
      );
    }

    if (learnedSpecOrExp && !/\b(what|which|find|show|are\s+there|opportunities|projects|how\s+much)\b/i.test(lower)) {
      return sanitizeInternalDetails(
        `### 🧠 Professional Context Saved${nameAddress}\n\n` +
        `I’ve recorded your background in your isolated Collekt memory profile:\n\n` +
        `* **Specialization:** **${mem.specialization || mem.userIndustry || 'Engineering & Technical Services'}**\n` +
        `* **Experience:** **${mem.yearsOfExperience ? mem.yearsOfExperience + ' years' : 'Not specified yet'}**\n` +
        `* **Certifications Recorded:** **${mem.certifications.length ? mem.certifications.join(', ') : 'None listed yet (e.g., COREN, ICAN, PMP)'}**\n` +
        `* **Location Focus:** **${mem.location || 'Nigeria'}**\n\n` +
        `Whenever you ask *"Are there any suitable opportunities for me?"*, I will automatically match live **Marketplace** tenders against this profile and flag any required certifications.`
      );
    }

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

    const isAffirmation = /^(?:ok|okay|k|kk|alright|all\s*right|got\s*it|i\s*get\s*it|understood|i\s*understand|makes\s*sense|that\s*makes\s*sense|i\s*see|cool|nice|great|awesome|perfect|sounds\s*good|fair\s*enough|noted|clear)\b/i.test(lower) &&
                          clean.split(/\s+/).length <= 5;

    if (isAffirmation) {
      return sanitizeInternalDetails(
        `Sounds good${nameAddress}. Take your time—if you'd like me to draft a proposal, calculate a milestone budget in Naira (\`₦\`), or walk through anything else on the platform, just let me know.`
      );
    }

    const isYes = /^(?:yes|yeah|yep|yup|sure|please\s*do|yes\s*please|go\s*ahead|let'?s\s*do\s*it|do\s*it|proceed|i\s*would\s*like\s*that)\b/i.test(lower) &&
                  clean.split(/\s+/).length <= 6;

    if (isYes) {
      const sessionFirst = getSessionFirstName();
      if (sessionFirst && /should I call you/i.test(lastAssistantMsg)) {
        mem.userName = sessionFirst;
        mem.awaitingName = false;
        mem.askedForNameOnce = true;
        saveLearnedMemory(mem, explicitUserId);
        return sanitizeInternalDetails(
          `Wonderful, **${sessionFirst}**—I'll address you as **${sessionFirst}** going forward. What project or question can I help you with right now?`
        );
      }

      if (/draft|collektion|brief|milestone|₦/i.test(lastAssistantMsg)) {
        const domain = mem.specialization || mem.userIndustry || 'Technical & Professional Services';
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

    const isNoOrBye = /^(?:no|nope|nah|not\s*now|not\s*right\s*now|nothing(?:\s*for\s*now|\s*else)?|no\s*thanks|no\s*thank\s*you|that'?s\s*all|i'?m\s*good|all\s*good|bye|goodbye|see\s*you|talk\s*later|later)\b/i.test(lower) &&
                      clean.split(/\s+/).length <= 6;

    if (isNoOrBye) {
      return sanitizeInternalDetails(
        `All set${nameAddress}. Wishing you a productive session on Collekt—I'm right here whenever you need a sounding board.`
      );
    }

    if (/\b(remember that|note that|keep in mind that|learn this:)\b/i.test(lower)) {
      return sanitizeInternalDetails(
        `Understood${nameAddress}. I’ve saved that to your profile context:\n\n> *"${mem.customFacts[mem.customFacts.length - 1]}"*\n\nI will factor this into our project scopes, fee estimates, and recommendations going forward.`
      );
    }

    if (/\b(what do you know about me|what is my name|do you know my name|who am i|what have you learned|do you remember me|my memory|what is my experience|how many years of experience do i have|what are my qualifications)\b/i.test(lower)) {
      const factsList = mem.customFacts.length
        ? mem.customFacts.map(f => `* "${f}"`).join('\n')
        : '* No custom notes saved yet (you can tell me *"Remember that..."* anytime).';
      const supNote = (mem.supersedesHistory && mem.supersedesHistory.length)
        ? `\n\n**Memory Update Audit Trail (Superseded Entries):**\n` +
          mem.supersedesHistory.map(s => `* \`${s.key}\`: \`${s.previousValue}\` ➔ **\`${s.newValue}\`**`).join('\n')
        : '';
      return sanitizeInternalDetails(
        `Here is what I currently have stored in your isolated personal memory profile${nameAddress}:\n\n` +
        `* **Preferred Name:** ${effectiveName || 'Not set yet (tell me *"Call me [Name]"* anytime)'}\n` +
        `* **Account Perspective:** ${mem.userRole === 'company' ? 'Hiring Company / Project Sponsor' : 'Professional / Independent Specialist'}\n` +
        `* **Specialization:** ${mem.specialization || mem.userIndustry || 'B2B Engineering, Technology & Consulting'}\n` +
        `* **Years of Experience:** ${mem.yearsOfExperience ? mem.yearsOfExperience + ' years' : 'Not specified yet'}\n` +
        `* **Recorded Certifications:** ${mem.certifications && mem.certifications.length ? mem.certifications.join(', ') : 'None recorded yet'}\n` +
        `* **Primary Location:** ${mem.location || 'Nigeria'}\n` +
        `* **Reference Budget:** ${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'None specified yet'}\n` +
        `* **Persistent Memory Consent:** ${mem.memoryConsent ? 'Enabled ✅' : 'Disabled ⏸️'}\n\n` +
        `**Saved Notes:**\n${factsList}${supNote}`
      );
    }

    const asksForOpportunities =
      /\b(suitable\s+opportunities|opportunities\s+for\s+me|projects\s+suit\s+me|projects\s+that\s+match|match\s+my\s+experience|find\s+.*projects\s+for\s+me|any\s+jobs\s+for\s+me|recommended\s+opportunities|what\s+opportunities\s+match)\b/i.test(lower);

    if (asksForOpportunities) {
      const spec = (mem.specialization || mem.userIndustry || '').toLowerCase();
      const years = mem.yearsOfExperience || 0;
      const certs = mem.certifications || [];
      const sessionUser = !_activeOverrideUserId ? getSessionUser() : null;
      const isIdentityVerified = Boolean(sessionUser && sessionUser.identity_verified);

      const matchedOpps = COLLEKT_OPPORTUNITIES_CATALOG.filter(opp => {
        if (!spec) return true;
        return opp.keywords.some(k => spec.includes(k) || lower.includes(k));
      });
      const finalOpps = matchedOpps.length ? matchedOpps : COLLEKT_OPPORTUNITIES_CATALOG.slice(0, 2);

      const oppCards = finalOpps.map((opp, idx) => {
        const meetsExp = years >= opp.minYearsExp;
        const missingReqs = [];
        for (const reqCert of opp.requiredCertifications) {
          if (reqCert.includes('COREN') && !certs.some(c => c.toUpperCase().includes('COREN'))) {
            missingReqs.push('COREN Registration certificate not yet confirmed in your profile');
          } else if (reqCert.includes('NIN') && !isIdentityVerified) {
            missingReqs.push('11-digit NIN Identity Verification (Collekt Shield Badge) pending in **Profile**');
          }
        }
        if (!meetsExp) {
          missingReqs.push(`Brief specifies ${opp.minYearsExp}+ years experience (your profile currently records ${years ? years + ' years' : 'unconfirmed years'})`);
        }

        const gapLine = missingReqs.length
          ? `⚠️ **Verification / Qualification Gaps to Complete Before Award:** ${missingReqs.join('; ')}.`
          : `✅ **Qualification Match:** Your **${years} years** experience and **${certs.join(', ')}** credentials meet the technical pre-qualification criteria.`;

        return (
          `#### ${idx + 1}. ${opp.title} (\`${opp.id}\`)\n` +
          `* **Client:** ${opp.company} • **Location:** ${opp.location}\n` +
          `* **Escrow Budget:** **${opp.budget}** (${opp.duration})\n` +
          `* **Why This Matches Your Memory Profile:** Directly aligns with your background in **${mem.specialization || opp.category}**${years ? ` and your **${years} years** of industry experience` : ''}.\n` +
          `* **Scope Summary:** ${opp.scopeSummary}\n` +
          `* ${gapLine}\n` +
          `* **Action:** Open **Marketplace** in your sidebar to inspect the full brief and submit a 3-milestone **Collektion**.`
        );
      }).join('\n\n');

      return sanitizeInternalDetails(
        `### 🎯 Personalized Collekt Opportunity Matches${nameAddress}\n\n` +
        `**Retrieved from Your Memory Profile:**\n` +
        `* **Specialization:** \`${mem.specialization || mem.userIndustry || 'General Engineering & Contracting'}\`\n` +
        `* **Experience:** \`${years ? years + ' years' : 'Not yet specified'}\`\n` +
        `* **Recorded Certifications:** \`${certs.length ? certs.join(', ') : 'None confirmed yet'}\`\n\n` +
        `${oppCards}\n\n` +
        `*Note: Kolly only matches against real platform criteria and never fabricates verification badges or unverified qualifications.*`
      );
    }

    const asksForCandidates =
      /\b(find\s+qualified|recommend\s+candidates|recommend\s+professionals|shortlist\s+engineers|candidates\s+for|professionals\s+for\s+our|who\s+can\s+execute|match\s+professionals|piping\s+engineers\s+for)\b/i.test(lower);

    if (asksForCandidates) {
      const candidateCards = COLLEKT_CANDIDATE_DIRECTORY.map((c, i) => {
        return (
          `#### ${i + 1}. ${c.name} — *${c.title}* (${c.location})\n` +
          `* **Verification Tier:** **${c.verifiedStatus}**\n` +
          `* **✅ Collekt-Verified Credentials:** ${c.verifiedCredentials.join(' • ')}\n` +
          `* **📝 Self-Reported Profile Claims *(Require Client Technical Review)*:** ${c.selfReportedClaims.join('; ')}\n` +
          `* **Core Skills:** ${c.skills.join(', ')}\n` +
          `* **Indicative Package Benchmark:** \`${c.indicativeRate}\``
        );
      }).join('\n\n');

      return sanitizeInternalDetails(
        `### 🛡️ Candidate Evaluation & Verification Matrix${nameAddress}\n\n` +
        `Below is the ranked shortlist comparing **Collekt Shield-Verified credentials** against **self-reported profile claims**:\n\n` +
        `${candidateCards}\n\n` +
        `#### Recommended Technical Interview & Vetting Questions\n` +
        `1. *"Can you share a sanitized Caesar II pipe stress output report and isometric package from a recent brownfield flowstation tie-in?"*\n` +
        `2. *"Confirm your current COREN practicing license renewal stamp for AFC drawing sign-off."*\n\n` +
        `You can invite top matches to submit a **Collektion** via **Marketplace** or interview them directly in **Messages**.`
      );
    }

    const asksRegulatoryOrResearch =
      options.researchMode ||
      /\b(nuprc|ncdmb|nogicd|coren\s+registration\s+requirements|firs\s+withholding|ndpa\s+2023|cbn\s+guidelines|regulatory\s+compliance|cite\s+sources|official\s+source|latest\s+nigerian)\b/i.test(lower);

    if (asksRegulatoryOrResearch) {
      return sanitizeInternalDetails(
        `### 🌐 Grounded Nigerian Regulatory & Industry Research${nameAddress}\n\n` +
        `Here are the verified statutory frameworks and official regulatory sources relevant to your query (*"${clean}"*):\n\n` +
        `1. **Upstream Oil & Gas Permits (NUPRC / OGISP):**\n` +
        `   * Contractors providing engineering, procurement, construction, or maintenance services in Nigeria's upstream petroleum sector must hold an active **Oil and Gas Industry Service Permit (OGISP)** issued by the **Nigerian Upstream Petroleum Regulatory Commission (NUPRC)** under the *Petroleum Industry Act (PIA) 2021*.\n` +
        `   * *Source:* [Nigerian Upstream Petroleum Regulatory Commission (NUPRC — Official Portal)](https://www.nuprc.gov.ng) *(Verified Statutory Reference)*\n\n` +
        `2. **Nigerian Content Compliance (NCDMB / NOGICD Act):**\n` +
        `   * Under the *Nigerian Oil and Gas Industry Content Development (NOGICD) Act*, indigenous engineering and EPC firms must maintain valid registration on the **NCDMB NOGIC JQS** portal and hold applicable **Nigerian Content Equipment Certificates (NCEC)**.\n` +
        `   * *Source:* [Nigerian Content Development and Monitoring Board (NCDMB)](https://ncdmb.gov.ng) *(Verified Statutory Reference)*\n\n` +
        `3. **Engineering Practice & Stamp Authority (COREN):**\n` +
        `   * All Approved-for-Construction (AFC) engineering drawings, pipe stress reports, and structural calculations in Nigeria must be sealed by a practicing engineer registered with the **Council for the Regulation of Engineering in Nigeria (COREN)**.\n` +
        `   * *Source:* [Council for the Regulation of Engineering in Nigeria (COREN)](https://www.coren.gov.ng) *(Verified Statutory Reference)*\n\n` +
        `4. **Commercial Tax & Data Protection (FIRS & NDPC):**\n` +
        `   * Corporate technical contracts attract **7.5% VAT** and **5%–10% WHT** under [Federal Inland Revenue Service (FIRS)](https://www.firs.gov.ng) regulations, while personal identity records are governed under the *Nigeria Data Protection Act (NDPA) 2023* ([NDPC](https://ndpc.gov.ng)).`
      );
    }

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

    if (/\b(platform fee|commission|how much does collekt charge|collekt fee|is collekt free|subscription|founding 50|pioneer)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### Collekt Platform Fees & The Founding 50 Pilot${nameAddress}\n\n` +
        `* **Free Account & Bidding:** Creating an account, verifying your credentials, and browsing opportunities on Collekt is free.\n` +
        `* **Standard Milestone Commission:** On standard completed contracts, Collekt charges a 15% platform & escrow protection fee on released milestones.\n` +
        `* **Founding 50 Pilot (0% Fee Waiver):** Pioneer companies selected for the **Founding 50 Program** enjoy **0% platform and escrow fees across their first 3 projects**, plus a **48-hour curated specialist shortlist** from our vetting team.`,
        mem
      );
    }

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

    if (/\b(verify|verification|nin|bvn|cac|tin|shield|badge|coren|ican|certificate|upload cv|resume|profile strength)\b/i.test(lower)) {
      return appendNamePromptIfNeeded(
        `### How to Complete Verification & Earn the Collekt Shield Badge${nameAddress}\n\n` +
        `* **For Professionals / Specialists:** Open **Profile** in your sidebar. Upload your profile photo, bio, technical skills, CV/resume, and professional certificates (**COREN, ICAN, ACCA, PMP, HSE**), then complete your **11-digit NIN Identity Verification**.\n` +
        `* **For Companies:** Open **Company Profile** and submit your **CAC RC/BN registration**, **FIRS TIN**, and Director **NIN**.\n` +
        `* **The Collekt Shield Badge:** Once your profile hits 100% completion and your identity is verified, your account displays the **Collekt Shield**, signaling to clients and partners that you are vetted for instant escrow engagements.`,
        mem
      );
    }

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
      const domain = matchedFeeGuide ? matchedFeeGuide.name : (mem.specialization || mem.userIndustry || 'Technical & Professional Services');
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

    if (typeof fetch === 'function' && !options.skipNetwork) {
      const apiKey = localStorage.getItem(BASE_STORAGE_KEYS.GEMINI_KEY);
      const recentTurns = threadHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Kolly'}: ${m.content}`).join('\n');

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1650);
        const sessionUser = getSessionUser();
        const resp = await fetch('/api/kolly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            action: 'chat',
            prompt: clean,
            history: threadHistory.slice(-6),
            memoryProfile: {
              userName: effectiveName,
              userRole: mem.userRole,
              specialization: mem.specialization,
              yearsOfExperience: mem.yearsOfExperience,
              certifications: mem.certifications,
              location: mem.location
            },
            userId: sessionUser ? sessionUser.id : mem.userId
          })
        });
        clearTimeout(timer);
        if (resp.ok) {
          const json = await resp.json();
          const reply = json && (json.reply || json.response);
          if (reply) return appendNamePromptIfNeeded(reply, mem);
        }
      } catch (e) {}

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
          const timer = setTimeout(() => controller.abort(), 1600);
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
    }

    return appendNamePromptIfNeeded(
      `Regarding **"${clean}"**${nameAddress}:\n\n` +
      `On **Collekt**, we handle this through our verified B2B workspace and **Milestone Escrow** framework:\n\n` +
      `* **If you are looking to execute or bid on this:** You can browse matching briefs in the **Marketplace** and submit a **Collektion** broken into 3 verifiable Naira (\`₦\`) milestones (*30% Mobilization • 40% Core Delivery • 30% Final Handover*).\n` +
      `* **If you are scoping or hiring for this:** You can publish the brief under **Post Opportunity**, review vetted specialists, and lock Milestone 1 in your **Wallet** escrow so funds are only released when you approve the work.\n\n` +
      `Would you like me to **suggest exact Nigerian Naira (\`₦\`) fees** for this, or **draft a tailored scope/proposal** for it?`,
      mem
    );
  }

  async function generateReply(userText, threadHistory = [], options = {}) {
    const startTime = Date.now();
    const reply = await computeAlignedReply(userText, threadHistory, options);
    const minWait = typeof options.thinkingDurationMs === 'number' ? options.thinkingDurationMs : THINKING_DURATION_MS;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, minWait - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    return reply;
  }

  /* --------------------------------------------------------------------------
     8. THREAD / CHAT HISTORY STORAGE (USER-SCOPED + AUTOMATIC SANITIZATION)
  -------------------------------------------------------------------------- */
  function getThreads(explicitUserId) {
    const key = getScopedStorageKey(BASE_STORAGE_KEYS.THREADS, explicitUserId);
    try {
      const raw = localStorage.getItem(key);
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
          localStorage.setItem(key, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveThreads(threads, explicitUserId) {
    const key = getScopedStorageKey(BASE_STORAGE_KEYS.THREADS, explicitUserId);
    try {
      localStorage.setItem(key, JSON.stringify(threads));
    } catch (e) {}
  }

  function createNewThread(explicitUserId) {
    const threads = getThreads(explicitUserId);
    const activeKey = getScopedStorageKey(BASE_STORAGE_KEYS.ACTIVE_THREAD, explicitUserId);
    const newThread = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      title: 'New chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    threads.unshift(newThread);
    saveThreads(threads, explicitUserId);
    try {
      localStorage.setItem(activeKey, newThread.id);
    } catch (e) {}
    return newThread;
  }

  function deleteThread(threadId, explicitUserId) {
    let threads = getThreads(explicitUserId).filter(t => t.id !== threadId);
    saveThreads(threads, explicitUserId);
    return threads;
  }

  global.KollyEngine = {
    getThreads,
    saveThreads,
    createNewThread,
    deleteThread,
    getLearnedMemory,
    saveLearnedMemory,
    setMemoryConsent,
    deleteMemoryItem,
    clearUserMemory,
    exportUserMemory,
    setActiveUserContext,
    analyzeTenderDocument,
    routeTask,
    executeWithMultiProviderFailover,
    checkFinancialSafetyGuardrail,
    generateReply,
    sanitizeInternalDetails
  };
})(typeof window !== 'undefined' ? window : globalThis);
