-- Migración para la tabla de Contactos de Confianza

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relation TEXT DEFAULT 'Familiar',
    share_location BOOLEAN DEFAULT true,
    notify_emergency BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (Solo cada usuario puede ver y editar sus contactos)
CREATE POLICY "Users can view their own trusted contacts"
    ON public.trusted_contacts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trusted contacts"
    ON public.trusted_contacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trusted contacts"
    ON public.trusted_contacts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trusted contacts"
    ON public.trusted_contacts FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Opcional: Crear un índice para optimizar búsquedas frecuentes por user_id
CREATE INDEX IF NOT EXISTS trusted_contacts_user_id_idx ON public.trusted_contacts(user_id);
