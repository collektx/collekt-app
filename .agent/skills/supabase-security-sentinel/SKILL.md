---
name: supabase-security-sentinel
description: >-
  Audits Supabase database schemas, Row-Level Security (RLS) policies, storage bucket rules,
  and authentic user data integrity.
---

# Supabase Security Sentinel & RLS Auditor

Use this skill when modifying database schemas, writing Supabase RPC functions, or reviewing access policies to guarantee strict multi-tenant isolation and zero mock data leakage.

## Security Directives

1. **Row-Level Security (RLS) Enforcement**:
   - RLS must be enabled on every table exposed via PostgREST:
     ```sql
     ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
     ALTER TABLE escrow_contracts ENABLE ROW LEVEL SECURITY;
     ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
     ```
   - Users can only read/update their own records:
     ```sql
     CREATE POLICY "Users can only view own profile" ON profiles
       FOR SELECT USING (auth.uid() = id);
     ```

2. **Authentic Data Assurance (Zero Synthetic Mock Accounts)**:
   - All accounts in `auth.users` and `public.profiles` must originate from genuine user sign-ups (Google OAuth or verified email).
   - Mock/placeholder names (e.g. fake test personas) must never be seeded into production databases.
   - Enterprise corporate accounts must be unified under `Collekt Technologies Ltd`.

3. **Sensitive Field Encryption & Storage**:
   - Passwords must never be stored in plain text (managed by Supabase Auth / bcrypt).
   - NIN / BVN / CAC documents in Supabase Storage must reside in private buckets accessible only via authenticated signed URLs.

## Database Audit Checklist

- [ ] Every newly created table has RLS explicitly enabled.
- [ ] Service role key is only used in secure serverless backend functions, never exposed in client JS files.
- [ ] Storage policies verify `bucket_id = 'user_documents' AND auth.uid() = owner`.
- [ ] Foreign keys cascade or restrict safely without leaving orphan financial transactions.
