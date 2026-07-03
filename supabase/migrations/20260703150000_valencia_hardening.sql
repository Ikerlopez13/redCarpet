-- ============================================================
-- TASK 6 — HARDENING + DASHBOARD SUPPORT RPCs
-- ============================================================

-- City bbox for the dashboard map lock + geocoder restriction
CREATE OR REPLACE FUNCTION get_city_bounds(p_city_id UUID)
RETURNS FLOAT[] AS $$
    SELECT ARRAY[ST_XMin(ext), ST_YMin(ext), ST_XMax(ext), ST_YMax(ext)]
    FROM (SELECT boundary::box2d::geometry AS ext FROM public.cities WHERE id = p_city_id) t;
$$ LANGUAGE sql STABLE SET search_path = public;

-- ============================================
-- STATS PANEL RPCs (all city-scoped via can_access_city)
-- ============================================
CREATE OR REPLACE FUNCTION stats_incidents_per_barrio_week(p_city_slug TEXT)
RETURNS TABLE (barrio TEXT, week TIMESTAMPTZ, incidents BIGINT) AS $$
    SELECT n.name_es, date_trunc('week', dz.created_at), COUNT(*)
    FROM public.danger_zones dz
    JOIN public.cities c ON c.slug = p_city_slug AND dz.city_id = c.id
    JOIN public.neighborhoods n
      ON n.city_id = c.id
     AND ST_Contains(n.boundary, ST_SetSRID(ST_MakePoint(dz.lng, dz.lat), 4326))
    WHERE can_access_city(c.id)
      AND dz.created_at > NOW() - INTERVAL '12 weeks'
    GROUP BY 1, 2
    ORDER BY 2 DESC, 3 DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION stats_top_reported_zones(p_city_slug TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (barrio TEXT, incidents BIGINT) AS $$
    SELECT n.name_es, COUNT(*)
    FROM public.danger_zones dz
    JOIN public.cities c ON c.slug = p_city_slug AND dz.city_id = c.id
    JOIN public.neighborhoods n
      ON n.city_id = c.id
     AND ST_Contains(n.boundary, ST_SetSRID(ST_MakePoint(dz.lng, dz.lat), 4326))
    WHERE can_access_city(c.id)
      AND dz.created_at > NOW() - INTERVAL '30 days'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION stats_alert_resolution_hours(p_city_slug TEXT)
RETURNS FLOAT AS $$
    SELECT EXTRACT(EPOCH FROM AVG(a.resolved_at - a.created_at)) / 3600.0
    FROM public.authority_alerts a
    JOIN public.cities c ON c.slug = p_city_slug AND a.city_id = c.id
    WHERE can_access_city(c.id)
      AND a.status = 'resolved' AND a.resolved_at IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- RATE LIMITING — server-side, on the critical mutation path.
-- A dashboard user may perform at most 30 alert mutations per
-- minute; blocks scripted abuse of a hijacked authority account.
-- (Transport-level rate limiting is additionally configured in
-- Supabase → Settings → API.)
-- ============================================
CREATE OR REPLACE FUNCTION enforce_alert_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INT;
BEGIN
    SELECT COUNT(*) INTO recent_count
    FROM authority_audit_log
    WHERE user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '1 minute';
    IF recent_count >= 30 THEN
        RAISE EXCEPTION 'Rate limit exceeded: max 30 alert mutations per minute'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_alert_rate_limit ON authority_alerts;
CREATE TRIGGER trg_alert_rate_limit
    BEFORE INSERT OR UPDATE OR DELETE ON authority_alerts
    FOR EACH ROW EXECUTE FUNCTION enforce_alert_rate_limit();
