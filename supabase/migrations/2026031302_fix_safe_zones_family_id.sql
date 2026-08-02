-- Migration to fix missing family_id in safe_zones
-- Run this in the Supabase SQL Editor

-- 1. Add family_id if it's missing and make user_id optional
ALTER TABLE public.safe_zones 
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update RLS policies to use family_id
DROP POLICY IF EXISTS "Users can manage their own safe zones" ON safe_zones;
DROP POLICY IF EXISTS "Users can view safe zones for their family" ON public.safe_zones;
DROP POLICY IF EXISTS "Admins can manage safe zones" ON public.safe_zones;

CREATE POLICY "Family members can manage safe zones"
    ON public.safe_zones
    FOR ALL
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        family_id IN (
            SELECT group_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

-- 3. (Optional) If you have data in user_id, you can try to port it to its first family group
-- UPDATE public.safe_zones sz
-- SET family_id = (SELECT group_id FROM public.family_members fm WHERE fm.profile_id = sz.user_id LIMIT 1)
-- WHERE family_id IS NULL AND user_id IS NOT NULL;
