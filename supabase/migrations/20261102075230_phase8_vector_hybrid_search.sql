/*
# Phase 8: Vector + Hybrid Search

## Purpose
Implement secure vector similarity search and hybrid search (vector + keyword)
across documents, reusing the existing pgvector extension, document_chunks table,
and local-hash embedding approach — no paid APIs, no schema changes.

## New Database Objects

### 1. `fnv1a_32(text)` — FNV-1a hash helper
Deterministic 32-bit hash, matching the JS edge function implementation.

### 2. `generate_query_embedding(text)` — SQL function
Generates a 384-dimensional vector from query text using the same local hashing
approach as the `generate-embeddings` edge function (FNV-1a word/char-n-gram hashing
+ L2 normalization). Lets us embed the search query in SQL without an external API.

### 3. `hybrid_search(p_query, p_match_count, p_mode)` — SECURITY DEFINER function
Performs hybrid search combining:
  - Vector similarity: embeds the query, joins document_chunks by cosine distance
  - Keyword search: ILIKE on document titles and extracted text

Returns ranked document results. Modes: 'vector', 'keyword', 'hybrid'.

### 4. ivfflat index on document_chunks.embedding for cosine distance.

## Security
- All functions are SECURITY DEFINER with search_path set to public.
- hybrid_search enforces caller must be an authenticated, active profile.
- EXECUTE granted to authenticated only (not anon) — requires sign-in.
- No existing tables, policies, or migrations are modified.
*/

-- ── 1. FNV-1a 32-bit hash (matches JS edge function) ──

