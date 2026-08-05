-- Uso de APIs Mapbox por usuario/mes para limitar abuso individual.
-- Aplicada a produccion el 2026-08-05. Ver mapboxBudget.ts (USER_MONTHLY_CALLS).
CREATE TABLE IF NOT EXISTS public.mapbox_user_usage (
  period text NOT NULL,
  user_id uuid NOT NULL,
  product text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  eur numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period, user_id, product)
);
ALTER TABLE public.mapbox_user_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own usage" ON public.mapbox_user_usage;
CREATE POLICY "Users read own usage" ON public.mapbox_user_usage
  FOR SELECT USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.mapbox_user_increment(p_product text, p_calls int, p_eur numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_calls integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  INSERT INTO mapbox_user_usage (period, user_id, product, calls, eur)
  VALUES (to_char(now(),'YYYY-MM'), auth.uid(), p_product, p_calls, p_eur)
  ON CONFLICT (period, user_id, product)
  DO UPDATE SET calls = mapbox_user_usage.calls + EXCLUDED.calls,
                eur = mapbox_user_usage.eur + EXCLUDED.eur,
                updated_at = now()
  RETURNING calls INTO v_calls;
  RETURN v_calls;
END; $$;
GRANT EXECUTE ON FUNCTION public.mapbox_user_increment(text,int,numeric) TO authenticated;
