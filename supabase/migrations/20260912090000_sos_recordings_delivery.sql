-- Durable, private SOS media storage with access for accepted trusted contacts.

CREATE TABLE IF NOT EXISTS public.sos_recordings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_alert_id uuid NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    chunk_index integer NOT NULL DEFAULT 0,
    media_type text NOT NULL,
    thumbnail_url text,
    preserved boolean NOT NULL DEFAULT false,
    expires_at timestamptz DEFAULT (now() + interval '30 days'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sos_alert_id, storage_path)
);

-- Keep the migration safe for installations where an earlier manual version
-- of the table already exists with only part of the schema.
ALTER TABLE public.sos_recordings
    ADD COLUMN IF NOT EXISTS sos_alert_id uuid REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS storage_path text,
    ADD COLUMN IF NOT EXISTS chunk_index integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS media_type text,
    ADD COLUMN IF NOT EXISTS thumbnail_url text,
    ADD COLUMN IF NOT EXISTS preserved boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days'),
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sos_recordings_alert_chunk
    ON public.sos_recordings (sos_alert_id, chunk_index, created_at);

ALTER TABLE public.sos_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SOS owners upload recordings" ON public.sos_recordings;
CREATE POLICY "SOS owners upload recordings"
    ON public.sos_recordings FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "SOS owners and trusted contacts view recordings" ON public.sos_recordings;
CREATE POLICY "SOS owners and trusted contacts view recordings"
    ON public.sos_recordings FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.status = 'accepted'
              AND (
                (tc.user_id = sos_recordings.user_id AND tc.associated_user_id = auth.uid())
                OR
                (tc.associated_user_id = sos_recordings.user_id AND tc.user_id = auth.uid())
              )
        )
        OR EXISTS (
            SELECT 1
            FROM public.sos_alerts sa
            JOIN public.family_members fm ON fm.group_id = sa.group_id
            WHERE sa.id = sos_recordings.sos_alert_id
              AND fm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "SOS owners preserve recordings" ON public.sos_recordings;
CREATE POLICY "SOS owners preserve recordings"
    ON public.sos_recordings FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trusted contacts can see the SOS alert itself even when they do not share a
-- family group with its owner.
DROP POLICY IF EXISTS "Trusted contacts view SOS alerts" ON public.sos_alerts;
CREATE POLICY "Trusted contacts view SOS alerts"
    ON public.sos_alerts FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.status = 'accepted'
              AND (
                (tc.user_id = sos_alerts.user_id AND tc.associated_user_id = auth.uid())
                OR
                (tc.associated_user_id = sos_alerts.user_id AND tc.user_id = auth.uid())
              )
        )
    );

INSERT INTO storage.buckets (id, name, public)
VALUES ('sos-videos', 'sos-videos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sos-thumbnails', 'sos-thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "SOS owners upload video chunks" ON storage.objects;
CREATE POLICY "SOS owners upload video chunks"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'sos-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "SOS owners update video chunks" ON storage.objects;
CREATE POLICY "SOS owners update video chunks"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'sos-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'sos-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "SOS owners and trusted contacts read video chunks" ON storage.objects;
CREATE POLICY "SOS owners and trusted contacts read video chunks"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'sos-videos'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM public.trusted_contacts tc
                WHERE tc.status = 'accepted'
                  AND (
                    (tc.user_id::text = (storage.foldername(name))[1] AND tc.associated_user_id = auth.uid())
                    OR
                    (tc.associated_user_id::text = (storage.foldername(name))[1] AND tc.user_id = auth.uid())
                  )
            )
        )
    );

DROP POLICY IF EXISTS "SOS owners upload thumbnails" ON storage.objects;
CREATE POLICY "SOS owners upload thumbnails"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'sos-thumbnails'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "SOS owners update thumbnails" ON storage.objects;
CREATE POLICY "SOS owners update thumbnails"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'sos-thumbnails'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'sos-thumbnails'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

GRANT SELECT, INSERT, UPDATE ON public.sos_recordings TO authenticated;
