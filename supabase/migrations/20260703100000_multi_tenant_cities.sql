-- ============================================================
-- TASK 1 — MULTI-TENANT CITY SCOPING (FOUNDATION)
-- Cities, dashboard users with roles, city_id on all safety
-- data, point-in-polygon backfill and server-side RLS scoping.
-- Backward compatible: existing rows outside any known city
-- keep city_id = NULL (global) and app behaviour is unchanged.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- CITIES
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    country TEXT NOT NULL DEFAULT 'ES',
    boundary GEOMETRY(MultiPolygon, 4326),
    timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_boundary ON cities USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities (slug);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Cities are public reference data for any authenticated user (app needs
-- them to know which city a coordinate belongs to).
DROP POLICY IF EXISTS "Authenticated can read cities" ON cities;
CREATE POLICY "Authenticated can read cities" ON cities
    FOR SELECT TO authenticated USING (TRUE);

-- ============================================
-- DASHBOARD USERS (authorities)
-- role model: city_admin / city_operator scoped to ONE city,
-- superadmin (Red Carpet staff) sees everything.
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('city_admin', 'city_operator', 'superadmin')),
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- city roles MUST be bound to a city; only superadmin is global
    CONSTRAINT dashboard_users_city_required
        CHECK (role = 'superadmin' OR city_id IS NOT NULL)
);

ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (used by every city-scoped RLS policy)
-- SECURITY DEFINER so they can read dashboard_users regardless
-- of RLS; STABLE so the planner caches them per statement.
-- ============================================
CREATE OR REPLACE FUNCTION dash_role()
RETURNS TEXT AS $$
    SELECT role FROM public.dashboard_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION dash_city_id()
RETURNS UUID AS $$
    SELECT city_id FROM public.dashboard_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT role = 'superadmin' FROM public.dashboard_users WHERE id = auth.uid()),
        FALSE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- TRUE when the current user may act on data of the given city:
-- superadmin always; city users only on their own city.
CREATE OR REPLACE FUNCTION can_access_city(target_city UUID)
RETURNS BOOLEAN AS $$
    SELECT is_superadmin() OR (dash_city_id() IS NOT NULL AND dash_city_id() = target_city);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- dashboard_users policies (need the helpers, so created after them)
DROP POLICY IF EXISTS "Users read own dashboard profile" ON dashboard_users;
CREATE POLICY "Users read own dashboard profile" ON dashboard_users
    FOR SELECT TO authenticated USING (id = auth.uid() OR is_superadmin());

DROP POLICY IF EXISTS "Superadmin manages dashboard users" ON dashboard_users;
CREATE POLICY "Superadmin manages dashboard users" ON dashboard_users
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ============================================
-- POINT → CITY RESOLUTION
-- ============================================
CREATE OR REPLACE FUNCTION resolve_city_id(lon FLOAT, lat FLOAT)
RETURNS UUID AS $$
    SELECT id FROM public.cities
    WHERE active
      AND boundary IS NOT NULL
      AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
    LIMIT 1;
$$ LANGUAGE sql STABLE SET search_path = public;

-- ============================================
-- CITY_ID ON EXISTING SAFETY DATA
-- ============================================
ALTER TABLE danger_zones ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE sos_alerts   ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_danger_zones_city ON danger_zones (city_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_city ON sos_alerts (city_id);

-- Auto-assign city on insert/update when coordinates are present and
-- city_id was not provided. Rows outside all known cities stay NULL (global).
CREATE OR REPLACE FUNCTION assign_city_from_coords()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.city_id IS NULL AND NEW.lng IS NOT NULL AND NEW.lat IS NOT NULL THEN
        NEW.city_id := resolve_city_id(NEW.lng, NEW.lat);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_danger_zones_city ON danger_zones;
CREATE TRIGGER trg_danger_zones_city
    BEFORE INSERT OR UPDATE OF lat, lng ON danger_zones
    FOR EACH ROW EXECUTE FUNCTION assign_city_from_coords();

DROP TRIGGER IF EXISTS trg_sos_alerts_city ON sos_alerts;
CREATE TRIGGER trg_sos_alerts_city
    BEFORE INSERT OR UPDATE OF lat, lng ON sos_alerts
    FOR EACH ROW EXECUTE FUNCTION assign_city_from_coords();

-- ============================================
-- BACKFILL existing rows (point-in-polygon; NULL if outside all cities)
-- Runs again safely after new cities are seeded.
-- ============================================
CREATE OR REPLACE FUNCTION backfill_city_ids()
RETURNS TABLE (table_name TEXT, rows_assigned BIGINT) AS $$
DECLARE
    n BIGINT;
BEGIN
    UPDATE danger_zones dz SET city_id = resolve_city_id(dz.lng, dz.lat)
    WHERE dz.city_id IS NULL AND dz.lng IS NOT NULL AND dz.lat IS NOT NULL
      AND resolve_city_id(dz.lng, dz.lat) IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    table_name := 'danger_zones'; rows_assigned := n; RETURN NEXT;

    UPDATE sos_alerts sa SET city_id = resolve_city_id(sa.lng, sa.lat)
    WHERE sa.city_id IS NULL AND sa.lng IS NOT NULL AND sa.lat IS NOT NULL
      AND resolve_city_id(sa.lng, sa.lat) IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    table_name := 'sos_alerts'; rows_assigned := n; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- SERVER-SIDE CITY SCOPING ON MUTATIONS
-- App users keep their existing behaviour (report anywhere).
-- Dashboard (authority) users may only mutate rows of their city —
-- enforced here in RLS, never in the client.
-- ============================================
-- Grant UPDATE to authority users only, scoped to their city (production
-- has no UPDATE policy on danger_zones — app behaviour is unchanged).
DROP POLICY IF EXISTS "Dashboard users update own city zones" ON danger_zones;
CREATE POLICY "Dashboard users update own city zones" ON danger_zones
    FOR UPDATE TO authenticated
    USING (dash_role() IS NOT NULL AND can_access_city(city_id))
    WITH CHECK (can_access_city(city_id));

-- RESTRICTIVE: ANDs with the existing permissive delete policy, so an
-- authority user can never delete zones outside their city. App users
-- (no dashboard role) pass through unchanged.
DROP POLICY IF EXISTS "Dashboard users delete own city zones" ON danger_zones;
CREATE POLICY "Dashboard users delete own city zones" ON danger_zones
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (dash_role() IS NULL OR can_access_city(city_id));
