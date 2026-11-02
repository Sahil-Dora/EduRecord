/*
# Phase 8 Fix: Raise Vector Similarity Threshold

## Purpose
The previous 0.05 threshold was too low — long nonsense queries like
"zzzzqqqxxxnonexistent" produce character n-gram hash collisions that yield
similarity scores of ~0.14, creating false positives. Testing shows:
  - Real matches ("test"=0.36, "extract"=0.20) score well above 0.15
  - Nonsense queries ("zzzzqqqxxxnonexistent"=0.14, "completelyrandomword"=0.14)
    score at or below 0.14
  - Weak-but-legitimate queries ("enrollment"=0.055) score low, but keyword
    search compensates in hybrid mode

Raising the threshold to 0.15 eliminates false-positive vector results while
keeping genuinely relevant matches. In hybrid mode, keyword search still
catches documents that have weak vector similarity but strong keyword matches.

## Changes
- Updates `hybrid_search`: vector_results CTE threshold changed from 0.05 to 0.15

## Security
- No security model changes.
*/

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
  IF v_mode NOT IN ('vector', 'keyword', 'hybrid') THEN
    v_mode := 'hybrid';
  END IF;

  IF v_count < 1 THEN
    v_count := 10;
  ELSIF v_count > 50 THEN
    v_count := 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  ) THEN
    RETURN;
  END IF;

  v_query := trim(COALESCE(p_query, ''));
  IF v_query = '' THEN
    RETURN;
  END IF;

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
      AND (1.0 - (dc.embedding <=> v_query_vec)) >= 0.15
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
