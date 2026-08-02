-- Enable PostGIS and pgRouting extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Create the street edges table for routing
CREATE TABLE IF NOT EXISTS rc_street_edges (
    id BIGINT PRIMARY KEY, -- OpenStreetMap Way ID
    osm_id BIGINT,
    source BIGINT, -- Source Node ID
    target BIGINT, -- Target Node ID
    length_m FLOAT, -- Length of the segment in meters
    cost FLOAT, -- The Safe Score cost for forward traversal
    reverse_cost FLOAT, -- The Safe Score cost for reverse traversal
    x1 FLOAT, -- Source longitude
    y1 FLOAT, -- Source latitude
    x2 FLOAT, -- Target longitude
    y2 FLOAT, -- Target latitude
    crime_index FLOAT DEFAULT 0.0, -- Base crime index for this segment
    has_lighting BOOLEAN DEFAULT FALSE,
    commercial_density FLOAT DEFAULT 0.0,
    geom GEOMETRY(LineString, 4326)
);

-- Indexes for fast routing and spatial queries
CREATE INDEX IF NOT EXISTS rc_street_edges_source_idx ON rc_street_edges (source);
CREATE INDEX IF NOT EXISTS rc_street_edges_target_idx ON rc_street_edges (target);
CREATE INDEX IF NOT EXISTS rc_street_edges_geom_idx ON rc_street_edges USING GIST (geom);

-- Function to find the nearest routing node to a given coordinate
CREATE OR REPLACE FUNCTION find_nearest_node(lon FLOAT, lat FLOAT)
RETURNS BIGINT AS $$
DECLARE
    nearest_node BIGINT;
BEGIN
    SELECT source INTO nearest_node
    FROM rc_street_edges
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
    LIMIT 1;
    
    RETURN nearest_node;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate the safest route between two coordinates
CREATE OR REPLACE FUNCTION calculate_safe_route(start_lon FLOAT, start_lat FLOAT, end_lon FLOAT, end_lat FLOAT)
RETURNS TABLE (
    seq INT,
    edge_id BIGINT,
    node BIGINT,
    cost FLOAT,
    geom GEOMETRY
) AS $$
DECLARE
    start_node BIGINT;
    end_node BIGINT;
BEGIN
    -- 1. Find nearest nodes
    start_node := find_nearest_node(start_lon, start_lat);
    end_node := find_nearest_node(end_lon, end_lat);

    -- 2. Run Dijkstra algorithm
    RETURN QUERY
    SELECT 
        d.seq, 
        d.edge AS edge_id, 
        d.node, 
        d.cost,
        e.geom
    FROM pgr_dijkstra(
        'SELECT id, source, target, cost, reverse_cost FROM rc_street_edges',
        start_node, 
        end_node,
        directed := true
    ) AS d
    LEFT JOIN rc_street_edges e ON d.edge = e.id;
END;
$$ LANGUAGE plpgsql;

-- Expose the route calculation over RPC with GeoJSON output for the frontend
CREATE OR REPLACE FUNCTION get_safe_route_geojson(start_lon FLOAT, start_lat FLOAT, end_lon FLOAT, end_lat FLOAT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(ST_AsGeoJSON(r.geom)::jsonb)
    ) INTO result
    FROM calculate_safe_route(start_lon, start_lat, end_lon, end_lat) r
    WHERE r.geom IS NOT NULL;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
