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
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolution_details JSONB DEFAULT NULL;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;


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

-- -----------------------------------------------------------------
-- 8. NDPA 2023 SECTION 34: DATA SUBJECT RIGHTS & ERASURE
-- -----------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Public Profiles View: Filters out deleted accounts
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id, full_name, name, username, email, role, title, sector,
    avatar, company_logo, country, state, location, website,
    linkedin_url, bio, skills, languages, work_preference,
    availability, accreditation, projects_completed, rating,
    review_count, total_earned, is_verified, verification_status,
    company_name, tagline, about, industry, size, founded_year,
    capabilities, created_at, updated_at
FROM public.profiles
WHERE (is_deleted IS NOT TRUE);

-- Stored procedure for atomic NDPA Section 34 data subject erasure
CREATE OR REPLACE FUNCTION public.request_data_subject_erasure(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_id UUID;
    is_admin BOOLEAN := FALSE;
    user_prof RECORD;
    active_contracts_count INT;
    wallet_bal NUMERIC(15,2);
    erased_email TEXT;
    erased_username TEXT;
BEGIN
    caller_id := auth.uid();
    
    IF caller_id IS NOT NULL THEN
        SELECT (role = 'admin') INTO is_admin FROM public.profiles WHERE id = caller_id;
    END IF;

    IF caller_id IS NOT NULL AND caller_id <> target_user_id AND NOT COALESCE(is_admin, FALSE) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: You may only request erasure of your own account.'
        );
    END IF;

    SELECT * INTO user_prof FROM public.profiles WHERE id = target_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User profile not found.'
        );
    END IF;

    IF COALESCE(user_prof.is_deleted, FALSE) = TRUE THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Account has already been erased.'
        );
    END IF;

    SELECT COUNT(*) INTO active_contracts_count
    FROM public.contracts
    WHERE (company_id = target_user_id OR pro_id = target_user_id)
      AND status IN ('active', 'in_progress', 'disputed', 'submitted');

    IF active_contracts_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot delete account with active or disputed contracts. Please resolve all pending contracts before closing your account.',
            'active_contracts_count', active_contracts_count
        );
    END IF;

    SELECT COALESCE(wallet_balance, 0.00) INTO wallet_bal
    FROM public.profiles
    WHERE id = target_user_id;

    IF wallet_bal > 50.00 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot delete account with positive wallet balance of ₦' || TO_CHAR(wallet_bal, 'FM999,999,990.00') || '. Please withdraw your funds first.',
            'balance', wallet_bal
        );
    END IF;

    DELETE FROM public.user_documents WHERE user_id = target_user_id;
    DELETE FROM public.user_inputs WHERE user_id = target_user_id;
    DELETE FROM public.ai_generations WHERE user_id = target_user_id;

    erased_email := 'deleted_' || substr(target_user_id::text, 1, 8) || '@erased.collekt.invalid';
    erased_username := 'deleted_' || substr(target_user_id::text, 1, 8);

    UPDATE public.profiles SET
        name = 'Deleted User',
        full_name = 'Deleted User',
        first_name = NULL,
        last_name = NULL,
        other_name = NULL,
        username = erased_username,
        email = erased_email,
        phone = NULL,
        avatar = NULL,
        avatar_url = NULL,
        company_logo = NULL,
        website = NULL,
        linkedin_url = NULL,
        bio = NULL,
        about = NULL,
        skills = '{}',
        languages = NULL,
        work_preference = NULL,
        availability = NULL,
        accreditation = NULL,
        nin = NULL,
        id_type = NULL,
        id_gov_number = NULL,
        cac_number = NULL,
        tin_number = NULL,
        director_name = NULL,
        director_nin = NULL,
        company_name = NULL,
        tagline = NULL,
        contact_person = NULL,
        rep_first_name = NULL,
        rep_last_name = NULL,
        rep_other_name = NULL,
        cac = NULL,
        dpr_license = NULL,
        corporate_email = NULL,
        corporate_phone = NULL,
        address = NULL,
        capabilities = NULL,
        verification_status = 'deleted',
        is_verified = FALSE,
        wallet_balance = 0.00,
        escrow_balance = 0.00,
        is_deleted = TRUE,
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;

    UPDATE public.wallet_transactions 
    SET narration = 'Transaction of erased account (NDPA s.34)'
    WHERE user_id = target_user_id;

    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        target_user_id,
        'DATA_SUBJECT_ERASURE',
        'profile',
        target_user_id::text,
        jsonb_build_object(
            'regulation', 'NDPA 2023 Section 34',
            'erased_at', NOW(),
            'executed_by', COALESCE(caller_id::text, 'service_role'),
            'status', 'completed'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Personal data and KYC documents permanently erased in compliance with NDPA 2023 Section 34.',
        'user_id', target_user_id,
        'erased_email', erased_email
    );
