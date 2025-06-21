-- Style profiles table
CREATE TABLE IF NOT EXISTS user_style_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  profile_type TEXT NOT NULL, -- 'academic', 'business', 'creative', 'technical', 'email', 'social', 'custom'
  settings JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE user_style_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own style profiles" ON user_style_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own style profiles" ON user_style_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own style profiles" ON user_style_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own style profiles" ON user_style_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Document profile associations
CREATE TABLE IF NOT EXISTS document_profile_associations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES user_style_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(document_id, user_id)
);

-- Enable RLS
ALTER TABLE document_profile_associations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own document associations" ON document_profile_associations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document associations" ON document_profile_associations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document associations" ON document_profile_associations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document associations" ON document_profile_associations
  FOR DELETE USING (auth.uid() = user_id);

-- Profile usage analytics
CREATE TABLE IF NOT EXISTS profile_usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES user_style_profiles(id) ON DELETE CASCADE,
  document_count INTEGER DEFAULT 0,
  suggestion_acceptance_rate DECIMAL(5,2),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, profile_id)
);

-- Enable RLS
ALTER TABLE profile_usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own analytics" ON profile_usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analytics" ON profile_usage_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics" ON profile_usage_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updating updated_at
CREATE TRIGGER update_user_style_profiles_updated_at BEFORE UPDATE
  ON user_style_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 