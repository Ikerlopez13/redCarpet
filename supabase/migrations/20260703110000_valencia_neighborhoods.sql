-- ============================================================
-- TASK 2 — NEIGHBORHOODS (barris/barrios) + POINT-IN-POLYGON
-- Official administrative structure per city. València data is
-- loaded by scripts/seed-valencia.mjs from the Ajuntament
-- geoportal (OPENDATA/UrbanismoEInfraestructuras layers 224/225).
-- ============================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    district_code TEXT NOT NULL,
    district_name TEXT NOT NULL,
    code TEXT NOT NULL,              -- official barrio code (coddistbar)
    name_es TEXT NOT NULL,
    name_va TEXT,                    -- Valencian name when the source provides it
    boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326),
    population INTEGER,              -- filled when INE/padró data is ingested
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (city_id, code)
);

-- GIST index = O(log n) point-in-polygon for routing/scoring/dashboard
CREATE INDEX IF NOT EXISTS idx_neighborhoods_boundary ON neighborhoods USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city ON neighborhoods (city_id);

ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;

-- Reference geometry is readable by any authenticated user (the app
-- needs it to resolve barrios); mutations are superadmin-only —
-- boundaries are official data, authorities don't edit them.
DROP POLICY IF EXISTS "Authenticated can read neighborhoods" ON neighborhoods;
CREATE POLICY "Authenticated can read neighborhoods" ON neighborhoods
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Superadmin manages neighborhoods" ON neighborhoods;
CREATE POLICY "Superadmin manages neighborhoods" ON neighborhoods
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ============================================
-- POINT-IN-POLYGON SERVICE
-- Used by the routing engine (edge precompute), the scoring
-- engine and the dashboard. GIST index makes && the fast filter,
-- ST_Contains the exact check.
-- ============================================
CREATE OR REPLACE FUNCTION resolve_neighborhood(lon FLOAT, lat FLOAT)
RETURNS TABLE (
    neighborhood_id UUID,
    city_id UUID,
    code TEXT,
    name_es TEXT,
    district_code TEXT,
    district_name TEXT
) AS $$
    SELECT n.id, n.city_id, n.code, n.name_es, n.district_code, n.district_name
    FROM public.neighborhoods n
    WHERE ST_Contains(n.boundary, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
    LIMIT 1;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Batch variant for the routing edge precompute (one round trip for
-- thousands of edge midpoints instead of one call per edge).
CREATE OR REPLACE FUNCTION resolve_neighborhoods_batch(points JSONB)
-- points: [{"id": <any>, "lon": <float>, "lat": <float>}, ...]
RETURNS TABLE (point_id TEXT, neighborhood_id UUID, code TEXT) AS $$
    SELECT p->>'id',
           n.id,
           n.code
    FROM jsonb_array_elements(points) AS p
    LEFT JOIN public.neighborhoods n
      ON ST_Contains(n.boundary,
                     ST_SetSRID(ST_MakePoint((p->>'lon')::float, (p->>'lat')::float), 4326));
$$ LANGUAGE sql STABLE SET search_path = public;

-- ============================================
-- COVERAGE VERIFICATION
-- Reports gap/overlap area between the city boundary and the union
-- of its barrios. Run after every import; the seed script logs it.
-- ============================================
CREATE OR REPLACE FUNCTION verify_neighborhood_coverage(p_city_slug TEXT)
RETURNS TABLE (
    city_area_km2 FLOAT,
    covered_area_km2 FLOAT,
    gap_area_km2 FLOAT,
    overlap_pairs INTEGER
) AS $$
DECLARE
    v_city cities%ROWTYPE;
    v_union GEOMETRY;
BEGIN
    SELECT * INTO v_city FROM cities WHERE slug = p_city_slug;
    IF v_city.id IS NULL THEN
        RAISE EXCEPTION 'Unknown city slug: %', p_city_slug;
    END IF;

    SELECT ST_Union(boundary) INTO v_union
    FROM neighborhoods WHERE city_id = v_city.id;

    SELECT COUNT(*)::int INTO overlap_pairs
    FROM neighborhoods a
    JOIN neighborhoods b
      ON a.city_id = v_city.id AND b.city_id = v_city.id
     AND a.id < b.id
     AND ST_Overlaps(a.boundary, b.boundary)
     -- ignore hairline sliver overlaps from digitising (< 100 m²)
     AND ST_Area(ST_Intersection(a.boundary, b.boundary)::geography) > 100;

    city_area_km2    := ST_Area(v_city.boundary::geography) / 1e6;
    covered_area_km2 := COALESCE(ST_Area(v_union::geography) / 1e6, 0);
    gap_area_km2     := GREATEST(
        ST_Area(ST_Difference(v_city.boundary, COALESCE(v_union, ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)))::geography) / 1e6,
        0);
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
