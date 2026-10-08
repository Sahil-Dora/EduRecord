/*
# Enable pgvector and create document_chunks table for RAG

## Summary

This migration enables the pgvector extension and creates a `document_chunks` table
to store chunked document text with vector embeddings for Retrieval-Augmented
Generation (RAG). The table is linked to the existing `documents` table via a
foreign key. Row Level Security policies follow the same pattern as other tables:
all authenticated users can read, only staff/admin can insert, only admin can
update and delete.

## New Extension
- `vector` (pgvector v0.8.2) — adds the `vector` data type for storing embeddings.

## New Table: document_chunks
- `id` (uuid, primary key)
- `document_id` (uuid, foreign key to documents.id ON DELETE CASCADE)
- `chunk_index` (integer, not null) — ordinal position of the chunk within the document
- `content` (text, not null) — the chunked text content
- `metadata` (jsonb, nullable) — optional metadata (e.g. character offset, section title)
- `embedding` (vector(384), nullable) — 384-dimensional embedding vector
- `created_at` (timestamptz, default now())

## Indexes
- `document_chunks_document_id_idx` — index on document_id for fast lookup
- `document_chunks_document_id_chunk_index_uniq` — unique composite index on
  (document_id, chunk_index) to prevent duplicate chunks

## Security (RLS)
- RLS enabled on `document_chunks`.
- SELECT: all authenticated users (includes viewers — they can read/retrieve data).
- INSERT: staff and admin only (via `is_staff_or_admin()` helper).
- UPDATE: admin only (via `is_admin()` helper).
- DELETE: admin only (via `is_admin()` helper).

## Important Notes
1. The `vector(384)` dimension matches the output of the local hashing-based
   embedding approach used in the edge function (384 dimensions). This can be
   changed later if a different embedding model is adopted.
2. ON DELETE CASCADE ensures chunks are removed when their parent document is deleted.
3. The unique constraint on (document_id, chunk_index) prevents duplicate chunks
   when rebuilding.
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_document_id_chunk_index_uniq ON document_chunks(document_id, chunk_index);

-- Enable RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policies (drop first for idempotency, then recreate)
DROP POLICY IF EXISTS "document_chunks_select" ON document_chunks;
CREATE POLICY "document_chunks_select"
ON document_chunks FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "document_chunks_insert" ON document_chunks;
CREATE POLICY "document_chunks_insert"
ON document_chunks FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "document_chunks_update" ON document_chunks;
CREATE POLICY "document_chunks_update"
ON document_chunks FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "document_chunks_delete" ON document_chunks;
CREATE POLICY "document_chunks_delete"
ON document_chunks FOR DELETE
TO authenticated
USING (is_admin());
