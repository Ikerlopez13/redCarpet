-- Create safe_zones table
CREATE TABLE IF NOT EXISTS public.safe_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION DEFAULT 100, -- meters
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for safe_zones
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view safe zones for their family"
    ON public.safe_zones
    FOR SELECT
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage safe zones"
    ON public.safe_zones
    FOR ALL
    USING (
        family_id IN (
            SELECT group_id FROM public.family_members 
            WHERE profile_id = auth.uid() AND role = 'admin'
        )
    );

-- Create bucket for SOS recordings if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('sos-recordings', 'sos-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access to SOS Recordings"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'sos-recordings' );

CREATE POLICY "Users can upload SOS recordings"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'sos-recordings' AND auth.role() = 'authenticated' );
