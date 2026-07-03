-- ============================================================
-- TASK 3 — SAFETY SCORING PER BARRIO
-- Layer 1: municipal baseline (Ministerio del Interior, quarterly).
-- Layer 2: distribution across barrios from granular signals
-- (Policía Local open data, Red Carpet reports with 90-day
-- exponential decay, structural proxies).
-- Score: 0 = safest, 100 = most dangerous.
-- ============================================================

-- ============================================
-- LAYER 1 — MUNICIPAL CRIME BASELINE (auditable imports)
-- ============================================
CREATE TABLE IF NOT EXISTS crime_stats_municipal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    period TEXT NOT NULL,                 -- e.g. '2026-T1' (Balance trimestral)
    source TEXT NOT NULL,                 -- 'Ministerio del Interior — Balance de Criminalidad'
    source_url TEXT,
    population INTEGER NOT NULL,
    total_infracciones INTEGER NOT NULL,
    categories JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"robos_con_violencia": n, "hurtos": n, ...}
    rate_per_1000 FLOAT GENERATED ALWAYS AS (total_infracciones::float / GREATEST(population, 1) * 1000) STORED,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by TEXT,
    UNIQUE (city_id, period, source)
);

ALTER TABLE crime_stats_municipal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dashboard reads own city crime stats" ON crime_stats_municipal;
CREATE POLICY "Dashboard reads own city crime stats" ON crime_stats_municipal
    FOR SELECT TO authenticated USING (can_access_city(city_id));
DROP POLICY IF EXISTS "Superadmin manages crime stats" ON crime_stats_municipal;
CREATE POLICY "Superadmin manages crime stats" ON crime_stats_municipal
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ============================================
-- LAYER 2 — GRANULAR SIGNALS PER BARRIO
-- Generic container so new sources plug in without schema changes.
-- signal examples: 'policia_local_incidents', 'osm_lighting_ratio',
-- 'population_density', 'nightlife_density'
-- ============================================
CREATE TABLE IF NOT EXISTS neighborhood_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
    signal TEXT NOT NULL,
    value FLOAT NOT NULL,
    source TEXT NOT NULL,
    period TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- expression uniqueness must be an index, not a table constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_neighborhood_signals
    ON neighborhood_signals (neighborhood_id, signal, COALESCE(period, ''));

ALTER TABLE neighborhood_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read signals" ON neighborhood_signals;
CREATE POLICY "Authenticated read signals" ON neighborhood_signals
    FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Superadmin manages signals" ON neighborhood_signals;
