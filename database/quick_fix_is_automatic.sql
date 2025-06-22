-- Quick fix for "is_automatic" column error
-- Run this in Supabase SQL Editor to fix the version creation error

-- Step 1: Add the missing column
ALTER TABLE public.document_versions 
ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN DEFAULT false;

-- Step 2: Verify it was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'document_versions' 
  AND column_name = 'is_automatic';

-- You should see:
-- column_name | data_type | column_default
-- is_automatic | boolean   | false 