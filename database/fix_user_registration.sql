-- Fix User Registration Issue
-- Run this in your Supabase SQL editor to fix the registration error

-- Step 1: Drop the problematic trigger that's causing registration to fail
DROP TRIGGER IF EXISTS create_user_preferences_on_signup ON auth.users;

-- Step 2: Drop the trigger function as well
DROP FUNCTION IF EXISTS create_default_user_preferences();

-- Step 3: Create a safer function that won't interfere with auth
-- This function can be called manually after user creation
CREATE OR REPLACE FUNCTION ensure_user_preferences(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_user_preferences(UUID) TO authenticated;

-- Step 5: Create preferences for any existing users who don't have them
INSERT INTO user_preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'User registration issue fixed! Total users with preferences: %', (SELECT COUNT(*) FROM user_preferences);
END $$; 