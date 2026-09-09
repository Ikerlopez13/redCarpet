-- Durable device authentication for native background-location uploads.
-- The token table is deliberately inaccessible through PostgREST; only the
-- SECURITY DEFINER RPC and service-role Edge Function may access it.
CREATE TABLE IF NOT EXISTS public.location_ingest_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.location_ingest_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_or_create_location_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT token INTO v_token
  FROM public.location_ingest_tokens
  WHERE user_id = v_uid;

  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.location_ingest_tokens(token, user_id)
    VALUES (v_token, v_uid)
    ON CONFLICT (user_id) DO UPDATE
      SET token = public.location_ingest_tokens.token
    RETURNING token INTO v_token;
  END IF;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_location_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_location_token() TO authenticated, service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
