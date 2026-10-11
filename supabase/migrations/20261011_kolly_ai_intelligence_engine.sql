-- ============================================================================
-- KOLLY AI — ADDITIVE DATABASE MIGRATION (v1.0)
-- Multi-Provider AI Assistant, Long-Term pgvector Memory, Governance & Audit
-- Target: Supabase PostgreSQL (Non-destructive, additive DDL only)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. kolly_conversations
CREATE TABLE IF NOT EXISTS public.kolly_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  role_context TEXT DEFAULT 'professional',
  model_preference TEXT DEFAULT 'auto',
  research_mode BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kolly_conversations_user_id
  ON public.kolly_conversations(user_id, updated_at DESC);

-- 2. kolly_messages
CREATE TABLE IF NOT EXISTS public.kolly_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.kolly_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  task_category TEXT NULL,
  provider_used TEXT NULL,
  model_used TEXT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kolly_messages_conversation_id
  ON public.kolly_messages(conversation_id, created_at ASC);

-- 3. kolly_memories (Long-term personal memory with pgvector embeddings & supersession)
CREATE TABLE IF NOT EXISTS public.kolly_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NULL,
  category TEXT NOT NULL DEFAULT 'general',
  memory_key TEXT NULL,
  memory_value TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.00,
  is_user_confirmed BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  superseded_by UUID NULL REFERENCES public.kolly_memories(id) ON DELETE SET NULL,
  embedding vector(1536) NULL,
  retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '365 days'),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kolly_memories_user_active
  ON public.kolly_memories(user_id, is_active)
  WHERE deleted_at IS NULL;

-- 4. kolly_memory_sources
CREATE TABLE IF NOT EXISTS public.kolly_memory_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.kolly_memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NULL REFERENCES public.kolly_conversations(id) ON DELETE SET NULL,
  message_id UUID NULL REFERENCES public.kolly_messages(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'conversation',
  source_excerpt TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. kolly_user_preferences
CREATE TABLE IF NOT EXISTS public.kolly_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_name TEXT NULL,
  communication_style TEXT DEFAULT 'executive_concise',
  memory_enabled BOOLEAN NOT NULL DEFAULT true,
  research_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_provider TEXT DEFAULT 'auto',
  language TEXT DEFAULT 'en-NG',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. kolly_user_consents
CREATE TABLE IF NOT EXISTS public.kolly_user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  consent_version TEXT NOT NULL DEFAULT '2026.1',
  ip_region TEXT DEFAULT 'NG',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kolly_user_consents_user
  ON public.kolly_user_consents(user_id, consent_type);

-- 7. kolly_files (Uploaded RFQ, SOW, BOQ & Tender Document Intelligence)
CREATE TABLE IF NOT EXISTS public.kolly_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NULL REFERENCES public.kolly_conversations(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  storage_path TEXT NULL,
  extracted_summary TEXT NULL,
  compliance_matrix JSONB DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. kolly_research_jobs
CREATE TABLE IF NOT EXISTS public.kolly_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NULL REFERENCES public.kolly_conversations(id) ON DELETE SET NULL,
  objective TEXT NOT NULL,
  search_queries JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  sources JSONB DEFAULT '[]'::jsonb,
  report_markdown TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

-- 9. kolly_tool_executions (Audit trail of AI tool invocations & guardrails)
CREATE TABLE IF NOT EXISTS public.kolly_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID NULL REFERENCES public.kolly_conversations(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB DEFAULT '{}'::jsonb,
  tool_output_summary TEXT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. kolly_usage_records (Multi-provider token & cost accounting)
CREATE TABLE IF NOT EXISTS public.kolly_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID NULL REFERENCES public.kolly_conversations(id) ON DELETE SET NULL,
  task_category TEXT NOT NULL DEFAULT 'simple_conversation',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  fallback_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kolly_usage_user_date
  ON public.kolly_usage_records(user_id, created_at DESC);

-- 11. kolly_feedback
CREATE TABLE IF NOT EXISTS public.kolly_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_id UUID NULL REFERENCES public.kolly_messages(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating IN (-1, 1, 2, 3, 4, 5)),
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semantic vector search function (strictly isolated to p_user_id)
CREATE OR REPLACE FUNCTION public.match_kolly_memories(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.72,
  p_match_count INT DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  memory_key TEXT,
  memory_value TEXT,
  confidence NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    km.id,
    km.category,
    km.memory_key,
    km.memory_value,
    km.confidence,
    1 - (km.embedding <=> p_query_embedding) AS similarity
  FROM public.kolly_memories km
  WHERE km.user_id = p_user_id
    AND km.is_active = true
    AND km.deleted_at IS NULL
    AND km.embedding IS NOT NULL
    AND 1 - (km.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY km.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- Enable Row Level Security (RLS) on all Kolly tables
ALTER TABLE public.kolly_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_memory_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolly_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_conversations' AND policyname = 'Users manage own kolly_conversations') THEN
    CREATE POLICY "Users manage own kolly_conversations" ON public.kolly_conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_messages' AND policyname = 'Users manage own kolly_messages') THEN
    CREATE POLICY "Users manage own kolly_messages" ON public.kolly_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_memories' AND policyname = 'Users manage own kolly_memories') THEN
    CREATE POLICY "Users manage own kolly_memories" ON public.kolly_memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_memory_sources' AND policyname = 'Users manage own kolly_memory_sources') THEN
    CREATE POLICY "Users manage own kolly_memory_sources" ON public.kolly_memory_sources FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_user_preferences' AND policyname = 'Users manage own kolly_user_preferences') THEN
    CREATE POLICY "Users manage own kolly_user_preferences" ON public.kolly_user_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_user_consents' AND policyname = 'Users manage own kolly_user_consents') THEN
    CREATE POLICY "Users manage own kolly_user_consents" ON public.kolly_user_consents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_files' AND policyname = 'Users manage own kolly_files') THEN
    CREATE POLICY "Users manage own kolly_files" ON public.kolly_files FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_research_jobs' AND policyname = 'Users manage own kolly_research_jobs') THEN
    CREATE POLICY "Users manage own kolly_research_jobs" ON public.kolly_research_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_tool_executions' AND policyname = 'Users view own kolly_tool_executions') THEN
    CREATE POLICY "Users view own kolly_tool_executions" ON public.kolly_tool_executions FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_usage_records' AND policyname = 'Users view own kolly_usage_records') THEN
    CREATE POLICY "Users view own kolly_usage_records" ON public.kolly_usage_records FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kolly_feedback' AND policyname = 'Users manage own kolly_feedback') THEN
    CREATE POLICY "Users manage own kolly_feedback" ON public.kolly_feedback FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