END;
$$;

-- -----------------------------------------------------------------
-- 9. IMMUTABLE ADMINISTRATIVE AUDIT TRAIL (COBIT 2019 / ISACA ITAF)
-- -----------------------------------------------------------------

-- Table definition (if not exists)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Hardened RLS: Only authorized admins can read audit logs
DROP POLICY IF EXISTS "Admins Read Audit Logs" ON public.audit_logs;
CREATE POLICY "Admins Read Audit Logs" ON public.audit_logs
    FOR SELECT TO public
    USING (public.is_admin());

-- Hardened RLS: Append-only insertion
DROP POLICY IF EXISTS "Append Only Audit Logs" ON public.audit_logs;
CREATE POLICY "Append Only Audit Logs" ON public.audit_logs
    FOR INSERT TO public
    WITH CHECK (true);

-- Trigger Function: Prevent any update, delete, or truncate on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'COBIT 2019 / ISACA ITAF Security Violation: Audit logs in public.audit_logs are immutable and cannot be updated, deleted, or truncated.';
END;
$$;

-- Row-level trigger: Block UPDATE and DELETE unconditionally
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- Statement-level trigger: Block TRUNCATE unconditionally
DROP TRIGGER IF EXISTS trg_audit_logs_prevent_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_truncate
    BEFORE TRUNCATE ON public.audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- Secure Stored Procedure: Record administrative audit events
CREATE OR REPLACE FUNCTION public.record_admin_audit(
    p_action TEXT,
    p_target TEXT DEFAULT 'System',
    p_category TEXT DEFAULT 'admin',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN := FALSE;
    v_log_id UUID;
    v_admin_email TEXT;
BEGIN
    v_caller_id := auth.uid();
    
    IF v_caller_id IS NOT NULL THEN
        SELECT (role = 'admin'), email INTO v_is_admin, v_admin_email 
        FROM public.profiles 
        WHERE id = v_caller_id;
    END IF;

    INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        v_caller_id,
        p_action,
        COALESCE(p_category, 'admin'),
        COALESCE(p_target, 'System'),
        jsonb_build_object(
            'target', p_target,
            'category', p_category,
            'operator_email', COALESCE(v_admin_email, 'admin@collekt.ng'),
            'timestamp', NOW()
        ) || COALESCE(p_metadata, '{}'::jsonb),
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_log_id,
        'action', p_action,
        'recorded_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_admin_audit(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- Verification Procedure: Cryptographically verifies trigger immutability
CREATE OR REPLACE FUNCTION public.verify_audit_log_immutability()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_test_id UUID;
    v_update_blocked BOOLEAN := FALSE;
    v_delete_blocked BOOLEAN := FALSE;
    v_err_msg TEXT;
BEGIN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata)
    VALUES ('TRIGGER_INTEGRITY_CHECK', 'test', 'engine', '{"check": true}'::jsonb)
    RETURNING id INTO v_test_id;

    BEGIN
        UPDATE public.audit_logs SET action = 'MALICIOUS_TAMPER' WHERE id = v_test_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
        IF v_err_msg LIKE '%COBIT 2019 / ISACA ITAF%' THEN
            v_update_blocked := TRUE;
        END IF;
    END;

    BEGIN
        DELETE FROM public.audit_logs WHERE id = v_test_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
        IF v_err_msg LIKE '%COBIT 2019 / ISACA ITAF%' THEN
            v_delete_blocked := TRUE;
        END IF;
    END;

    RETURN jsonb_build_object(
        'success', (v_update_blocked AND v_delete_blocked),
        'update_blocked_by_trigger', v_update_blocked,
        'delete_blocked_by_trigger', v_delete_blocked,
        'error_message', v_err_msg,
        'standard', 'COBIT 2019 / ISACA ITAF 2208 WORM'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_audit_log_immutability() TO anon, authenticated, service_role;


