-- Migration: Add missing RLS policies for family_groups and family_members

-- family_groups policies --

-- Allow users to create family groups if they are the admin
CREATE POLICY "Users can create family groups" 
ON public.family_groups 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = admin_id);

-- Allow users to view family groups they are part of or they created
CREATE POLICY "Users can view family groups they are part of" 
ON public.family_groups 
FOR SELECT 
TO authenticated 
USING (
    admin_id = auth.uid() OR
    id IN (SELECT group_id FROM public.family_members WHERE user_id = auth.uid())
);

-- Allow admins to update their family groups
CREATE POLICY "Admins can update their family groups" 
ON public.family_groups 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = admin_id);

-- Allow admins to delete their family groups
CREATE POLICY "Admins can delete their family groups" 
ON public.family_groups 
FOR DELETE 
TO authenticated 
USING (auth.uid() = admin_id);

-- family_members policies --

-- Allow users to join a group, or admins to add members
CREATE POLICY "Users can join or admins can add members" 
ON public.family_members 
FOR INSERT 
TO authenticated 
WITH CHECK (
    user_id = auth.uid() OR 
    group_id IN (SELECT id FROM public.family_groups WHERE admin_id = auth.uid())
);

-- Allow users to update their own permissions, or admins to update anyone
CREATE POLICY "Users can update own permissions or admins can update anyone" 
ON public.family_members 
FOR UPDATE 
TO authenticated 
USING (
    user_id = auth.uid() OR
    group_id IN (SELECT id FROM public.family_groups WHERE admin_id = auth.uid())
);

-- Allow users to leave, or admins to remove members
CREATE POLICY "Users can leave or admins can remove members" 
ON public.family_members 
FOR DELETE 
TO authenticated 
USING (
    user_id = auth.uid() OR
    group_id IN (SELECT id FROM public.family_groups WHERE admin_id = auth.uid())
);
