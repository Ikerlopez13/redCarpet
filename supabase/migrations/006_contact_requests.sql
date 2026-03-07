-- Migración para añadir Solicitudes de Amistad (Sincronización de Contactos In-App)

-- 1. Añadir nuevas columnas a la tabla existente 'trusted_contacts'
ALTER TABLE public.trusted_contacts
ADD COLUMN IF NOT EXISTS associated_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected'));

-- 2. Modificar las políticas RLS para permitir ver solicitudes recibidas
-- Los usuarios pueden ver los contactos donde ellos son el "associated_user_id" (han recibido una solicitud)
DROP POLICY IF EXISTS "Users can view pending requests directed to them" ON public.trusted_contacts;
CREATE POLICY "Users can view pending requests directed to them"
    ON public.trusted_contacts FOR SELECT
    USING (auth.uid() = associated_user_id AND status = 'pending');

-- Los usuarios pueden aceptar o rechazar solicitudes dirigidas a ellos
DROP POLICY IF EXISTS "Users can update requests directed to them" ON public.trusted_contacts;
CREATE POLICY "Users can update requests directed to them"
    ON public.trusted_contacts FOR UPDATE
    USING (auth.uid() = associated_user_id)
    WITH CHECK (auth.uid() = associated_user_id AND status IN ('accepted', 'rejected'));

-- 3. Crear una vista útil para la interfaz: "Mis Solicitudes Pendientes"
CREATE OR REPLACE VIEW public.pending_contact_requests AS
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

-- Opcional: Índice para búsquedas rápidas de solicitudes recibidas
CREATE INDEX IF NOT EXISTS trusted_contacts_associated_user_idx ON public.trusted_contacts(associated_user_id);
