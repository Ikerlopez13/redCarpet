-- Migration: Add privacy policy acceptance to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT FALSE;

-- Update RLS if needed (already allows update by own user)
-- COMMENT: Profiles table already has "Users can update own profile" policy.
