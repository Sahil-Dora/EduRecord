/*
# Phase 8 Fix: Vector Similarity Threshold

## Purpose
Fix false-positive vector search results. The hash-based local embedding produces
low absolute cosine similarity scores. Without a threshold, the vector search
returns the nearest chunks for any query — even complete nonsense — because there
is always a "nearest" neighbor. This adds a minimum similarity threshold to filter
out irrelevant vector matches.

## Changes
- Updates `hybrid_search` function to add `WHERE (1.0 - (dc.embedding <=> v_query_vec)) >= 0.05`
  in the vector_results CTE, filtering out chunks below 5% cosine similarity.
- The threshold of 0.05 was chosen by testing the similarity score distribution:
  real matches ("test", "extract") score 0.20-0.36; genuine-but-weak matches
  ("enrollment") score ~0.055; nonsense queries ("zzzzqqqxxx", "1234567890")
  score 0.02-0.03. The 0.05 threshold eliminates clear false positives while
  keeping borderline-but-legitimate matches.
- Keyword search is unaffected — it only returns exact ILIKE matches.
- In hybrid mode, a document must have either a vector score >= 0.05 OR a
  keyword hit to appear in results.

## Security
- No security model changes. Function remains SECURITY DEFINER, authenticated-only.
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
      AND (1.0 - (dc.embedding <=> v_query_vec)) >= 0.05
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
