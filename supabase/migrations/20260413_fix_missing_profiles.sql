-- 1. Reparación Retroactiva (Sync up)
-- Migra e inserta todos los usuarios que existen en `auth.users` pero NO se llegaron a crear en `public.profiles`.
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
    id, 
    -- SOPORTE OAUTH: Intenta extraer "full_name", si no existe busca "name" (Google/Apple), si no un fallback
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Usuario Nuevo'), 
    raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Asegurar y Robustezer el Trigger para el futuro
-- Modificamos la función para no bloquear la creación de nuevos usuarios ante fallos imprevistos y adaptarse a Oauth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Usuario Nuevo'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING; -- Evitar duplicados que causan error crasheante
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Si algo falla, el usuario se crea igual en Auth para evitar un 500 error en el móvil
        RAISE LOG 'Error on profile creation: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recrear el evento
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
