-- Migration: Fix infinite recursion in RLS policies for family_groups and family_members

-- 1. Helper function to check membership without triggering policies
CREATE OR REPLACE FUNCTION public.is_family_member(check_group_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_members
    WHERE group_id = check_group_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_family_admin(check_group_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_groups
    WHERE id = check_group_id AND admin_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can create family groups" ON public.family_groups;
DROP POLICY IF EXISTS "Users can view family groups they are part of" ON public.family_groups;
DROP POLICY IF EXISTS "Admins can update their family groups" ON public.family_groups;
DROP POLICY IF EXISTS "Admins can delete their family groups" ON public.family_groups;

DROP POLICY IF EXISTS "View group members" ON public.family_members;
DROP POLICY IF EXISTS "Users can join or admins can add members" ON public.family_members;
DROP POLICY IF EXISTS "Users can update own permissions or admins can update anyone" ON public.family_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON public.family_members;

-- 3. Recreate family_groups policies using helper functions
CREATE POLICY "Users can create family groups" 
ON public.family_groups FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Users can view family groups they are part of" 
ON public.family_groups FOR SELECT TO authenticated 
USING (
    admin_id = auth.uid() OR
    public.is_family_member(id)
);

CREATE POLICY "Admins can update their family groups" 
ON public.family_groups FOR UPDATE TO authenticated 
USING (admin_id = auth.uid());

CREATE POLICY "Admins can delete their family groups" 
ON public.family_groups FOR DELETE TO authenticated 
USING (admin_id = auth.uid());

-- 4. Recreate family_members policies using helper functions
CREATE POLICY "View group members" 
ON public.family_members FOR SELECT TO authenticated 
USING (
    public.is_family_member(group_id)
);

CREATE POLICY "Users can join or admins can add members" 
ON public.family_members FOR INSERT TO authenticated 
WITH CHECK (
    user_id = auth.uid() OR 
    public.is_family_admin(group_id)
);

CREATE POLICY "Users can update own permissions or admins can update anyone" 
ON public.family_members FOR UPDATE TO authenticated 
USING (
    user_id = auth.uid() OR
    public.is_family_admin(group_id)
);

CREATE POLICY "Users can leave or admins can remove members" 
ON public.family_members FOR DELETE TO authenticated 
USING (
    user_id = auth.uid() OR
    public.is_family_admin(group_id)
);
