-- Migration: Fix "Database error saving new user" on signup
-- Root cause: public.handle_new_user() and supabase.js referenced columns on public.profiles
-- (terms_accepted, terms_accepted_at, terms_version, recaptcha_verified, etc.) that had not yet
-- been added to the live public.profiles table.

-- 1. Add missing columns to public.profiles required by handle_new_user() and supabase.js
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text DEFAULT '2026.1',
  ADD COLUMN IF NOT EXISTS recaptcha_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS turnstile_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Make virtual account trigger resilient so it can never abort profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_virtual_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM public.provision_user_virtual_account(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Non-fatal error provisioning virtual account for profile %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 3. Make handle_new_user() comprehensive and exception-safe so auth.users insert never fails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_name text;
  v_first_name text;
  v_last_name text;
  v_other_name text;
  v_rep_first_name text;
  v_rep_last_name text;
  v_rep_other_name text;
  v_company text;
  v_title text;
  v_industry text;
  v_cac text;
  v_country text;
  v_state text;
  v_location text;
  v_terms_accepted boolean;
  v_terms_accepted_at timestamptz;
  v_terms_version text;
  v_recaptcha_verified boolean;
  v_turnstile_verified boolean;
BEGIN
  v_role := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''), 'professional');
  IF v_role NOT IN ('professional', 'company', 'admin') THEN
    v_role := 'professional';
  END IF;

  v_first_name := COALESCE(new.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(new.raw_user_meta_data->>'last_name', '');
  v_other_name := COALESCE(new.raw_user_meta_data->>'other_name', '');
  v_rep_first_name := COALESCE(new.raw_user_meta_data->>'rep_first_name', '');
  v_rep_last_name := COALESCE(new.raw_user_meta_data->>'rep_last_name', '');
  v_rep_other_name := COALESCE(new.raw_user_meta_data->>'rep_other_name', '');

  v_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(CONCAT_WS(' ', NULLIF(v_first_name, ''), NULLIF(v_other_name, ''), NULLIF(v_last_name, ''))), ''),
    split_part(COALESCE(new.email, 'User'), '@', 1)
  );

  v_company := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'company_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'company'), ''),
    CASE WHEN v_role = 'company' THEN v_name ELSE '' END
  );

  v_title := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'title'), ''),
    CASE WHEN v_role = 'company' THEN 'Verified Client Partner' ELSE 'Independent Specialist' END
  );

  v_industry := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'industry'), ''), 'Energy & Infrastructure');
  v_cac := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'cac_number'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'cac'), ''),
    ''
  );
  v_country := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'country'), ''), 'Nigeria');
  v_state := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'state'), ''), 'Lagos');
  v_location := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'location'), ''),
    CASE WHEN v_state <> '' THEN v_state || ', ' || v_country ELSE v_country END
  );

  v_terms_accepted := COALESCE((new.raw_user_meta_data->>'terms_accepted')::boolean, true);
  BEGIN
    v_terms_accepted_at := COALESCE((new.raw_user_meta_data->>'terms_accepted_at')::timestamptz, now());
  EXCEPTION WHEN OTHERS THEN
    v_terms_accepted_at := now();
  END;
  v_terms_version := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'terms_version'), ''), '2026.1');
  v_recaptcha_verified := COALESCE((new.raw_user_meta_data->>'recaptcha_verified')::boolean, false);
  v_turnstile_verified := COALESCE((new.raw_user_meta_data->>'turnstile_verified')::boolean, false);

  BEGIN
    INSERT INTO public.profiles (
      id, email, name, first_name, last_name, other_name,
      rep_first_name, rep_last_name, rep_other_name,
      role, company_name, title, industry, cac, cac_number,
      country, state, location, is_verified, verification_status,
      email_verified, otp_verified, terms_accepted, terms_accepted_at,
      terms_version, recaptcha_verified, turnstile_verified,
      created_at, updated_at
    ) VALUES (
      new.id,
      new.email,
      v_name,
      v_first_name,
      v_last_name,
      v_other_name,
      v_rep_first_name,
      v_rep_last_name,
      v_rep_other_name,
      v_role,
      v_company,
      v_title,
      v_industry,
      v_cac,
      v_cac,
      v_country,
      v_state,
      v_location,
      false,
      'unsubmitted',
      false,
      false,
      v_terms_accepted,
      v_terms_accepted_at,
      v_terms_version,
      v_recaptcha_verified,
      v_turnstile_verified,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name),
      first_name = COALESCE(NULLIF(public.profiles.first_name, ''), EXCLUDED.first_name),
      last_name = COALESCE(NULLIF(public.profiles.last_name, ''), EXCLUDED.last_name),
      other_name = COALESCE(NULLIF(public.profiles.other_name, ''), EXCLUDED.other_name),
      rep_first_name = COALESCE(NULLIF(public.profiles.rep_first_name, ''), EXCLUDED.rep_first_name),
      rep_last_name = COALESCE(NULLIF(public.profiles.rep_last_name, ''), EXCLUDED.rep_last_name),
      rep_other_name = COALESCE(NULLIF(public.profiles.rep_other_name, ''), EXCLUDED.rep_other_name),
      role = COALESCE(NULLIF(public.profiles.role, ''), EXCLUDED.role),
      company_name = COALESCE(NULLIF(public.profiles.company_name, ''), EXCLUDED.company_name),
      title = COALESCE(NULLIF(public.profiles.title, ''), EXCLUDED.title),
      industry = COALESCE(NULLIF(public.profiles.industry, ''), EXCLUDED.industry),
      cac = COALESCE(NULLIF(public.profiles.cac, ''), EXCLUDED.cac),
      cac_number = COALESCE(NULLIF(public.profiles.cac_number, ''), EXCLUDED.cac_number),
      country = COALESCE(NULLIF(public.profiles.country, ''), EXCLUDED.country),
      state = COALESCE(NULLIF(public.profiles.state, ''), EXCLUDED.state),
      location = COALESCE(NULLIF(public.profiles.location, ''), EXCLUDED.location),
      terms_accepted = COALESCE(public.profiles.terms_accepted, EXCLUDED.terms_accepted),
      terms_accepted_at = COALESCE(public.profiles.terms_accepted_at, EXCLUDED.terms_accepted_at),
      terms_version = COALESCE(NULLIF(public.profiles.terms_version, ''), EXCLUDED.terms_version),
      recaptcha_verified = COALESCE(public.profiles.recaptcha_verified, EXCLUDED.recaptcha_verified),
      turnstile_verified = COALESCE(public.profiles.turnstile_verified, EXCLUDED.turnstile_verified),
      updated_at = now();
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.profiles
      SET
        name = COALESCE(NULLIF(v_name, ''), name),
        role = COALESCE(NULLIF(v_role, ''), role),
        company_name = COALESCE(NULLIF(v_company, ''), company_name),
        terms_accepted = v_terms_accepted,
        terms_accepted_at = v_terms_accepted_at,
        terms_version = v_terms_version,
        updated_at = now()
      WHERE lower(email) = lower(new.email);
    WHEN OTHERS THEN
      RAISE WARNING 'Non-fatal error creating profile for new user %: %', new.id, SQLERRM;
  END;

  -- Provision Wallet automatically
  BEGIN
    INSERT INTO public.wallets (user_id, available_balance, escrow_balance, total_earned, total_spent, updated_at)
    VALUES (new.id, 0, 0, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Non-fatal error creating wallet for new user %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$function$;
