-- ============================================================
-- AUTHORITY ALERTS → APP SYNC
-- Every danger-type alert created from the dashboard is mirrored
-- into danger_zones — the table the released mobile app already
-- reads — so it renders to app users in that exact location with
-- the exact radius, identically to user-reported zones. The mirror
-- follows the alert's lifecycle: edit updates it, resolve/delete
-- removes it. Puntos violeta are NOT mirrored (they are safe
-- points, not danger zones; new app builds render them in violet).
-- ============================================================

ALTER TABLE danger_zones
    ADD COLUMN IF NOT EXISTS authority_alert_id UUID UNIQUE
    REFERENCES authority_alerts(id) ON DELETE CASCADE;

-- authority alert type → danger_zones type (app's rendering vocabulary)
CREATE OR REPLACE FUNCTION map_alert_type_to_zone(t TEXT)
RETURNS TEXT AS $$
    SELECT CASE t
        WHEN 'danger_zone'   THEN 'unsafe'
        WHEN 'poor_lighting' THEN 'dark'
        WHEN 'works'         THEN 'construction'
        WHEN 'street_closed' THEN 'construction'
        WHEN 'event'         THEN 'incident'
        ELSE 'incident'
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION sync_authority_alert_to_danger_zone()
RETURNS TRIGGER AS $$
DECLARE
    -- the app splits description on ' - ' into title/body
    v_description TEXT := COALESCE(NEW.title, '') ||
        CASE WHEN NEW.description IS NOT NULL AND NEW.description <> ''
             THEN ' - ' || NEW.description ELSE '' END;
    v_live BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;  -- FK ON DELETE CASCADE removes the mirror
    END IF;

    v_live := NEW.status = 'active'
        AND NEW.starts_at <= NOW()
        AND (NEW.expires_at IS NULL OR NEW.expires_at > NOW());

    IF NEW.type = 'punto_violeta' OR NEW.lat IS NULL OR NOT v_live THEN
        -- not mirrorable / no longer live → drop any existing mirror
        DELETE FROM danger_zones WHERE authority_alert_id = NEW.id;
        RETURN NEW;
    END IF;

    INSERT INTO danger_zones
        (authority_alert_id, reporter_id, lat, lng, radius, type, description, expires_at, city_id)
    VALUES (
        NEW.id,
        -- reporter only when the authority user has an app profile
        (SELECT id FROM profiles WHERE id = NEW.created_by),
        NEW.lat, NEW.lng,
        COALESCE(NEW.radius_m, 100),
        map_alert_type_to_zone(NEW.type),
        v_description,
        NEW.expires_at,          -- NULL = never expires (app query handles it)
        NEW.city_id
    )
    ON CONFLICT (authority_alert_id) DO UPDATE SET
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        radius = EXCLUDED.radius,
        type = EXCLUDED.type,
        description = EXCLUDED.description,
        expires_at = EXCLUDED.expires_at,
        city_id = EXCLUDED.city_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_alert_to_app ON authority_alerts;
CREATE TRIGGER trg_sync_alert_to_app
    AFTER INSERT OR UPDATE ON authority_alerts
    FOR EACH ROW EXECUTE FUNCTION sync_authority_alert_to_danger_zone();

-- Backfill: mirror alerts that already exist and are live
INSERT INTO danger_zones
    (authority_alert_id, reporter_id, lat, lng, radius, type, description, expires_at, city_id)
SELECT a.id,
       (SELECT p.id FROM profiles p WHERE p.id = a.created_by),
       a.lat, a.lng, COALESCE(a.radius_m, 100),
       map_alert_type_to_zone(a.type),
       COALESCE(a.title, '') || CASE WHEN a.description IS NOT NULL AND a.description <> ''
                                     THEN ' - ' || a.description ELSE '' END,
       a.expires_at, a.city_id
FROM authority_alerts a
WHERE a.type <> 'punto_violeta'
  AND a.lat IS NOT NULL
  AND a.status = 'active'
  AND a.starts_at <= NOW()
  AND (a.expires_at IS NULL OR a.expires_at > NOW())
ON CONFLICT (authority_alert_id) DO NOTHING;
