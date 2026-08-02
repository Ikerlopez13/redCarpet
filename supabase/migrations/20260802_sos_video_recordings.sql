-- Bucket público solo para thumbnails (miniaturas sin contenido sensible)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sos-thumbnails', 'sos-thumbnails', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read sos-thumbnails"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'sos-thumbnails');

CREATE POLICY "Owners upload to sos-thumbnails"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'sos-thumbnails'
        AND (storage.foldername(name))[1] = auth.uid()::text);

-- Bucket privado para el vídeo/audio real del SOS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sos-videos', 'sos-videos', false, 524288000,
        ARRAY['video/mp4','video/webm','video/quicktime',
              'audio/aac','audio/m4a','audio/mpeg','audio/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Solo el propietario puede subir
CREATE POLICY "Owner uploads to sos-videos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'sos-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text);

-- El propietario y sus contactos de confianza (bidireccional) pueden leer
CREATE POLICY "Owner and contacts read sos-videos"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'sos-videos' AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM public.trusted_contacts tc
                WHERE tc.status = 'accepted'
                  AND (
                      (tc.user_id = auth.uid()
                           AND tc.associated_user_id::text = (storage.foldername(name))[1])
                   OR (tc.associated_user_id = auth.uid()
                           AND tc.user_id::text = (storage.foldername(name))[1])
                  )
            )
            OR EXISTS (
                SELECT 1 FROM public.family_members fm1
                JOIN public.family_members fm2 ON fm1.group_id = fm2.group_id
                WHERE fm1.user_id = auth.uid()
                  AND fm2.user_id::text = (storage.foldername(name))[1]
            )
        )
    );

-- El propietario puede eliminar sus propios ficheros
CREATE POLICY "Owner deletes own sos-videos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'sos-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text);

-- Tabla de metadatos de grabaciones: un registro por chunk subido
CREATE TABLE IF NOT EXISTS sos_recordings (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_alert_id    uuid        REFERENCES sos_alerts(id) ON DELETE CASCADE NOT NULL,
    user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    storage_path    text        NOT NULL,           -- path relativo dentro de sos-videos
    chunk_index     int         NOT NULL DEFAULT 0,
    media_type      text        NOT NULL DEFAULT 'video/mp4',
    duration_s      int,
    size_bytes      bigint,
    thumbnail_url   text,                           -- URL pública del bucket sos-thumbnails
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
    preserved       boolean     NOT NULL DEFAULT false
);

ALTER TABLE sos_recordings ENABLE ROW LEVEL SECURITY;

-- El propietario gestiona sus propias grabaciones
CREATE POLICY "Owner manages own recordings"
    ON sos_recordings FOR ALL
    USING (user_id = auth.uid());

-- Los contactos de confianza (bidireccional) pueden ver
CREATE POLICY "Contacts can view recordings"
    ON sos_recordings FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.status = 'accepted'
              AND (
                  (tc.user_id = auth.uid() AND tc.associated_user_id = sos_recordings.user_id)
               OR (tc.associated_user_id = auth.uid() AND tc.user_id = sos_recordings.user_id)
              )
        )
        OR EXISTS (
            SELECT 1 FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.group_id = fm2.group_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = sos_recordings.user_id
        )
    );

CREATE INDEX IF NOT EXISTS idx_sos_recordings_alert
    ON sos_recordings(sos_alert_id);
CREATE INDEX IF NOT EXISTS idx_sos_recordings_user
    ON sos_recordings(user_id);
-- Índice para la tarea de limpieza de expirados
CREATE INDEX IF NOT EXISTS idx_sos_recordings_expires
    ON sos_recordings(expires_at) WHERE NOT preserved;
