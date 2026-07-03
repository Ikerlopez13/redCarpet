// City safety data for the routing engine (Task 4 — València sandbox).
// Provides: live authority alerts (closures, danger zones, puntos violeta)
// and barrio danger scores as fast client-side lookups. Barrio geometry is
// cached with a TTL so route calculation never waits on it twice.

import { supabase } from './supabaseClient';

export interface AuthorityAlert {
    id: string;
    type: 'street_closed' | 'danger_zone' | 'punto_violeta' | 'event' | 'poor_lighting' | 'works' | 'other';
    title: string;
    severity: 'low' | 'medium' | 'high';
    lat: number | null;
    lng: number | null;
    radius_m: number | null;
    segment_geojson: GeoJSON.LineString | null;
    expires_at: string | null;
}

interface ScoredFeature {
    bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
    polygons: number[][][]; // outer rings of each polygon (holes ignored: barrios have none)
    score: number;
    confidence: number;
    code: string;
    name: string;
}

const SCORES_CACHE_KEY = 'rc_neighborhood_scores_v1';
const SCORES_TTL_MS = 6 * 60 * 60 * 1000; // 6h — scores recompute weekly

let scoresCache: { features: ScoredFeature[]; fetchedAt: number } | null = null;

function ringsOf(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][] {
    return geometry.type === 'Polygon'
        ? [geometry.coordinates[0]]
        : geometry.coordinates.map((poly) => poly[0]);
}

function bboxOf(rings: number[][][]): [number, number, number, number] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of rings) {
        for (const [x, y] of ring) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    return [minX, minY, maxX, maxY];
}

// Standard ray-casting point-in-polygon on the outer ring.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (((yi > lat) !== (yj > lat)) &&
            (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Loads the barrio score choropleth for a city into a fast lookup structure.
 * Cached in memory + localStorage. Returns [] when the city has no data
 * (any city other than València today) — routing then behaves exactly as before.
 */
export async function loadNeighborhoodScores(citySlug: string = 'valencia'): Promise<ScoredFeature[]> {
    if (scoresCache && Date.now() - scoresCache.fetchedAt < SCORES_TTL_MS) {
        return scoresCache.features;
    }
    try {
        const stored = localStorage.getItem(SCORES_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Date.now() - parsed.fetchedAt < SCORES_TTL_MS) {
                scoresCache = parsed;
                return parsed.features;
            }
        }
    } catch { /* corrupt cache — refetch */ }

    try {
        const { data, error } = await supabase.rpc('get_neighborhood_scores_geojson', {
            p_city_slug: citySlug
        });
        if (error || !data?.features) return scoresCache?.features ?? [];

        const features: ScoredFeature[] = data.features
            .filter((f: any) => f.properties?.score != null)
            .map((f: any) => {
                const polygons = ringsOf(f.geometry);
                return {
                    bbox: bboxOf(polygons),
                    polygons,
                    score: f.properties.score,
                    confidence: f.properties.confidence ?? 0,
                    code: f.properties.code,
                    name: f.properties.name
                };
            });
        scoresCache = { features, fetchedAt: Date.now() };
        try {
            localStorage.setItem(SCORES_CACHE_KEY, JSON.stringify(scoresCache));
        } catch { /* storage full — memory cache still works */ }
        return features;
    } catch {
        return scoresCache?.features ?? [];
    }
}

/** Barrio danger score (0-100) at a coordinate, or null outside scored areas. */
export function scoreAtPoint(lng: number, lat: number, features: ScoredFeature[]): number | null {
    for (const f of features) {
        const [minX, minY, maxX, maxY] = f.bbox;
        if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
        for (const ring of f.polygons) {
            if (pointInRing(lng, lat, ring)) return f.score;
        }
    }
    return null;
}

/** Live authority alerts inside a bounding box (server evaluates schedules). */
export async function getLiveAuthorityAlerts(
    minLng: number, minLat: number, maxLng: number, maxLat: number
): Promise<AuthorityAlert[]> {
    try {
        const { data, error } = await supabase.rpc('get_live_alerts_in_bbox', {
            min_lon: minLng, min_lat: minLat, max_lon: maxLng, max_lat: maxLat
        });
        if (error || !data) return [];
        return data as AuthorityAlert[];
    } catch {
        return [];
    }
}

/** True between 21:00 and 07:00 local time — puntos violeta weigh more at night. */
export function isNightTime(date: Date = new Date()): boolean {
    const h = date.getHours();
    return h >= 21 || h < 7;
}