CREATE POLICY "Superadmin manages signals" ON neighborhood_signals
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ============================================
-- SCORING CONFIG (mirrors config/valencia-scoring.config.json;
-- editable at runtime so tuning needs no redeploy)
-- ============================================
CREATE TABLE IF NOT EXISTS scoring_configs (
    city_id UUID PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scoring_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dashboard reads own city config" ON scoring_configs;
CREATE POLICY "Dashboard reads own city config" ON scoring_configs
    FOR SELECT TO authenticated USING (can_access_city(city_id));
DROP POLICY IF EXISTS "Superadmin manages configs" ON scoring_configs;
CREATE POLICY "Superadmin manages configs" ON scoring_configs
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ============================================
-- SCORES (append-only history → the dashboard draws trends;
-- v_neighborhood_scores_latest is the "current" view)
-- ============================================
CREATE TABLE IF NOT EXISTS neighborhood_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    score FLOAT NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    components JSONB NOT NULL DEFAULT '{}'::jsonb,  -- per-signal breakdown for the dashboard
    data_sources TEXT[] NOT NULL DEFAULT '{}',
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_neighborhood_time
    ON neighborhood_scores (neighborhood_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_city ON neighborhood_scores (city_id);

ALTER TABLE neighborhood_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read scores" ON neighborhood_scores;
CREATE POLICY "Authenticated read scores" ON neighborhood_scores
    FOR SELECT TO authenticated USING (TRUE);  -- the app routing needs them
DROP POLICY IF EXISTS "Superadmin manages scores" ON neighborhood_scores;
CREATE POLICY "Superadmin manages scores" ON neighborhood_scores
    FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE OR REPLACE VIEW v_neighborhood_scores_latest AS
SELECT DISTINCT ON (neighborhood_id)
    neighborhood_id, city_id, score, confidence, components, data_sources, computed_at
FROM neighborhood_scores
ORDER BY neighborhood_id, computed_at DESC;

-- ============================================
-- RECOMPUTE — the scoring formula
--
-- baseline  = min(100, municipal rate_per_1000)          [Layer 1]
-- incidents = Red Carpet reports per barrio, exponential
--             decay exp(-ln(2) * age_days / half_life),
--             normalised against the city max              [Layer 2.2]
-- signals   = weighted granular signals when present       [Layer 2.1/2.3]
--
-- score = baseline shifted by weighted deviation of local signals;
-- confidence grows with how many independent signals exist.
-- Low-confidence barrios collapse toward the municipal baseline.
-- ============================================
CREATE OR REPLACE FUNCTION recompute_neighborhood_scores(p_city_slug TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_city_id UUID;
    v_cfg JSONB;
    v_baseline FLOAT;
    v_half_life FLOAT;
    v_w_incidents FLOAT;
    v_w_signals FLOAT;
    v_max_incident_load FLOAT;
    v_source_period TEXT;
    v_count INTEGER := 0;
    r RECORD;
    v_incident_load FLOAT;
    v_signal_dev FLOAT;
    v_signal_count INTEGER;
    v_score FLOAT;
    v_conf FLOAT;
    v_sources TEXT[];
BEGIN
    SELECT id INTO v_city_id FROM cities WHERE slug = p_city_slug;
    IF v_city_id IS NULL THEN RAISE EXCEPTION 'Unknown city: %', p_city_slug; END IF;

    SELECT config INTO v_cfg FROM scoring_configs WHERE city_id = v_city_id;
    v_cfg := COALESCE(v_cfg, '{}'::jsonb);
    v_half_life  := COALESCE((v_cfg->>'incident_half_life_days')::float, 90);
    v_w_incidents := COALESCE((v_cfg->'weights'->>'redcarpet_incidents')::float, 0.5);
    v_w_signals   := COALESCE((v_cfg->'weights'->>'granular_signals')::float, 0.5);

    -- Layer 1: latest municipal baseline (0-100 clamp of rate per 1000)
    SELECT LEAST(rate_per_1000, 100), period INTO v_baseline, v_source_period
    FROM crime_stats_municipal
    WHERE city_id = v_city_id
    ORDER BY imported_at DESC LIMIT 1;
    v_baseline := COALESCE(v_baseline, COALESCE((v_cfg->>'default_baseline')::float, 50));

    -- city-wide max decayed incident load, to normalise barrio loads to [0,1]
    SELECT MAX(load) INTO v_max_incident_load FROM (
        SELECT SUM(EXP(-LN(2) * EXTRACT(EPOCH FROM NOW() - dz.created_at) / 86400.0 / v_half_life)) AS load
        FROM danger_zones dz
        JOIN neighborhoods n ON n.city_id = v_city_id
         AND ST_Contains(n.boundary, ST_SetSRID(ST_MakePoint(dz.lng, dz.lat), 4326))
        GROUP BY n.id
    ) t;

    FOR r IN SELECT * FROM neighborhoods WHERE city_id = v_city_id LOOP
        -- Layer 2.2: Red Carpet incident load with exponential decay
        SELECT COALESCE(SUM(EXP(-LN(2) * EXTRACT(EPOCH FROM NOW() - dz.created_at) / 86400.0 / v_half_life)), 0)
        INTO v_incident_load
        FROM danger_zones dz
        WHERE ST_Contains(r.boundary, ST_SetSRID(ST_MakePoint(dz.lng, dz.lat), 4326));
        v_incident_load := CASE WHEN COALESCE(v_max_incident_load, 0) > 0
                                THEN v_incident_load / v_max_incident_load ELSE 0 END;

        -- Layer 2.1 / 2.3: mean deviation of configured granular signals, each
        -- signal value expected pre-normalised to [0,1] by its ingest job
        SELECT COALESCE(AVG(s.value), 0.5), COUNT(*)
        INTO v_signal_dev, v_signal_count
        FROM neighborhood_signals s
        WHERE s.neighborhood_id = r.id;

        -- combine: deviation ∈ [0,1] scales the baseline into [0.5x .. 1.5x]
        v_score := v_baseline * (0.5
            + v_w_incidents * v_incident_load
            + v_w_signals   * CASE WHEN v_signal_count > 0 THEN v_signal_dev ELSE 0.5 END);
        v_score := GREATEST(0, LEAST(100, v_score));

        -- confidence: baseline alone = 0.3; each independent signal adds up to 0.7
        v_conf := LEAST(1.0, 0.3
            + CASE WHEN v_incident_load > 0 THEN 0.3 ELSE 0 END
            + LEAST(v_signal_count, 4) * 0.1);

        -- low confidence → collapse toward baseline (flagged in the dashboard)
        v_score := v_conf * v_score + (1 - v_conf) * v_baseline;

        v_sources := ARRAY['ministerio_interior:' || COALESCE(v_source_period, 'default')];
        IF v_incident_load > 0 THEN v_sources := v_sources || 'redcarpet_incidents'; END IF;
        IF v_signal_count > 0 THEN
            v_sources := v_sources || ('granular_signals:' || v_signal_count::text);
        END IF;

        INSERT INTO neighborhood_scores (neighborhood_id, city_id, score, confidence, components, data_sources)
        VALUES (r.id, v_city_id, ROUND(v_score::numeric, 2), ROUND(v_conf::numeric, 2),
                jsonb_build_object(
                    'baseline', ROUND(v_baseline::numeric, 2),
                    'incident_load', ROUND(v_incident_load::numeric, 4),
                    'signal_deviation', ROUND(v_signal_dev::numeric, 4),
                    'signal_count', v_signal_count),
                v_sources);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- CHOROPLETH ENDPOINT
-- STABLE → PostgREST exposes it as GET:
--   GET /rest/v1/rpc/get_neighborhood_scores_geojson?p_city_slug=valencia
-- ============================================
CREATE OR REPLACE FUNCTION get_neighborhood_scores_geojson(p_city_slug TEXT)
RETURNS JSONB AS $$
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(n.boundary, 6)::jsonb,
            'properties', jsonb_build_object(
                'neighborhood_id', n.id,
                'code', n.code,
                'name', n.name_es,
                'district_code', n.district_code,
                'district_name', n.district_name,
                'score', s.score,
                'confidence', s.confidence,
                'data_sources', s.data_sources,
                'last_updated', s.computed_at
            ))), '[]'::jsonb)
    )
    FROM public.neighborhoods n
    LEFT JOIN public.v_neighborhood_scores_latest s ON s.neighborhood_id = n.id
    JOIN public.cities c ON c.id = n.city_id
    WHERE c.slug = p_city_slug;
$$ LANGUAGE sql STABLE SET search_path = public;

-- ============================================
-- WEEKLY RECOMPUTE (pg_cron ships with Supabase). On-demand runs
-- happen from the superadmin panel via the same RPC.
-- ============================================
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule(
        'recompute-valencia-scores',
        '0 4 * * 1',  -- Mondays 04:00
        $job$ SELECT recompute_neighborhood_scores('valencia'); $job$
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable (%). Schedule recompute externally.', SQLERRM;
END $$;
