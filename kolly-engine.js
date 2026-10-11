/* ============================================================================
   KOLLY AI — CONVERSATIONAL BRAIN & CONTINUOUS LEARNING ENGINE (v2.2)
   Pure ChatGPT-style conversational intelligence for Collekt (collektng.com)
   Features:
   - Clean Emerald Circular "K" Logo branding
   - Proactive Name Personalization ("What would you like me to call you?")
   - Persistent Chat History Threads & Continuous Learning Memory
   - Full Collekt Platform Knowledge + Nigerian Naira Suggestive Fee Benchmarks
============================================================================ */

(function (global) {
  const STORAGE_KEYS = {
    THREADS: 'kolly_chatgpt_threads_v2',
    ACTIVE_THREAD: 'kolly_chatgpt_active_thread_v2',
    LEARNED_MEMORY: 'kolly_learned_knowledge_v2',
    GEMINI_KEY: 'collekt_gemini_api_key'
  };

  /* --------------------------------------------------------------------------
     1. COMPREHENSIVE COLLEKT KNOWLEDGE BASE
  -------------------------------------------------------------------------- */
  const COLLEKT_KNOWLEDGE = {
    about: {
      patterns: ['what is collekt', 'about collekt', 'what do you do', 'what does collekt do', 'explain collekt', 'who are you', 'what is this platform', 'how does collekt work', 'tell me about collekt'],
      answer: `**Collekt ([collektng.com](https://collektng.com))** is Nigeria’s verified B2B talent, tender, and milestone-escrow marketplace—built around one core promise: **"Zero Stories. Pure Delivery."**

Here is what we do and how the platform works:

1. **Verified Nigerian Specialists & Agencies:** We connect companies with identity-verified (NIN/BVN) and credential-verified (COREN, ICAN, NBA, GitHub/Portfolio) professionals across **Engineering & Energy (Oil & Gas, Subsea, Piping, Civil, Solar/Electrical, HSE)**, **Software & Tech**, **Product Design (UI/UX)**, and **Finance, Audit & Legal**.
2. **Structured Project Tenders & "Collektions":** Companies post a project or contract role (using [post-job.html](https://collektng.com/post-job.html)), and verified professionals submit structured proposals called **Collektions** broken into clear milestones and Naira (\`₦\`) budgets.
3. **100% Milestone Escrow Protection:** Instead of paying 50% upfront into someone's personal bank account and hoping they deliver, the company funds the project into a secure **Dedicated Virtual Account (NUBAN)** on Collekt. The money stays locked in Escrow and is **only released when the company clicks "Approve Deliverable."**
4. **Built-In Workspace:** Real-time encrypted messaging with delivery/read receipts, HD voice and video calls, NDA protection, and a secure document vault—all inside one dashboard.`
    },

    escrow_and_wallet: {
      patterns: ['escrow', 'wallet', 'nuban', 'paystack', 'korapay', 'deposit', 'fund', 'withdraw', 'payment', 'money', 'safe', 'refund', 'dispute', '50% upfront'],
      answer: `### How Collekt’s Milestone Escrow & Wallet Work

On Collekt, both companies and professionals are protected by our **double-entry Milestone Escrow Wallet** ([collektng.com/wallet.html](https://collektng.com/wallet.html)):

* **Step 1 — Fund Your Wallet via NUBAN:** Every user gets a Dedicated Virtual Account (powered by CBN-licensed rails via Paystack & KoraPay). You can fund your wallet by instant bank transfer or card.
* **Step 2 — Lock Funds into a Project Milestone:** When a company accepts a professional's *Collektion*, the agreed milestone amount is locked in Escrow. The professional can see that the money is secured before starting work.
* **Step 3 — Review & Approve to Release:** Once the professional submits the deliverable, the company inspects it. As soon as the company clicks **"Approve Milestone"**, the funds are released to the professional's Collekt Wallet for instant withdrawal to any Nigerian bank account.
* **Dispute Protection:** If a deliverable is not met as scoped, the funds remain safely locked in Escrow while Collekt’s dispute resolution team reviews the milestone evidence.`
    },

    hiring_and_companies: {
      patterns: ['hire', 'company', 'employer', 'post a job', 'tender', 'find engineer', 'find developer', 'find designer', 'shortlist', 'founding 50', 'pioneer'],
      answer: `### How Companies Hire on Collekt

If you are a company looking to hire a vetted specialist or contractor on **[collektng.com](https://collektng.com)**:

1. **Create a Company Account:** Sign up at [collektng.com/register.html](https://collektng.com/register.html) and select **Company**.
2. **Post a Project or Tender:** Go to **Post a Job** ([collektng.com/post-job.html](https://collektng.com/post-job.html)). Describe what you need built or executed, set your Naira budget, and define 2–3 milestones.
3. **Receive Vetted Collektions in 48 Hours:** Verified professionals matching your category will submit proposals with their credentials, timelines, and milestone pricing.
4. **Chat, Call & Kick Off in Escrow:** Interview shortlisted candidates via Collekt Messages ([collektng.com/messages.html](https://collektng.com/messages.html)) using text, voice, or video calls, then click **Accept** and fund Milestone 1 in Escrow.

> 💡 **The Collekt Founding 50 Pilot:** Right now, our first 50 partner companies get **0% platform & escrow fees on their first 3 projects**, a **48-hour concierge shortlist**, and **6 months of Corporate Pro** free.`
    },

    talent_and_bidding: {
      patterns: ['talent', 'professional', 'freelancer', 'get hired', 'apply', 'collektion', 'proposal', 'bid', 'verify', 'verification', 'nin', 'bvn', 'coren', 'ican', 'profile strength', 'cv'],
      answer: `### How Professionals Win Work on Collekt

If you are an engineer, developer, designer, accountant, or consultant on **[collektng.com](https://collektng.com)**:

1. **Complete Your Profile & Verification (Aim for 100% Profile Strength):**
   * Go to your **Profile** ([collektng.com/profile.html](https://collektng.com/profile.html)).
   * Add your title, bio, skills, and upload your **CV/Resume** and professional certificates (**COREN, ICAN, ACCA, NBA**, or portfolio links).
   * Complete your **NIN/BVN Identity Verification** so companies see the green **Verified Badge** next to your name.
2. **Browse Live Opportunities:**
   * Open the **Marketplace** ([collektng.com/marketplace.html](https://collektng.com/marketplace.html)) to view open company tenders.
3. **Submit a Strong "Collektion" (Proposal):**
   * Propose a clear **3-milestone breakdown** (e.g., *30% Initial Design/Spec, 40% Core Execution, 30% Final Handover*), realistic delivery days, and a direct pitch explaining similar projects you have delivered.
4. **Get Paid Instantly on Approval:**
   * Because the client locks the milestone money in Escrow before you start, you never have to chase invoices. Once your milestone is approved, withdraw straight to your Nigerian bank account in seconds.`
    },

    navigation: {
      patterns: ['navigate', 'where is', 'find page', 'links', 'menu', 'dashboard', 'settings', 'dark mode', 'messages', 'call'],
      answer: `### Quick Guide Around Collektng.com

Here is where to find everything on the website:

* 🏠 **Homepage:** [collektng.com](https://collektng.com) — Platform overview & Founding 50 details.
* 📊 **Dashboard:** [collektng.com/dashboard.html](https://collektng.com/dashboard.html) (or [company-dashboard.html](https://collektng.com/company-dashboard.html) for companies) — Your active Collektions, profile strength, uploaded documents, and recent activity.
* 🧭 **Marketplace:** [collektng.com/marketplace.html](https://collektng.com/marketplace.html) — Browse verified Nigerian specialists and live open tenders.
* 🚀 **Post a Job / Tender:** [collektng.com/post-job.html](https://collektng.com/post-job.html) — Scope and publish a new project.
* 📋 **Proposals (Collektions):** [collektng.com/proposals.html](https://collektng.com/proposals.html) — Review, accept, or track submitted proposals and active contracts.
* 🏦 **Escrow Wallet:** [collektng.com/wallet.html](https://collektng.com/wallet.html) — View your NUBAN virtual account, fund escrow milestones, and withdraw earnings.
* 💬 **Messages & Calls:** [collektng.com/messages.html](https://collektng.com/messages.html) — Real-time chat with WhatsApp-style blue read ticks, file sharing, and voice/video calling.
* 🛡️ **Profile & Verification:** [collektng.com/profile.html](https://collektng.com/profile.html) — Update your skills, upload certificates, and verify your identity.`
    }
  };

  /* --------------------------------------------------------------------------
     2. SUGGESTIVE PRICING & MATCHING BENCHMARKS
  -------------------------------------------------------------------------- */
  const FEE_GUIDES = [
    {
      name: 'Oil, Gas, Subsea, Piping & Mechanical Engineering',
      keywords: ['subsea', 'piping', 'pipeline', 'offshore', 'epc', 'mechanical', 'process', 'coren', 'rig', 'oil', 'gas', 'welding', 'structural'],
      shortSprint: '₦650,000 – ₦1,200,000 (1–2 weeks)',
      standardProject: '₦1,800,000 – ₦3,500,000 (3–6 weeks)',
      complexPackage: '₦5,000,000 – ₦14,500,000+ (2–3 months)',
      recommendedSplit: '30% Basis of Design & P&ID • 40% 3D Modeling & Isometrics • 30% Final COREN-Stamped Handover',
      keySkills: 'COREN Registration, AutoCAD Plant 3D, Caesar II, PDMS/E3D, ASME/API standards'
    },
    {
      name: 'Civil, Structural, Electrical, Solar & HSE',
      keywords: ['civil', 'solar', 'electrical', 'inverter', 'construction', 'boq', 'quantity surveyor', 'architect', 'hse', 'safety', 'building'],
      shortSprint: '₦400,000 – ₦850,000 (1–2 weeks)',
      standardProject: '₦1,350,000 – ₦2,600,000 (3–6 weeks)',
      complexPackage: '₦4,000,000 – ₦11,000,000+ (2–3 months)',
      recommendedSplit: '30% Site Survey & Priced BOQ • 40% Engineering Drawings & Spec • 30% Commissioning & Sign-Off',
      keySkills: 'COREN / NIQS / NEMSA / NEBOSH HSE certifications, itemized BOQ preparation'
    },
    {
      name: 'Software Development, Web, Mobile Apps & AI',
      keywords: ['software', 'developer', 'app', 'mobile', 'website', 'web', 'frontend', 'backend', 'fullstack', 'react', 'flutter', 'fintech', 'api', 'ai', 'cybersecurity', 'qa'],
      shortSprint: '₦450,000 – ₦900,000 (1–2 weeks)',
      standardProject: '₦1,400,000 – ₦3,200,000 (3–6 weeks)',
      complexPackage: '₦4,200,000 – ₦12,000,000+ (2–3 months)',
      recommendedSplit: '25% Architecture, UI & Staging Link • 50% Core APIs & Feature Build • 25% QA Testing & Live Deployment',
      keySkills: 'Verified GitHub & live production links, Paystack/KoraPay API experience, automated QA'
    },
    {
      name: 'UI/UX Product Design, Branding & Pitch Decks',
      keywords: ['ui', 'ux', 'design', 'designer', 'figma', 'brand', 'logo', 'pitch deck', 'video', 'graphic', 'prototype'],
      shortSprint: '₦280,000 – ₦600,000 (1–2 weeks)',
      standardProject: '₦850,000 – ₦1,800,000 (3–5 weeks)',
      complexPackage: '₦2,500,000 – ₦5,500,000+ (Full Design System)',
      recommendedSplit: '30% User Flows & Wireframes • 45% High-Fidelity Mobile/Desktop UI • 25% Design System & Dev Handoff',
      keySkills: 'Interactive Figma prototypes, mobile-first & dark-mode design systems'
    },
    {
      name: 'Finance, Accounting, Audit, Tax & Legal Compliance',
      keywords: ['finance', 'accountant', 'audit', 'tax', 'ican', 'acca', 'legal', 'lawyer', 'contract', 'ndpa', 'cac', 'financial model'],
      shortSprint: '₦250,000 – ₦550,000 (1–2 weeks)',
      standardProject: '₦800,000 – ₦2,200,000 (3–5 weeks)',
      complexPackage: '₦2,500,000 – ₦7,500,000+ (Retained / Full Audit)',
      recommendedSplit: '35% Data Room Diagnostic • 40% Draft Model / Audit / Agreements • 25% Final Signed Report & Filing',
      keySkills: 'ICAN / ACCA / NBA accreditation, NDPA 2023 compliance, FIRS tax advisory'
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
      const isQuestionOrCommand = /\b(what|how|why|where|when|who|can|help|collekt|escrow|fee|budget|hire|job|wallet|no|skip|later)\b/i.test(clean);
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

    // Learn user's role
    if (/\b(we want to hire|we need a|our company|my company|i want to hire|post a job|looking for a)\b/i.test(lower)) {
      mem.userRole = 'company';
    } else if (/\b(i am a|i'm a|my skills|how much should i charge|how much should i bid|my cv|find work)\b/i.test(lower)) {
      mem.userRole = 'talent';
    }

    // Learn user's industry
    for (const fg of FEE_GUIDES) {
      if (fg.keywords.some(k => lower.includes(k))) {
        mem.userIndustry = fg.name;
        mem.topicFrequency[fg.name] = (mem.topicFrequency[fg.name] || 0) + 1;
        break;
      }
    }

    // Learn user's budget if mentioned
    const budgetMatch = lower.match(/(?:₦|ngn|naira)?\s*(\d+(?:\.\d+)?)\s*(m|million|k|thousand)\b/i);
    if (budgetMatch) {
      let val = parseFloat(budgetMatch[1]);
      if (budgetMatch[2].toLowerCase().startsWith('m')) val *= 1000000;
      else val *= 1000;
      mem.userBudget = Math.round(val);
    }

    // Check if the user is teaching Kolly a specific rule/fact
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
    if (!mem.userName && !mem.askedForNameOnce) {
      mem.awaitingName = true;
      mem.askedForNameOnce = true;
      saveLearnedMemory(mem);
      return `${replyText}\n\n---\n*By the way, I’d love to personalize our chats—**what would you like me to call you?***`;
    }
    if (mem.awaitingName && !mem.userName) {
      mem.awaitingName = false;
      saveLearnedMemory(mem);
    }
    return replyText;
  }

  /* --------------------------------------------------------------------------
     4. CONVERSATIONAL ANSWER GENERATOR
  -------------------------------------------------------------------------- */
  async function generateReply(userText, threadHistory = []) {
    const clean = (userText || '').trim();
    const lower = clean.toLowerCase();
    const { mem, justLearnedName } = learnFromMessage(clean);

    // If user just told Kolly their preferred name
    if (justLearnedName && clean.split(/\s+/).length <= 6) {
      return `Pleasure to meet you, **${mem.userName}**! I’ve saved your name to my memory so I’ll always address you as **${mem.userName}**.\n\nWhat would you like to explore on **Collekt ([collektng.com](https://collektng.com))** today—hiring a verified specialist, estimating Nigerian Naira project fees, understanding Milestone Escrow, or navigating the platform?`;
    }

    const namePrefix = mem.userName ? `${mem.userName}, ` : '';

    // 1. If user explicitly taught Kolly a custom rule/fact
    if (/\b(remember that|note that|keep in mind that|learn this:)\b/i.test(lower)) {
      return `Got it${mem.userName ? ', **' + mem.userName + '**' : ''}—I’ve saved that to my memory:\n\n> *"${mem.customFacts[mem.customFacts.length - 1]}"*\n\nI’ll factor this into all my future recommendations and answers for you. What would you like to work on next?`;
    }

    // 2. If user asks what Kolly knows/remembers about them
    if (/\b(what do you know about me|what is my name|what have you learned|do you remember me|my memory)\b/i.test(lower)) {
      const factsList = mem.customFacts.length
        ? mem.customFacts.map(f => `* "${f}"`).join('\n')
        : '* No custom rules added yet (you can tell me *"Remember that..."* anytime).';
      return `Here is what I remember from our chats:\n\n* **Preferred Name:** ${mem.userName || 'Not set yet (tell me *"Call me [Name]"* anytime!)'}\n* **Questions Answered Together:** ${mem.questionsAskedCount}\n* **Detected Perspective:** ${mem.userRole ? (mem.userRole === 'company' ? 'Hiring Company / Client' : 'Professional / Talent') : 'Exploring Collekt'}\n* **Industry Focus:** ${mem.userIndustry || 'General B2B & Contracting'}\n* **Last Mentioned Budget:** ${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'Not specified yet'}\n\n**Notes & Preferences You Taught Me:**\n${factsList}`;
    }

    // 3. Check if user has a live Gemini API key configured
    const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
    if (apiKey && apiKey.startsWith('AIza')) {
      try {
        const recentTurns = threadHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Kolly'}: ${m.content}`).join('\n');
        const systemPrompt = `You are Kolly, the official AI Assistant and Advisor for Collekt (https://collektng.com), Nigeria's verified B2B talent, tender, and milestone-escrow marketplace ("Zero Stories. Pure Delivery.").
Preferred User Name: ${mem.userName || 'not yet known'}.
Learned User Context: Role=${mem.userRole || 'unknown'}, Industry=${mem.userIndustry || 'general'}, Budget=${mem.userBudget ? '₦' + mem.userBudget.toLocaleString() : 'unspecified'}, Custom Notes=${mem.customFacts.join('; ')}.`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nRecent Conversation:\n${recentTurns}\n\nUser: ${clean}` }] }]
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) return appendNamePromptIfNeeded(aiText, mem);
        }
      } catch (e) {}
    }

    // 4. Built-in Conversational Intelligence
    let matchedFeeGuide = null;
    for (const fg of FEE_GUIDES) {
      if (fg.keywords.some(k => lower.includes(k))) {
        matchedFeeGuide = fg;
        break;
      }
    }

    const asksAboutFeeOrScope = /\b(fee|price|cost|charge|budget|how much|estimate|rate|salary|scope|milestone|hire|need a|looking for|bid)\b/i.test(lower);

    if (matchedFeeGuide && asksAboutFeeOrScope) {
      const budgetNote = mem.userBudget
        ? `\n\nSince you mentioned **₦${mem.userBudget.toLocaleString()}**, here is how I recommend splitting that exact amount into **3 protected Collekt Escrow Milestones**:\n* **Milestone 1 (30% — ₦${Math.round(mem.userBudget * 0.3).toLocaleString()}):** Mobilization, specification & initial deliverable.\n* **Milestone 2 (40% — ₦${Math.round(mem.userBudget * 0.4).toLocaleString()}):** Core execution, review & quality verification.\n* **Milestone 3 (30% — ₦${Math.round(mem.userBudget * 0.3).toLocaleString()}):** Final sign-off & handover.`
        : '';

      const ans = `### Suggested Nigerian Market Fees & Milestones: ${matchedFeeGuide.name}

${mem.userName ? `Here is the breakdown for you, **${mem.userName}**—based` : 'Based'} on current project benchmarks on **Collekt ([collektng.com](https://collektng.com))**:

* **Short Sprint / Audit (1–2 Weeks):** \`${matchedFeeGuide.shortSprint}\`
* **Standard Project Execution (3–6 Weeks):** \`${matchedFeeGuide.standardProject}\` *(Most Popular)*
* **Complex / Senior Work Package (2–3 Months):** \`${matchedFeeGuide.complexPackage}\`

#### Recommended Milestone Escrow Split
* **${matchedFeeGuide.recommendedSplit}**${budgetNote}

#### What to Look For (Suggestive Matching Criteria)
* **Key Credentials & Skills:** ${matchedFeeGuide.keySkills}
* **Next Step on Collekt:** Post this scope on **[collektng.com/post-job.html](https://collektng.com/post-job.html)** (with **0% fee** under the *Founding 50 Company Pilot*), or browse verified specialists on **[collektng.com/marketplace.html](https://collektng.com/marketplace.html)**.`;

      return appendNamePromptIfNeeded(ans, mem);
    }

    for (const key of Object.keys(COLLEKT_KNOWLEDGE)) {
      const sec = COLLEKT_KNOWLEDGE[key];
      if (sec.patterns.some(p => lower.includes(p))) {
        return appendNamePromptIfNeeded(sec.answer, mem);
      }
    }

    if (matchedFeeGuide) {
      const ans = `${namePrefix ? `Sure **${mem.userName}**! ` : ''}I see you’re asking about **${matchedFeeGuide.name}** on Collekt.\n\nHere is how we handle this category on **[collektng.com](https://collektng.com)**:\n\n* **Typical Project Rates:** \`${matchedFeeGuide.standardProject}\` for a standard 3–6 week engagement (or \`${matchedFeeGuide.shortSprint}\` for a 1–2 week sprint).\n* **Recommended Escrow Structure:** ${matchedFeeGuide.recommendedSplit}.\n* **Verification Standards:** Look for professionals with **${matchedFeeGuide.keySkills}**.\n\nWould you like me to draft a complete **project description & milestone breakdown** you can paste into [Post a Job](https://collektng.com/post-job.html), or write a **winning Collektion proposal** for this role?`;
      return appendNamePromptIfNeeded(ans, mem);
    }

    const fallback = `${mem.userName ? `Hi **${mem.userName}**! ` : ''}Here is how **Collekt ([collektng.com](https://collektng.com))** helps with that:

1. **If you are hiring as a Company:**
   * Post your brief on **[Post a Job](https://collektng.com/post-job.html)** or request our **48-Hour Curated Shortlist** under the **Founding 50 Pilot (0% platform fee on your first 3 projects)**.
   * Lock milestone funds safely in your **Dedicated NUBAN Escrow Wallet** ([wallet.html](https://collektng.com/wallet.html))—you only release payment when you approve the deliverable.

2. **If you are a Professional / Talent:**
   * Verify your identity (NIN/BVN) and upload your credentials (COREN, ICAN, portfolio, CV) on **[Profile](https://collektng.com/profile.html)**.
   * Browse open projects on **[Marketplace](https://collektng.com/marketplace.html)** and submit structured **Collektions** ([proposals.html](https://collektng.com/proposals.html)).

3. **Want Suggested Naira Fees or Project Scoping?**
   * Tell me the **role or project** you have in mind (for example: *"How much should we budget for a Subsea Piping Engineer?"* or *"Help me scope a fintech mobile app with a ₦2.5M budget"*) and I will break down the exact market rate and milestones for you.`;

    return appendNamePromptIfNeeded(fallback, mem);
  }

  /* --------------------------------------------------------------------------
     5. THREAD / CHAT HISTORY STORAGE
  -------------------------------------------------------------------------- */
  function getThreads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.THREADS);
      if (raw) return JSON.parse(raw);
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
    generateReply
  };
})(window);