CREATE OR REPLACE FUNCTION public.fnv1a_32(p_str text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash bigint := 2166136261;
  v_char text;
  v_byte integer;
  v_i integer;
BEGIN
  FOR v_i IN 1..length(p_str) LOOP
    v_char := substr(p_str, v_i, 1);
    v_byte := ascii(v_char);
    -- XOR with byte
    v_hash := v_hash # v_byte;
    -- Multiply by 16777619, mask to 32-bit unsigned
    v_hash := ((v_hash * 16777619) % 4294967296)::bigint;
  END LOOP;
  RETURN v_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fnv1a_32(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fnv1a_32(text) TO authenticated;

-- ── 2. Query embedding function (SQL port of JS local-hash embedding) ──

CREATE OR REPLACE FUNCTION public.generate_query_embedding(p_text text)
RETURNS vector
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vec double precision[] := ARRAY(SELECT 0.0 FROM generate_series(1, 384));
  v_lower text;
  v_tokens text[];
  v_token text;
  v_bigram text;
  v_trigram text;
  v_hash bigint;
  v_idx integer;
  v_norm double precision := 0;
  v_result double precision[] := ARRAY(SELECT 0.0 FROM generate_series(1, 384));
  v_i integer;
BEGIN
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RETURN v_vec::vector;
  END IF;

  v_lower := lower(trim(p_text));

  -- Word-level features
  v_tokens := regexp_split_to_array(v_lower, '[^a-z0-9]+');
  FOREACH v_token IN ARRAY v_tokens LOOP
    IF v_token = '' THEN CONTINUE; END IF;
    v_hash := public.fnv1a_32(v_token);
    v_idx := (v_hash % 384)::integer + 1;
    v_vec[v_idx] := v_vec[v_idx] + 1.0;
  END LOOP;

  -- Character bigram features
  FOR v_i IN 1..length(v_lower) - 1 LOOP
    v_bigram := substr(v_lower, v_i, 2);
    IF v_bigram ~ '[a-z0-9 ]' THEN
      v_hash := public.fnv1a_32(v_bigram);
      v_idx := (v_hash % 384)::integer + 1;
      v_vec[v_idx] := v_vec[v_idx] + 0.3;
    END IF;
  END LOOP;

  -- Character trigram features
  FOR v_i IN 1..length(v_lower) - 2 LOOP
    v_trigram := substr(v_lower, v_i, 3);
    IF v_trigram ~ '^[a-z0-9 ]+$' THEN
      v_hash := public.fnv1a_32(v_trigram);
      v_idx := (v_hash % 384)::integer + 1;
      v_vec[v_idx] := v_vec[v_idx] + 0.15;
    END IF;
  END LOOP;

  -- L2 normalize
  FOR v_i IN 1..384 LOOP
    v_norm := v_norm + v_vec[v_i] * v_vec[v_i];
  END LOOP;
  v_norm := sqrt(v_norm);

  IF v_norm > 0 THEN
    FOR v_i IN 1..384 LOOP
      v_result[v_i] := round((v_vec[v_i] / v_norm) * 10000.0) / 10000.0;
    END LOOP;
  END IF;

  RETURN v_result::vector;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_query_embedding(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_query_embedding(text) TO authenticated;

-- ── 3. ivfflat cosine distance index on document_chunks.embedding ──

CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx
ON public.document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 4);

-- ── 4. Hybrid search function ──

CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_query text,
  p_match_count integer DEFAULT 10,
  p_mode text DEFAULT 'hybrid'
)
RETURNS TABLE (
  document_id uuid,
  title text,
  file_name text,
  status text,
  student_id uuid,
  student_name text,
  student_number text,
  similarity_score double precision,
  keyword_score double precision,
  combined_rank double precision,
  matched_chunk text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_query_vec vector;
  v_mode text := lower(COALESCE(p_mode, 'hybrid'));
  v_count integer := COALESCE(p_match_count, 10);
  v_query text;
BEGIN
  -- Validate mode
  IF v_mode NOT IN ('vector', 'keyword', 'hybrid') THEN
    v_mode := 'hybrid';
  END IF;

  -- Clamp match count
  IF v_count < 1 THEN
    v_count := 10;
  ELSIF v_count > 50 THEN
    v_count := 50;
  END IF;

  -- Only authenticated, active users can search
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  ) THEN
    RETURN;
  END IF;

  -- Trim query
  v_query := trim(COALESCE(p_query, ''));
  IF v_query = '' THEN
    RETURN;
  END IF;

  -- Generate query embedding for vector/hybrid modes
  IF v_mode IN ('vector', 'hybrid') THEN
    v_query_vec := public.generate_query_embedding(v_query);
  END IF;

  RETURN QUERY
  WITH
  vector_results AS (
    SELECT
      dc.document_id,
      dc.content AS chunk_content,
      1.0 - (dc.embedding <=> v_query_vec) AS sim_score
    FROM public.document_chunks dc
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> v_query_vec
    LIMIT v_count * 3
  ),
  keyword_results AS (
    SELECT DISTINCT ON (d.id)
      d.id AS document_id,
      CASE
        WHEN d.title ILIKE '%' || v_query || '%' THEN 1.0::double precision
        ELSE 0.5::double precision
      END AS kw_score
    FROM public.documents d
    LEFT JOIN public.document_analyses da ON da.document_id = d.id
    WHERE d.title ILIKE '%' || v_query || '%'
       OR da.extracted_text ILIKE '%' || v_query || '%'
    LIMIT v_count * 3
  )
  SELECT
    d.id::uuid,
    d.title::text,
    d.file_name::text,
    d.status::text,
    d.student_id::uuid,
    COALESCE(s.first_name || ' ' || s.last_name, 'Unknown')::text AS student_name,
    COALESCE(s.student_number, '')::text AS student_number,
    COALESCE(vr.sim_score, 0.0)::double precision AS similarity_score,
    COALESCE(kr.kw_score, 0.0)::double precision AS keyword_score,
    CASE
      WHEN v_mode = 'vector' THEN COALESCE(vr.sim_score, 0.0)
      WHEN v_mode = 'keyword' THEN COALESCE(kr.kw_score, 0.0)
      ELSE (0.7 * COALESCE(vr.sim_score, 0.0)) + (0.3 * COALESCE(kr.kw_score, 0.0))
    END::double precision AS combined_rank,
    vr.chunk_content::text AS matched_chunk
  FROM public.documents d
  LEFT JOIN public.students s ON s.id = d.student_id
  LEFT JOIN vector_results vr ON vr.document_id = d.id
  LEFT JOIN keyword_results kr ON kr.document_id = d.id
  WHERE
    (v_mode = 'vector' AND vr.document_id IS NOT NULL)
    OR (v_mode = 'keyword' AND kr.document_id IS NOT NULL)
    OR (v_mode = 'hybrid' AND (vr.document_id IS NOT NULL OR kr.document_id IS NOT NULL))
  ORDER BY combined_rank DESC
  LIMIT v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hybrid_search(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hybrid_search(text, integer, text) TO authenticated;
