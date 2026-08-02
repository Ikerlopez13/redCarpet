-- Unified migration for Family Plan features (Safe Zones & Stats)

-- 1. SAFE ZONES (Shared locations like Home, School)
CREATE TABLE IF NOT EXISTS public.safe_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION DEFAULT 100, -- meters
    type TEXT DEFAULT 'general', -- home, school, work, gym, other
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Safe Zones
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view their group safe zones"
    ON public.safe_zones
    FOR SELECT
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Family admins can manage safe zones"
    ON public.safe_zones
    FOR ALL
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'parent')
        )
    );


-- 2. FAMILY STATS (Emotional statistics/history)
-- We track stats per family group, per week, to show "Weekly Peace of Mind"
CREATE TABLE IF NOT EXISTS public.family_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE NOT NULL,
    week_start_date DATE NOT NULL, -- First day of the week (Monday) representing this stats record
    safe_arrivals_count INTEGER DEFAULT 0,
    risk_alerts_count INTEGER DEFAULT 0,
    routes_completed_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, week_start_date)
);

-- RLS for Family Stats
ALTER TABLE public.family_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view their stats"
    ON public.family_stats
    FOR SELECT
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System/Functions can update stats"
    ON public.family_stats
    FOR ALL
    USING ( true )
    WITH CHECK ( true ); -- In production, restrict to service role

-- 3. LOGIC (Triggers to update updated_at)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_safe_zones_modtime
    BEFORE UPDATE ON public.safe_zones
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_family_stats_modtime
    BEFORE UPDATE ON public.family_stats
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
