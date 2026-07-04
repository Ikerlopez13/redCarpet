// Mapbox Directions API Service for RedCarpet
// Calculates routes between two points with different profiles

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';
import { supabase } from './supabaseClient';
import {
    loadNeighborhoodScores,
    scoreAtPoint,
    getLiveAuthorityAlerts,
    isNightTime,
    type AuthorityAlert
} from './citySafetyService';

export interface Coordinate {
    lat: number;
    lng: number;
}

export interface RouteManeuver {
    type: string;
    instruction: string;
    modifier?: string;
    bearing_after?: number;
    bearing_before?: number;
}

export interface RouteStep {
    instruction: string;
    distance: number; // meters
    duration: number; // seconds
    name: string; // street name
    maneuver: RouteManeuver;
}

export interface RouteResult {
    distance: number; // meters
    duration: number; // seconds
    geometry: any; // GeoJSON.LineString;
    steps: RouteStep[];
}

export type TransportMode = 'walking' | 'cycling' | 'driving-traffic';

// Map our app's transport modes to Mapbox profiles
const PROFILE_MAP: Record<string, string> = {
    walking: 'walking',
    cycling: 'cycling',
    transit: 'driving-traffic', // Mapbox doesn't have transit, we'll use driving as fallback
    driving: 'driving-traffic'
};

/**
 * Get a route from Mapbox Directions API
 */
export async function getRoute(
    origin: Coordinate,
    destination: Coordinate,
    mode: string = 'walking'
): Promise<RouteResult | null> {
    const profile = PROFILE_MAP[mode] || 'walking';

    const url = `${DIRECTIONS_API_BASE}/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?` +
        new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            geometries: 'geojson',
            steps: 'true',
            overview: 'full',
            language: 'es'
        });

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
                steps: route.legs[0].steps.map((step: any) => ({
                    instruction: step.maneuver.instruction || 'Continúa recto',
                    distance: step.distance,
                    duration: step.duration,
                    name: step.name || 'Sin nombre',
                    maneuver: {
                        type: step.maneuver.type,
                        instruction: step.maneuver.instruction || 'Continúa recto',
                        modifier: step.maneuver.modifier,
                        bearing_after: step.maneuver.bearing_after,
                        bearing_before: step.maneuver.bearing_before
                    }
                }))
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching route:', error);
        return null;
    }
}

/**
 * Attempts to get the Safe Route from our proprietary Supabase PostGIS Engine.
 * If data is missing (DB empty), falls back to null.
 */
export async function getSafeRouteFromSupabase(origin: Coordinate, destination: Coordinate): Promise<RouteResult | null> {
    try {
        const { data, error } = await supabase.rpc('get_safe_route_geojson', {
            start_lon: origin.lng,
            start_lat: origin.lat,
            end_lon: destination.lng,
            end_lat: destination.lat
        });

        if (error || !data || !data.features || data.features.length === 0) {
            console.log('[SafeScore Engine] No route found in proprietary DB. Falling back to Mapbox.');
            return null; 
        }

        console.log('[SafeScore Engine] 🎉 Successfully calculated Safe Route via PostGIS!');
        
        // Convert the GeoJSON returned by our RPC to a Mapbox RouteResult shape
        // Note: For MVP, we mock the steps. In production, we'd reverse geocode steps.
        return {
            distance: 0, // We would calculate this in PostGIS
            duration: 0,
            geometry: data.features[0].geometry,
            steps: [{
                instruction: 'Sigue la ruta segura destacada',
                distance: 0,
                duration: 0,
                name: 'Ruta Segura Red Carpet',
                maneuver: { type: 'depart', instruction: 'Inicia ruta segura' }
            }]
        };
    } catch (err) {
        console.error('[SafeScore Engine] Error:', err);
        return null;
    }
}

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidRoute(route: RouteResult, origin: Coordinate, destination: Coordinate): boolean {
    if (!route.geometry?.coordinates || route.geometry.coordinates.length < 4) return false;
    if (!route.steps || route.steps.length < 2) return false;
    const directDist = getHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    if (directDist > 0 && route.distance < directDist * 0.7) return false;
    // Tighter cap: reject routes >2.5x the direct distance (was 3.5x — produced knots)
    if (directDist > 0 && route.distance > directDist * 2.5) return false;
    const last = route.geometry.coordinates[route.geometry.coordinates.length - 1];
    if (getHaversineDistance(last[1], last[0], destination.lat, destination.lng) > 300) return false;
    if (hasSignificantBacktracking(route, destination)) return false;
    return true;
}

