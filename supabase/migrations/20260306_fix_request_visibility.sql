-- Migration: Fix friend/family request visibility issues
-- Fixes 3 critical RLS bugs that prevent requests from being received

-- ============================================================
-- FIX 1: PROFILES — Allow authenticated users to view other profiles
-- Without this, JOINs on profiles (for pending requests, family members) fail
-- ============================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Allow all authenticated users to view profiles (name, avatar are public data)
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Keep update restricted to own profile (already exists, just ensure it's there)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- ============================================================
-- FIX 2: TRUSTED_CONTACTS — Ensure receiver can see pending requests
-- The view pending_contact_requests joins on trusted_contacts,
-- but the receiver is the associated_user_id, not user_id
-- ============================================================

-- Re-create the policies to ensure they exist
-- (migration 006 may not have been applied correctly)
DROP POLICY IF EXISTS "Users can view pending requests directed to them" ON public.trusted_contacts;
CREATE POLICY "Users can view pending requests directed to them"
    ON public.trusted_contacts FOR SELECT
    TO authenticated
    USING (auth.uid() = associated_user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can update requests directed to them" ON public.trusted_contacts;
CREATE POLICY "Users can update requests directed to them"
    ON public.trusted_contacts FOR UPDATE
    TO authenticated
    USING (auth.uid() = associated_user_id)
    WITH CHECK (auth.uid() = associated_user_id AND status IN ('accepted', 'rejected'));

-- ============================================================
-- FIX 3: FAMILY GROUPS — Allow lookup by invite_code via RPC
-- A new user cannot SELECT from family_groups because they are
-- not yet a member/admin, so the invite_code lookup fails
-- ============================================================

CREATE OR REPLACE FUNCTION public.lookup_family_by_invite_code(p_invite_code text)
RETURNS UUID AS $$
DECLARE
    found_group_id UUID;
BEGIN
    SELECT id INTO found_group_id
    FROM public.family_groups
    WHERE invite_code = p_invite_code
    LIMIT 1;

    RETURN found_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_family_by_invite_code(text) TO authenticated;

-- ============================================================
-- RECREATE VIEW with SECURITY INVOKER (default) so it uses
-- the updated policies above. Just recreate to be safe.
-- ============================================================

DROP VIEW IF EXISTS public.pending_contact_requests;
CREATE VIEW public.pending_contact_requests AS
SELECT 
    tc.id as request_id,
    tc.user_id as requester_id,
    tc.associated_user_id,
    p.full_name as requester_name,
    p.avatar_url as requester_avatar,
    tc.name as requested_as_name,
    tc.phone as requested_phone,
    tc.created_at
FROM public.trusted_contacts tc
JOIN public.profiles p ON tc.user_id = p.id
WHERE tc.status = 'pending';
