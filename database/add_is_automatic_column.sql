-- Migration to add is_automatic column to document_versions table
-- Run this if you're getting "Could not find the 'is_automatic' column" error

-- Add the is_automatic column if it doesn't exist
DO $$ 
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'document_versions' 
    AND column_name = 'is_automatic'
  ) THEN
    -- Add the column
    ALTER TABLE public.document_versions 
    ADD COLUMN is_automatic BOOLEAN DEFAULT false;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_versions_automatic 
    ON public.document_versions(document_id, is_automatic, created_at DESC);
    
    -- Update existing versions to mark them as manual (not automatic)
    UPDATE public.document_versions 
    SET is_automatic = false 
    WHERE is_automatic IS NULL;
    
    RAISE NOTICE 'Successfully added is_automatic column to document_versions table';
  ELSE
    RAISE NOTICE 'is_automatic column already exists';
  END IF;
END $$;

-- Also ensure the cleanup function exists
CREATE OR REPLACE FUNCTION cleanup_old_automatic_versions(doc_id UUID)
RETURNS void AS $$
DECLARE
  automatic_count INTEGER;
  oldest_auto_version_id UUID;
BEGIN
  -- Count automatic versions for this document
  SELECT COUNT(*) INTO automatic_count
  FROM document_versions
  WHERE document_id = doc_id AND is_automatic = true;
  
  -- If more than 3, delete the oldest ones
  WHILE automatic_count > 3 LOOP
    -- Find the oldest automatic version
    SELECT id INTO oldest_auto_version_id
    FROM document_versions
    WHERE document_id = doc_id AND is_automatic = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Delete it
    DELETE FROM document_versions WHERE id = oldest_auto_version_id;
    
    automatic_count := automatic_count - 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add the delete policy if it doesn't exist
DO $$
BEGIN
  -- Check if the policy exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'document_versions' 
    AND policyname = 'Users can delete automatic versions of their documents'
  ) THEN
    CREATE POLICY "Users can delete automatic versions of their documents" ON document_versions
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM documents 
          WHERE documents.id = document_versions.document_id 
          AND documents.user_id = auth.uid()
        ) AND is_automatic = true
      );
      
    RAISE NOTICE 'Successfully added delete policy for automatic versions';
  ELSE
    RAISE NOTICE 'Delete policy for automatic versions already exists';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'document_versions' 
AND column_name = 'is_automatic'; 