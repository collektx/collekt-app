-- =================================================================
-- COLLEKT PLATFORM - PRODUCTION SUPABASE DATABASE SCHEMA & RLS
-- Run this SQL in your Supabase Project SQL Editor (https://app.supabase.com)
-- =================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------
-- 1. PROFILES TABLE (Professionals & Companies)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'professional',
    title TEXT DEFAULT 'Energy Specialist',
    sector TEXT DEFAULT 'Oil & Gas (Upstream/Midstream)',
    avatar TEXT,
    company_logo TEXT,
    country TEXT DEFAULT 'Nigeria',
    state TEXT DEFAULT 'Lagos',
    location TEXT DEFAULT 'Lagos, Nigeria',
    phone TEXT,
    website TEXT,
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    languages TEXT DEFAULT 'English',
    work_preference TEXT DEFAULT 'Hybrid',
    availability TEXT DEFAULT 'Available Immediately',
    accreditation TEXT,
    projects_completed INT DEFAULT 0,
    rating NUMERIC(3,2) DEFAULT 0.0,
    review_count INT DEFAULT 0,
    total_earned NUMERIC(15,2) DEFAULT 0.00,
    wallet_balance NUMERIC(15,2) DEFAULT 0.00,
    escrow_balance NUMERIC(15,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status TEXT DEFAULT 'none',
    verification_submitted_at TIMESTAMPTZ,
    nin TEXT,
    id_type TEXT,
    id_gov_number TEXT,
    cac_number TEXT,
    tin_number TEXT,
    director_name TEXT,
    director_nin TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- 2. TENDERS / JOBS TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenders (
    id TEXT PRIMARY KEY DEFAULT ('job_' || extract(epoch from now())::bigint),
    company_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    title TEXT NOT NULL,
    budget NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency TEXT DEFAULT 'NGN',
    deadline DATE,
    sector TEXT DEFAULT 'Oil & Gas',
    location TEXT DEFAULT 'Lagos, Nigeria',
    description TEXT NOT NULL,
    skills_required TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'open',
    proposals_count INT DEFAULT 0,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- 3. PROPOSALS / BIDS TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
    id TEXT PRIMARY KEY DEFAULT ('prop_' || extract(epoch from now())::bigint),
    tender_id TEXT,
    pro_id UUID,
    pro_name TEXT,
    pro_email TEXT,
    bid_amount NUMERIC(15,2),
    delivery_days INT DEFAULT 14,
    pitch_statement TEXT,
    status TEXT DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema Migration Fix: Ensure missing columns exist if table was created previously
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS tender_id TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS pro_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS pro_name TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS pro_email TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS bid_amount NUMERIC(15,2);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS delivery_days INT DEFAULT 14;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS pitch_statement TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';

-- -----------------------------------------------------------------
-- 4. CONTRACTS & ESCROW TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
    id TEXT PRIMARY KEY DEFAULT ('ctr_' || extract(epoch from now())::bigint),
    tender_id TEXT,
    project_title TEXT NOT NULL,
    company_id UUID,
    company_email TEXT,
    pro_id UUID,
    pro_email TEXT,
    amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'active',
    is_escrow_locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS tender_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS pro_id UUID;

-- -----------------------------------------------------------------
-- 5. ESCROW DISPUTES TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
    id TEXT PRIMARY KEY DEFAULT ('DSP_' || extract(epoch from now())::bigint),
    contract_id TEXT,
    project_title TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    filed_by TEXT NOT NULL,
    filed_by_role TEXT NOT NULL,
    category TEXT NOT NULL,
    statement TEXT NOT NULL,
    status TEXT DEFAULT 'under_arbitration',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS contract_id TEXT;

-- -----------------------------------------------------------------
-- 6. REVIEWS & RATINGS TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY DEFAULT ('rev_' || extract(epoch from now())::bigint),
    reviewer_id UUID,
    reviewer_name TEXT NOT NULL,
    target_id UUID,
    project_title TEXT NOT NULL,
    rating INT DEFAULT 5,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- 7. TRANSACTIONS & PAYSTACK LOGS
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT ('tx_' || extract(epoch from now())::bigint),
    user_id UUID,
    type TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    reference TEXT,
    paystack_channel TEXT,
    bank_name TEXT,
    account_number TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if re-running
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public Read Tenders" ON public.tenders;
DROP POLICY IF EXISTS "Public Read Reviews" ON public.reviews;
DROP POLICY IF EXISTS "User Update Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "User Insert Proposals" ON public.proposals;
DROP POLICY IF EXISTS "User View Proposals" ON public.proposals;
DROP POLICY IF EXISTS "User View Own Proposals" ON public.proposals;

-- Allow Access Policies
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public Read Tenders" ON public.tenders FOR SELECT USING (true);
CREATE POLICY "Public Read Reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "User Update Own Profile" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "User Insert Proposals" ON public.proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "User View Proposals" ON public.proposals FOR SELECT USING (true);

-- Trigger: Automatically Sync Auth Users to Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'professional')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