/**
 * Detects routes that move significantly away from the destination after reaching a near point.
 * This catches the "loop/knot" patterns where the route backtracks nonsensically.
 */
function hasSignificantBacktracking(route: RouteResult, destination: Coordinate): boolean {
    const coords = route.geometry.coordinates;
    if (coords.length < 6) return false;
    let minDistToDest = Infinity;
    let minDistIdx = 0;
    for (let i = 0; i < coords.length; i++) {
        const d = getHaversineDistance(coords[i][1], coords[i][0], destination.lat, destination.lng);
        if (d < minDistToDest) { minDistToDest = d; minDistIdx = i; }
    }
    // If the closest point to destination is NOT in the last 30% of the route, route backtracks
    if (minDistIdx < coords.length * 0.7) return true;
    // Also reject if route wanders >400m away from destination after getting within 200m of it
    let reachedClose = false;
    for (let i = 0; i < coords.length; i++) {
        const d = getHaversineDistance(coords[i][1], coords[i][0], destination.lat, destination.lng);
        if (d < 200) reachedClose = true;
        if (reachedClose && d > 400) return true;
    }
    return false;
}

// ---- València sandbox: authority alerts + barrio scores in routing ----

const CLOSURE_HIT_DISTANCE_M = 30;   // route passes this close to a closed segment → blocked
const VIOLETA_BONUS_RADIUS_M = 150;  // puntos violeta attract the Safest route within this radius
const ROUTE_SAMPLE_STEP = 4;         // score every Nth coordinate (perf; ~10-25 samples/route)

const ALERT_SEVERITY_PENALTY: Record<string, number> = { low: 1, medium: 2.5, high: 5 };

export interface RouteSafetyMetrics {
    blockedByClosure: boolean;
    authorityPenalty: number;   // danger-type authority alerts crossed, severity-weighted
    barrioExposure: number;     // mean barrio danger score (0-100) along the route
    violetaCount: number;       // distinct puntos violeta within bonus radius
}

// Distance in meters from a point to a line segment, using a local
// equirectangular projection (accurate at street scale).
function pointToSegmentMeters(p: number[], a: number[], b: number[]): number {
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos((p[1] * Math.PI) / 180);
    const px = (p[0] - a[0]) * mPerDegLng, py = (p[1] - a[1]) * mPerDegLat;
    const bx = (b[0] - a[0]) * mPerDegLng, by = (b[1] - a[1]) * mPerDegLat;
    const lenSq = bx * bx + by * by;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;
    const dx = px - t * bx, dy = py - t * by;
    return Math.sqrt(dx * dx + dy * dy);
}

function minDistanceToLine(coords: number[][], line: GeoJSON.LineString): number {
    let min = Infinity;
    const seg = line.coordinates;
    for (const c of coords) {
        for (let i = 0; i < seg.length - 1; i++) {
            const d = pointToSegmentMeters(c, seg[i], seg[i + 1]);
            if (d < min) min = d;
        }
    }
    return min;
}

export function computeRouteSafetyMetrics(
    route: RouteResult,
    alerts: AuthorityAlert[],
    scoreFeatures: Awaited<ReturnType<typeof loadNeighborhoodScores>>
): RouteSafetyMetrics {
    const coords: number[][] = route.geometry.coordinates;
    let blockedByClosure = false;
    let authorityPenalty = 0;
    let violetaCount = 0;

    for (const alert of alerts) {
        let hit = false;
        if (alert.lat != null && alert.lng != null) {
            const radius = alert.type === 'punto_violeta'
                ? VIOLETA_BONUS_RADIUS_M
                : (alert.radius_m || 100);
            hit = coords.some((c) => getHaversineDistance(c[1], c[0], alert.lat!, alert.lng!) < radius);
        } else if (alert.segment_geojson) {
            hit = minDistanceToLine(coords, alert.segment_geojson) < CLOSURE_HIT_DISTANCE_M;
        }
        if (!hit) continue;

        if (alert.type === 'street_closed') {
            blockedByClosure = true;
        } else if (alert.type === 'punto_violeta') {
            violetaCount++;
        } else {
            authorityPenalty += ALERT_SEVERITY_PENALTY[alert.severity] ?? 2.5;
        }
    }

    let scoreSum = 0;
    let scoreSamples = 0;
    for (let i = 0; i < coords.length; i += ROUTE_SAMPLE_STEP) {
        const s = scoreAtPoint(coords[i][0], coords[i][1], scoreFeatures);
        if (s !== null) { scoreSum += s; scoreSamples++; }
    }

    return {
        blockedByClosure,
        authorityPenalty,
        barrioExposure: scoreSamples > 0 ? scoreSum / scoreSamples : 0,
        violetaCount
    };
}

