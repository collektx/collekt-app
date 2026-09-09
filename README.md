# Collekt - Africa Energy & EPC Talent Infrastructure

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/collektx/collekt-app)

> **Empowering Africa's Engineering Renaissance**: End-to-end talent verification, tender bidding, milestone escrow contracts, and AI proposal copilot for oil, gas, renewable energy, and infrastructure engineering projects in Nigeria and across Africa.

---

## ? Live Deployments
- **Production URL**: [https://collektng.xyz](https://collektng.xyz)
- **GitHub Repository**: [https://github.com/collektx/collekt-app](https://github.com/collektx/collekt-app)

---

## ?? One-Click Deploy to Vercel

You can deploy this repository to **Vercel** with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/collektx/collekt-app)

### Required Environment Variables on Vercel:
When importing to Vercel, configure these environment variables in **Project Settings &rarr; Environment Variables**:

| Variable | Description |
|---|---|
| GEMINI_API_KEY | Google Gemini AI API key for proposal writing & tender copilot |
| PAYSTACK_SECRET_KEY | Paystack Secret Key (live or test mode) |
| PAYSTACK_PUBLIC_KEY | Paystack Public Key (live or test mode) |
| SUPABASE_URL | Supabase Project URL (https://<project-ref>.supabase.co) |
| SUPABASE_ANON_KEY | Supabase Public / Anon API Key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Service Role Key (for webhooks & ledger mutations) |

---

## ??? Architecture & Tech Stack

- **Frontend**: Lightweight, high-performance vanilla HTML5, CSS3 Glassmorphism, and modular ES6 JavaScript.
- **Backend**: Vercel Serverless Functions (/api/*) & Node.js Express engine.
- **Database & Realtime**: PostgreSQL on **Supabase** with Row-Level Security (RLS) and Realtime change streams.
- **File & Document Storage**: Supabase Storage (documents bucket for CVs, CAC, PDFs, DOCX; media bucket for avatars, logos, AI imagery).
- **Payments & Escrow**: **Paystack** Instant NUBAN virtual accounts, debit cards, bank transfers, and automated milestone release.
- **AI Copilot**: **Google Gemini 2.5 Flash** proposal engine with automated PDF compilation.

---

## ?? Local Development

1. **Clone the repository**:
   \\\ash
   git clone https://github.com/collektx/collekt-app.git
   cd collekt-app
   \\\

2. **Install dependencies**:
   \\\ash
   npm install
   \\\

3. **Start local development server**:
   \\\ash
   npm start
   \\\
   Or run using Vercel CLI:
   \\\ash
   npx vercel dev
   \\\

---

## ?? License
Collekt Metropolitan Services &copy; 2026. All rights reserved.