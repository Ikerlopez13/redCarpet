-- ============================================================
-- TASKS 4/5/6 — AUTHORITY ALERTS + AUDIT LOG
-- Alerts created by city authorities from the dashboard. They are
-- separate from user-reported danger_zones: official, auditable,
-- city-scoped, and they drive routing (closures, penalties and
-- the punto violeta bonus).
-- ============================================================

CREATE TABLE IF NOT EXISTS authority_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES dashboard_users(id),
    type TEXT NOT NULL CHECK (type IN
        ('street_closed', 'danger_zone', 'punto_violeta', 'event', 'poor_lighting', 'works', 'other')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
    description TEXT CHECK (char_length(description) <= 2000),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    -- location: point+radius for zones/puntos, linestring for street segments
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_m INTEGER CHECK (radius_m BETWEEN 10 AND 2000),
    segment GEOMETRY(LineString, 4326),
    -- lifetime
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    -- optional daily window (puntos violeta during Fallas: 22:00-06:00)
    daily_start TIME,
    daily_end TIME,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES dashboard_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT alert_has_location CHECK (
        (lat IS NOT NULL AND lng IS NOT NULL) OR segment IS NOT NULL),
    CONSTRAINT alert_expiry_after_start CHECK (
        expires_at IS NULL OR expires_at > starts_at),
    CONSTRAINT daily_window_complete CHECK (
        (daily_start IS NULL) = (daily_end IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_authority_alerts_city_status
    ON authority_alerts (city_id, status);
CREATE INDEX IF NOT EXISTS idx_authority_alerts_geo
    ON authority_alerts USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authority_alerts_segment
    ON authority_alerts USING GIST (segment) WHERE segment IS NOT NULL;

-- TRUE when the alert is live right now (status, date range and,
-- for scheduled puntos violeta, the daily time window in city tz)
CREATE OR REPLACE FUNCTION alert_is_live(a authority_alerts)
RETURNS BOOLEAN AS $$
    SELECT a.status = 'active'
       AND a.starts_at <= NOW()
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       AND (a.daily_start IS NULL OR (
            CASE
              WHEN a.daily_start <= a.daily_end
                THEN (NOW() AT TIME ZONE (SELECT timezone FROM public.cities WHERE id = a.city_id))::time BETWEEN a.daily_start AND a.daily_end
              -- overnight window, e.g. 22:00-06:00
              ELSE (NOW() AT TIME ZONE (SELECT timezone FROM public.cities WHERE id = a.city_id))::time >= a.daily_start
                OR (NOW() AT TIME ZONE (SELECT timezone FROM public.cities WHERE id = a.city_id))::time <= a.daily_end
            END));
$$ LANGUAGE sql STABLE SET search_path = public;

-- ============================================
-- SERVER-SIDE GEOMETRY VALIDATION (Task 6 hardening):
-- every alert must fall inside its city's boundary. RLS cannot
-- express this, so a BEFORE trigger rejects out-of-boundary writes.
-- ============================================
CREATE OR REPLACE FUNCTION validate_alert_geometry()
RETURNS TRIGGER AS $$
DECLARE
    v_boundary GEOMETRY;
BEGIN
    SELECT boundary INTO v_boundary FROM cities WHERE id = NEW.city_id;
    IF v_boundary IS NULL THEN
        RAISE EXCEPTION 'City % has no boundary loaded', NEW.city_id;
    END IF;
    IF NEW.lat IS NOT NULL AND NOT ST_Contains(v_boundary, ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)) THEN
        RAISE EXCEPTION 'Alert location is outside the city boundary';
    END IF;
    IF NEW.segment IS NOT NULL AND NOT ST_Contains(v_boundary, NEW.segment) THEN
        RAISE EXCEPTION 'Alert segment is outside the city boundary';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_alert_geometry ON authority_alerts;
CREATE TRIGGER trg_validate_alert_geometry
    BEFORE INSERT OR UPDATE ON authority_alerts
    FOR EACH ROW EXECUTE FUNCTION validate_alert_geometry();

-- ============================================
-- RLS — the security boundary of the València sandbox.
-- App users read live alerts (they render in the app and affect
-- routing). Authorities mutate only their own city. Hard delete
-- is city_admin/superadmin only; operators resolve (soft delete).
-- ============================================
ALTER TABLE authority_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App users read authority alerts" ON authority_alerts;
CREATE POLICY "App users read authority alerts" ON authority_alerts
    FOR SELECT TO authenticated
    USING (dash_role() IS NULL OR can_access_city(city_id));

DROP POLICY IF EXISTS "Authorities create alerts in own city" ON authority_alerts;
CREATE POLICY "Authorities create alerts in own city" ON authority_alerts
    FOR INSERT TO authenticated
    WITH CHECK (dash_role() IS NOT NULL AND can_access_city(city_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Authorities update alerts in own city" ON authority_alerts;
CREATE POLICY "Authorities update alerts in own city" ON authority_alerts
    FOR UPDATE TO authenticated
    USING (dash_role() IS NOT NULL AND can_access_city(city_id))
    WITH CHECK (can_access_city(city_id));  -- can't move an alert to another city

DROP POLICY IF EXISTS "Admins hard-delete alerts in own city" ON authority_alerts;
CREATE POLICY "Admins hard-delete alerts in own city" ON authority_alerts
    FOR DELETE TO authenticated
    USING ((dash_role() = 'city_admin' AND can_access_city(city_id)) OR is_superadmin());

-- ============================================
-- AUDIT LOG — append-only, written by trigger so it cannot be
-- bypassed from any client. Authorities' actions are traceable.
-- ============================================
CREATE TABLE IF NOT EXISTS authority_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    city_id UUID,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'resolve', 'delete')),
    alert_id UUID,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_city_time ON authority_audit_log (city_id, created_at DESC);

ALTER TABLE authority_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dashboard reads own city audit log" ON authority_audit_log;
CREATE POLICY "Dashboard reads own city audit log" ON authority_audit_log
    FOR SELECT TO authenticated
    USING (dash_role() IS NOT NULL AND can_access_city(city_id));
-- no INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER trigger writes

CREATE OR REPLACE FUNCTION log_alert_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    ELSIF NEW.status = 'resolved' AND OLD.status = 'active' THEN
        v_action := 'resolve';
    ELSE
        v_action := 'update';
    END IF;

    INSERT INTO authority_audit_log (user_id, city_id, action, alert_id, before, after)
    VALUES (
        auth.uid(),
        COALESCE(NEW.city_id, OLD.city_id),
        v_action,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) - 'segment' END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) - 'segment' END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_authority_alerts ON authority_alerts;
CREATE TRIGGER trg_audit_authority_alerts
    AFTER INSERT OR UPDATE OR DELETE ON authority_alerts
    FOR EACH ROW EXECUTE FUNCTION log_alert_mutation();

-- ============================================
-- ROUTING FEED — live alerts near a bounding box, consumed by the
-- app's route selection (Task 4). STABLE → GET via PostgREST.
-- ============================================
CREATE OR REPLACE FUNCTION get_live_alerts_in_bbox(
    min_lon FLOAT, min_lat FLOAT, max_lon FLOAT, max_lat FLOAT)
RETURNS TABLE (
    id UUID, type TEXT, title TEXT, severity TEXT,
    lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_m INTEGER,
    segment_geojson JSONB, expires_at TIMESTAMPTZ
) AS $$
    SELECT a.id, a.type, a.title, a.severity, a.lat, a.lng, a.radius_m,
           CASE WHEN a.segment IS NOT NULL THEN ST_AsGeoJSON(a.segment)::jsonb END,
           a.expires_at
    FROM public.authority_alerts a
    WHERE alert_is_live(a)
      AND (
        (a.lat IS NOT NULL AND a.lng BETWEEN min_lon AND max_lon AND a.lat BETWEEN min_lat AND max_lat)
        OR (a.segment IS NOT NULL AND a.segment && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
      );
$$ LANGUAGE sql STABLE SET search_path = public;

-- Realtime: the app already syncs via supabase realtime channels;
-- publish this table so authority actions propagate in seconds.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE authority_alerts;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication not present or table already added';
END $$;
