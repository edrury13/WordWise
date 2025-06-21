-- Complete User Preferences Setup for WordWise
-- This script handles all dependencies and can be run safely

-- First, check if the update_updated_at_column function exists, if not create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing objects if they exist (for clean setup)
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
DROP TRIGGER IF EXISTS create_user_preferences_on_signup ON auth.users;
DROP FUNCTION IF EXISTS check_user_needs_onboarding(UUID);
DROP FUNCTION IF EXISTS create_default_user_preferences();

-- Drop the table if it exists (be careful with this in production!)
-- DROP TABLE IF EXISTS user_preferences CASCADE;

-- Create the user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Background Information
  education_level TEXT,
  field_of_study TEXT,
  primary_language TEXT DEFAULT 'en-US',
  native_language TEXT,
  
  -- Writing Purpose (stored as array)
  writing_purposes TEXT[] DEFAULT '{}',
  
  -- Goals & Challenges
  writing_goals TEXT[] DEFAULT '{}',
  writing_challenges TEXT[] DEFAULT '{}',
  
  -- Style Preferences
  -- Note: This references user_style_profiles table which may or may not exist
  -- If it doesn't exist, comment out this line or create the table first
  default_style_profile_id UUID, -- REFERENCES user_style_profiles(id) ON DELETE SET NULL,
  auto_detect_style BOOLEAN DEFAULT false,
  always_ask_style BOOLEAN DEFAULT false,
  
  -- Writing Preferences
  formality_level INTEGER DEFAULT 5,
  grammar_sensitivity TEXT DEFAULT 'balanced',
  preferred_document_types TEXT[] DEFAULT '{}',
  
  -- Feature Preferences
  enable_ai_suggestions BOOLEAN DEFAULT true,
  enable_learning_mode BOOLEAN DEFAULT true,
  show_tips BOOLEAN DEFAULT true,
  enable_auto_save BOOLEAN DEFAULT true,
  
  -- Notification Preferences
  daily_writing_reminders BOOLEAN DEFAULT false,
  weekly_progress_reports BOOLEAN DEFAULT false,
  grammar_tips BOOLEAN DEFAULT false,
  feature_announcements BOOLEAN DEFAULT true,
  
  -- Accessibility Options
  larger_text_size BOOLEAN DEFAULT false,
  high_contrast_mode BOOLEAN DEFAULT false,
  screen_reader_optimized BOOLEAN DEFAULT false,
  reduced_animations BOOLEAN DEFAULT false,
  keyboard_nav_hints BOOLEAN DEFAULT false,
  
  -- Onboarding Status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  onboarding_skipped BOOLEAN DEFAULT false,
  onboarding_current_step INTEGER DEFAULT 1,
  tutorial_completed BOOLEAN DEFAULT false,
  tutorial_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Writing Sample Analysis
  writing_sample_analyzed BOOLEAN DEFAULT false,
  writing_sample_metrics JSONB,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Add constraints
  CONSTRAINT formality_level_range CHECK (formality_level >= 1 AND formality_level <= 10),
  CONSTRAINT grammar_sensitivity_values CHECK (grammar_sensitivity IN ('strict', 'balanced', 'relaxed'))
);

-- Add the foreign key constraint for style profiles if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_style_profiles') THEN
    ALTER TABLE user_preferences 
    ADD CONSTRAINT fk_default_style_profile 
    FOREIGN KEY (default_style_profile_id) 
    REFERENCES user_style_profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

-- Create RLS Policies
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_preferences_onboarding_idx ON user_preferences(onboarding_completed);

-- Function to check if user needs onboarding
CREATE OR REPLACE FUNCTION check_user_needs_onboarding(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = p_user_id 
    AND (onboarding_completed = true OR onboarding_skipped = true)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create preferences when user is created
CREATE TRIGGER create_user_preferences_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_preferences();

-- Update trigger
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_preferences IS 'Stores user preferences and onboarding data for personalized writing experience';
COMMENT ON COLUMN user_preferences.writing_purposes IS 'Array of purposes: academic, business, email, creative, technical, social, general';
COMMENT ON COLUMN user_preferences.education_level IS 'high_school, undergraduate, graduate, phd, postdoc, professor, professional';
COMMENT ON COLUMN user_preferences.formality_level IS 'Scale 1-10 where 1 is very casual and 10 is very formal';
COMMENT ON COLUMN user_preferences.grammar_sensitivity IS 'Grammar checking sensitivity: strict, balanced, or relaxed';

-- Grant necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON user_preferences TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'User preferences table created successfully!';
END $$; 