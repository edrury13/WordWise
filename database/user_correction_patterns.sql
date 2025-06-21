-- Create table for storing user correction patterns
-- This table tracks accepted and rejected suggestions to learn user preferences
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_user_patterns_user_id (user_id),
    INDEX idx_user_patterns_created (created_at),
    INDEX idx_user_patterns_type (suggestion_type),
    INDEX idx_user_patterns_accepted (accepted)
);

-- Row Level Security
ALTER TABLE user_correction_patterns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own correction patterns
CREATE POLICY "Users can view own correction patterns" ON user_correction_patterns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own correction patterns" ON user_correction_patterns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own correction patterns" ON user_correction_patterns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own correction patterns" ON user_correction_patterns
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_correction_patterns IS 'Stores user writing correction patterns for smart auto-correction learning'; 