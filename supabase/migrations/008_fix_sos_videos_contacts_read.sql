-- Fix: la política comparaba (storage.foldername(tc.name)) — el NOMBRE del contacto —
-- en vez de objects.name (la ruta del archivo). Los trusted contacts nunca podían
-- leer los vídeos/audios SOS del bucket privado sos-videos.
-- Aplicada a producción el 2026-08-05.

DROP POLICY IF EXISTS "Owner and contacts read sos-videos" ON storage.objects;

CREATE POLICY "Owner and contacts read sos-videos" ON storage.objects
FOR SELECT USING (
    bucket_id = 'sos-videos' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM trusted_contacts tc
            WHERE tc.status = 'accepted' AND (
                (tc.user_id = auth.uid() AND tc.associated_user_id::text = (storage.foldername(objects.name))[1])
                OR
                (tc.associated_user_id = auth.uid() AND tc.user_id::text = (storage.foldername(objects.name))[1])
            )
        )
        OR EXISTS (
            SELECT 1 FROM family_members fm1
            JOIN family_members fm2 ON fm1.group_id = fm2.group_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id::text = (storage.foldername(objects.name))[1]
        )
    )
);
