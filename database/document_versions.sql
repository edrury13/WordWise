-- Document Version Control Schema for WordWise
-- Run this after the main schema.sql

-- Document versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  commit_message TEXT, -- Optional message describing the changes
  word_count INTEGER DEFAULT 0,
  character_count INTEGER DEFAULT 0,
  is_major_version BOOLEAN DEFAULT false, -- Major vs minor versions
  diff_summary JSONB, -- Store change statistics
  is_automatic BOOLEAN DEFAULT false -- Track automatic vs manual versions
);

-- Version comparisons cache
CREATE TABLE IF NOT EXISTS version_comparisons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_from UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  version_to UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  diff_data JSONB, -- Cached diff data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(version_from, version_to)
);

-- Named versions/tags (like "Final Draft", "Submitted Version")
CREATE TABLE IF NOT EXISTS document_version_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  UNIQUE(document_id, tag_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_versions_created_at ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_version_number ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_version_tags_document ON document_version_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_version_comparisons_lookup ON version_comparisons(version_from, version_to);
CREATE INDEX IF NOT EXISTS idx_versions_automatic ON document_versions(document_id, is_automatic, created_at DESC);

-- Enable Row Level Security
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_version_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_versions
CREATE POLICY "Users can view versions of their documents" ON document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_versions.document_id 
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions of their documents" ON document_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_versions.document_id 
      AND documents.user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete automatic versions of their documents" ON document_versions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_versions.document_id 
      AND documents.user_id = auth.uid()
    ) AND is_automatic = true
  );

-- RLS Policies for version_comparisons
CREATE POLICY "Users can view comparisons of their document versions" ON version_comparisons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE dv.id IN (version_comparisons.version_from, version_comparisons.version_to)
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comparisons of their document versions" ON version_comparisons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE dv.id IN (version_comparisons.version_from, version_comparisons.version_to)
      AND d.user_id = auth.uid()
    )
  );

-- RLS Policies for document_version_tags
CREATE POLICY "Users can view tags of their documents" ON document_version_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_version_tags.document_id 
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tags for their documents" ON document_version_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_version_tags.document_id 
      AND documents.user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete tags of their documents" ON document_version_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_version_tags.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Function to get the next version number
CREATE OR REPLACE FUNCTION get_next_version_number(doc_id UUID, is_major BOOLEAN)
RETURNS INTEGER AS $$
DECLARE
  current_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO current_version
  FROM document_versions
  WHERE document_id = doc_id;
  
  IF is_major THEN
    -- For major versions, increment by 1
    RETURN current_version + 1;
  ELSE
    -- For minor versions, we'll handle this in the application
    -- to support decimal versioning if needed
    RETURN current_version + 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create initial version when document is created
CREATE OR REPLACE FUNCTION create_initial_document_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_versions (
    document_id,
    version_number,
    content,
    title,
    created_by,
    word_count,
    character_count,
    is_major_version,
    commit_message,
    is_automatic
  ) VALUES (
    NEW.id,
    1,
    NEW.content,
    NEW.title,
    NEW.user_id,
    NEW.word_count,
    NEW.character_count,
    true,
    'Initial version',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old automatic versions (keeps only 3 most recent)
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

-- Create trigger for initial version
CREATE TRIGGER create_initial_version_trigger
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_document_version();

-- Add comments
COMMENT ON TABLE document_versions IS 'Stores version history for documents';
COMMENT ON TABLE version_comparisons IS 'Caches comparison data between versions for performance';
COMMENT ON TABLE document_version_tags IS 'Named tags for specific versions like "Final Draft"';

-- Migration for existing tables (if they already exist)
DO $$ 
BEGIN
  -- Add is_automatic column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'document_versions' 
                AND column_name = 'is_automatic') THEN
    ALTER TABLE document_versions ADD COLUMN is_automatic BOOLEAN DEFAULT false;
  END IF;
END $$; 