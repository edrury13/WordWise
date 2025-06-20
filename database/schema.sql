-- WordWise Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  word_count INTEGER DEFAULT 0,
  character_count INTEGER DEFAULT 0
);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE row level security;

-- Create policy for users to only access their own documents
CREATE POLICY "Users can only access their own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents(updated_at DESC);

-- Create user_correction_patterns table for Smart Auto-Correction
CREATE TABLE IF NOT EXISTS user_correction_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL,
    context_before TEXT,
    context_after TEXT,
    document_type VARCHAR(50),
    accepted BOOLEAN NOT NULL,
    confidence_gained INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_correction_patterns
CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON user_correction_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_created ON user_correction_patterns(created_at);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_correction_patterns(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_user_patterns_accepted ON user_correction_patterns(accepted);

-- Enable Row Level Security on user_correction_patterns
ALTER TABLE user_correction_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for user_correction_patterns
CREATE POLICY "Users can view own correction patterns" ON user_correction_patterns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own correction patterns" ON user_correction_patterns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own correction patterns" ON user_correction_patterns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own correction patterns" ON user_correction_patterns
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment for user_correction_patterns table
COMMENT ON TABLE user_correction_patterns IS 'Stores user writing correction patterns for smart auto-correction learning';

-- Optional: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for document statistics (if needed)
CREATE OR REPLACE VIEW user_document_stats AS
SELECT 
  user_id,
  COUNT(*) as total_documents,
  SUM(word_count) as total_words,
  SUM(character_count) as total_characters,
  AVG(word_count) as avg_words_per_document,
  MAX(updated_at) as last_updated
FROM documents 
GROUP BY user_id; 