export async function getAlternativeRoutes(
    origin: Coordinate,
    destination: Coordinate,
    baseMode: string = 'walking'
): Promise<{
    safe: RouteResult | null;
    balanced: RouteResult | null;
    fast: RouteResult | null;
}> {
    const profile = PROFILE_MAP[baseMode] || 'walking';

    const fetchWithWaypoint = async (waypoint: Coordinate | null): Promise<RouteResult[]> => {
        const coords = waypoint
            ? `${origin.lng},${origin.lat};${waypoint.lng},${waypoint.lat};${destination.lng},${destination.lat}`
            : `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

        const url = `${DIRECTIONS_API_BASE}/${profile}/${coords}?` +
            new URLSearchParams({
                access_token: MAPBOX_TOKEN,
                geometries: 'geojson',
                steps: 'true',
                overview: 'full',
                alternatives: 'true',
                language: 'es'
            });

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.routes || data.routes.length === 0) return [];
            return data.routes.map((route: any) => ({
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
                steps: route.legs.flatMap((leg: any) => leg.steps.map((step: any) => ({
                    instruction: step.maneuver.instruction || 'Continúa',
                    distance: step.distance,
                    duration: step.duration,
                    name: step.name || '',
                    maneuver: step.maneuver
                })))
            }));
        } catch {
            return [];
        }
    };

    try {
        const isWalking = baseMode === 'walking';

        // 6 waypoints: 3 left-side + 3 right-side offsets, scaled to trip
        // length so short hops get proportionate detours (fixed offsets made
        // every alternative fail validation on sub-500m trips)
        const midLat = (origin.lat + destination.lat) / 2;
        const midLng = (origin.lng + destination.lng) / 2;
        const directDeg = Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng);
        const scale = Math.max(0.15, Math.min(1, directDeg / 0.02));
        const offsets = [0.0020 * scale, 0.0030 * scale, 0.0040 * scale];
        const waypoints: Coordinate[] = [
            ...offsets.map(d => ({ lat: midLat + d, lng: midLng - d })),
            ...offsets.map(d => ({ lat: midLat - d, lng: midLng + d })),
        ];

        // bbox around the trip, padded ~1km, to fetch authority alerts once
        const pad = 0.01;
        const bbox = {
            minLng: Math.min(origin.lng, destination.lng) - pad,
            minLat: Math.min(origin.lat, destination.lat) - pad,
            maxLng: Math.max(origin.lng, destination.lng) + pad,
            maxLat: Math.max(origin.lat, destination.lat) + pad
        };

        const [
            { data: dangerZones },
            authorityAlerts,
            scoreFeatures,
            directRoutes,
            ...waypointRouteSets
        ] = await Promise.all([
            // mirrored authority alerts (authority_alert_id set) are already
            // penalised via authorityPenalty — exclude them here to avoid
            // counting the same alert twice
            isWalking ? supabase.from('danger_zones').select('*').is('authority_alert_id', null).or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`) : Promise.resolve({ data: [] }),
            isWalking ? getLiveAuthorityAlerts(bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat) : Promise.resolve([]),
            isWalking ? loadNeighborhoodScores() : Promise.resolve([]),
            fetchWithWaypoint(null),
            ...waypoints.map(wp => fetchWithWaypoint(wp))
        ]);

        const allRawRoutes = [directRoutes, ...waypointRouteSets].flat();
        const allRoutes = allRawRoutes.filter(r => isValidRoute(r, origin, destination));

        const countDangerIntersections = (route: RouteResult) => {
            if (!route.geometry || !dangerZones) return 0;
            let count = 0;
            const coords = route.geometry.coordinates;
            dangerZones.forEach((zone: any) => {
                const hit = coords.some((c: any) =>
                    getHaversineDistance(c[1], c[0], zone.lat, zone.lng) < (zone.radius || 100)
                );
                if (hit) count++;
            });
            return count;
        };

        // Deduplicate: two routes are "same" if their midpoint is within 20m
        type ScoredRoute = RouteResult & { dangerCount: number; safety: RouteSafetyMetrics };
        const uniqueRoutes: ScoredRoute[] = [];
        for (const route of allRoutes) {
            const mid = route.geometry.coordinates[Math.floor(route.geometry.coordinates.length / 2)];
            const isDuplicate = uniqueRoutes.some(u => {
                const uMid = u.geometry.coordinates[Math.floor(u.geometry.coordinates.length / 2)];
                return getHaversineDistance(mid[1], mid[0], uMid[1], uMid[0]) < 20;
            });
            if (!isDuplicate) {
                uniqueRoutes.push({
                    ...route,
                    dangerCount: countDangerIntersections(route),
                    safety: computeRouteSafetyMetrics(route, authorityAlerts, scoreFeatures)
                });
            }
        }

        if (uniqueRoutes.length === 0) {
            return { safe: null, balanced: null, fast: null };
        }

        // Active street closures are impassable: drop blocked routes when an
        // open alternative exists (never leave the user without a route).
        const openRoutes = uniqueRoutes.filter(r => !r.safety.blockedByClosure);
        const candidates = openRoutes.length > 0 ? openRoutes : uniqueRoutes;
        if (openRoutes.length === 0 && uniqueRoutes.some(r => r.safety.blockedByClosure)) {
            console.warn('[Routing] All routes cross an active closure — returning best effort.');
        }

        // Fastest = shortest duration among passable routes
        const byDuration = [...candidates].sort((a, b) => a.duration - b.duration);
        const fastestRoute = byDuration[0];
        const remaining = byDuration.slice(1);

        // Composite danger for the Safest choice:
        //   user reports + authority penalties + barrio exposure − punto violeta
        //   bonus (doubled at night: attended safe points matter most then).
        const violetaWeight = isNightTime() ? 4 : 2;
        const compositeDanger = (r: ScoredRoute) =>
            r.dangerCount * 5
            + r.safety.authorityPenalty
            + r.safety.barrioExposure / 10
            - r.safety.violetaCount * violetaWeight;

        // Safest is picked among `remaining` (all ≥ fastest duration), so the
        // existing guarantee "Safest is never shorter than Fastest" holds.
        const safeRoute = remaining.length > 0
            ? [...remaining].sort((a, b) => {
                const d = compositeDanger(a) - compositeDanger(b);
                if (Math.abs(d) > 0.01) return d;
                return a.distance - b.distance;
            })[0]
            : null;

        // Balanced route: between fast and safe, sorted by combined score
        const remainingForBalanced = remaining.filter(r => r !== safeRoute);
        const balancedRoute = remainingForBalanced.length > 0
            ? remainingForBalanced[0]
            : (remaining[0] !== safeRoute ? remaining[0] : null);

        // Contract: when a fast route exists the caller always gets 3 routes.
        // If no meaningful alternative survived validation (typical on very
        // short hops) the fastest route doubles as safe/balanced — the same
        // fallback RouteSelection already applies client-side.
        return {
            fast: fastestRoute,
            balanced: balancedRoute || fastestRoute,
            safe: safeRoute || fastestRoute
        };

    } catch (error) {
        console.error('Error fetching alternative routes:', error);
        return { safe: null, balanced: null, fast: null };
    }
}

/**
 * Format duration from seconds to human readable string
 */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
}

/**
 * Format distance from meters to human readable string
 */
export function formatDistance(meters: number): string {
    const useMiles = localStorage.getItem('use_miles') === 'true';
    if (useMiles) {
        const miles = meters * 0.000621371;
        if (miles < 0.1) {
            const feet = Math.round(meters * 3.28084);
            return `${feet} ft`;
        }
        return `${miles.toFixed(1)} mi`;
    } else {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

// Barcelona locations - Felipe II 229 area
export const LOCATIONS = {
    HOME: { lat: 41.4088, lng: 2.1890, name: 'Casa (Felipe II)' },
    CENTRAL_PARK: { lat: 41.4120, lng: 2.1850, name: 'Parc del Clot' },
    WORK: { lat: 41.4030, lng: 2.1740, name: 'Oficina' },
    GYM: { lat: 41.4050, lng: 2.1920, name: 'Gimnasio' },
    UNIVERSITY: { lat: 41.3880, lng: 2.1130, name: 'Universidad' }
};
