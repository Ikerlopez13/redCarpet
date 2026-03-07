-- Migración para permitir la búsqueda segura de usuarios por teléfono o email
-- sin exponer toda la tabla de perfiles/usuarios al público (Bypass RLS de forma segura)

CREATE OR REPLACE FUNCTION public.match_user_for_contact(p_phone text, p_email text)
RETURNS UUID AS $$
DECLARE
    matched_id UUID;
BEGIN
    -- Intentar buscar primero por coincidencia exacta en auth.users (email)
    -- o en profiles (teléfono)
    
    SELECT u.id INTO matched_id
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE 
        (p_email IS NOT NULL AND p_email != '' AND u.email = p_email)
        OR 
        (p_phone IS NOT NULL AND p_phone != '' AND p.phone = p_phone)
    LIMIT 1;

    RETURN matched_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Asegurar que los usuarios autenticados pueden ejecutar la función
GRANT EXECUTE ON FUNCTION public.match_user_for_contact(text, text) TO authenticated;
