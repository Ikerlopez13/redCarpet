-- ============================================================
-- TASK 4 — PRECOMPUTED EDGE WEIGHTS FOR THE PGROUTING ENGINE
-- Every street edge inherits the danger score of the barrio its
-- midpoint falls in. Precomputed once per score recompute — the
-- routing request path never does point-in-polygon lookups.
-- ============================================================

ALTER TABLE rc_street_edges ADD COLUMN IF NOT EXISTS neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL;
ALTER TABLE rc_street_edges ADD COLUMN IF NOT EXISTS barrio_score FLOAT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rc_street_edges_neighborhood ON rc_street_edges (neighborhood_id);

-- Assign each edge to its barrio (midpoint PIP, GIST-indexed) and refresh
-- the cost: length weighted by barrio danger. Runs after each score
-- recompute; ~O(edges × log barrios).
CREATE OR REPLACE FUNCTION apply_neighborhood_scores_to_edges(p_city_slug TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_city_id UUID;
    n BIGINT;
BEGIN
    SELECT id INTO v_city_id FROM cities WHERE slug = p_city_slug;
    IF v_city_id IS NULL THEN RAISE EXCEPTION 'Unknown city: %', p_city_slug; END IF;

    -- 1. bind edges to barrios (only unbound edges or after boundary updates)
    UPDATE rc_street_edges e
    SET neighborhood_id = n.id
    FROM neighborhoods n
    WHERE n.city_id = v_city_id
      AND e.neighborhood_id IS DISTINCT FROM n.id
      AND ST_Contains(n.boundary, ST_LineInterpolatePoint(e.geom, 0.5));

    -- 2. push latest scores into edge costs:
    --    cost = length × (1 + score/100), so a score-100 barrio doubles the
    --    traversal cost while score 0 leaves pure distance.
    UPDATE rc_street_edges e
    SET barrio_score = s.score,
        cost         = e.length_m * (1 + s.score / 100.0),
        reverse_cost = e.length_m * (1 + s.score / 100.0)
    FROM v_neighborhood_scores_latest s
    WHERE s.neighborhood_id = e.neighborhood_id;

    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Keep edge weights in sync: recompute_neighborhood_scores is followed by
-- this in the weekly cron job.
DO $$
BEGIN
    PERFORM cron.unschedule('recompute-valencia-scores');
    PERFORM cron.schedule(
        'recompute-valencia-scores',
        '0 4 * * 1',
        $job$
        SELECT recompute_neighborhood_scores('valencia');
        SELECT apply_neighborhood_scores_to_edges('valencia');
        $job$
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable (%). Schedule recompute externally.', SQLERRM;
END $$;
