CREATE OR REPLACE FUNCTION match_user_by_short_id(p_short_id TEXT)
RETURNS TABLE(id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT profiles.id, profiles.full_name
  FROM profiles
  WHERE profiles.id::text ILIKE p_short_id || '%'
  LIMIT 1;
END;
$$;
