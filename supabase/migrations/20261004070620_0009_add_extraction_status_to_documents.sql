/*
# Add Extraction Status to Documents

## Overview
Adds two columns to the `documents` table to track text extraction progress
and errors. This supports the Step 5 Text Extraction feature, where an edge
function extracts text from uploaded files and stores it in `document_analyses`.

## Changes to Existing Tables

### documents (modified)
- `extraction_status` (text, not null, default 'not_started')
  — CHECK constraint: not_started / pending / complete / error
  Tracks whether text extraction has been run and whether it succeeded.
- `extraction_error` (text, nullable)
  — Stores the error message if extraction failed, cleared on retry.

## Security
- No RLS policy changes. The new columns are covered by existing policies:
  SELECT (all authenticated), INSERT/UPDATE (staff+admin), DELETE (admin).
  The edge function uses the service role key and bypasses RLS, but validates
  the caller's role by querying the profiles table before processing.

## Important Notes
1. Both columns are additive — no existing data is modified or lost.
2. `extraction_status` defaults to 'not_started' so all existing documents
   automatically have a sensible initial state.
3. The edge function sets status to 'pending' before extraction, then either
   'complete' or 'error' depending on the outcome.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'extraction_status'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN extraction_status text NOT NULL DEFAULT 'not_started'
      CHECK (extraction_status IN ('not_started', 'pending', 'complete', 'error'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'extraction_error'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN extraction_error text;
  END IF;
END $$;