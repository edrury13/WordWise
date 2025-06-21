-- User Ignored Words Table for WordWise
-- This table stores words that users have chosen to ignore during spell checking

CREATE TABLE IF NOT EXISTS user_ignored_words (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    word_lower TEXT NOT NULL, -- Lowercase version for case-insensitive matching
    context TEXT, -- Optional context where the word was ignored
    document_type VARCHAR(50), -- Optional document type (e.g., 'academic', 'casual', 'business')
    is_proper_noun BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure unique word per user (case-insensitive)
    UNIQUE(user_id, word_lower)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ignored_words_user_id ON user_ignored_words(user_id);
CREATE INDEX IF NOT EXISTS idx_ignored_words_word_lower ON user_ignored_words(word_lower);
CREATE INDEX IF NOT EXISTS idx_ignored_words_created_at ON user_ignored_words(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_ignored_words ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own ignored words" ON user_ignored_words
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ignored words" ON user_ignored_words
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ignored words" ON user_ignored_words
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ignored words" ON user_ignored_words
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment for the table
COMMENT ON TABLE user_ignored_words IS 'Stores user-specific words to ignore during spell checking';
COMMENT ON COLUMN user_ignored_words.word_lower IS 'Lowercase version of the word for case-insensitive matching';
COMMENT ON COLUMN user_ignored_words.is_proper_noun IS 'Whether this word is a proper noun (name, place, etc.)'; 