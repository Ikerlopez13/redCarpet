// Mapbox Directions API Service for RedCarpet
// Calculates routes between two points with different profiles

import { supabase } from './supabaseClient';
import { isBlocked, track } from './mapboxBudget';
import { allow } from './rateLimiter';
import {
    loadNeighborhoodScores,
    scoreAtPoint,
    getLiveAuthorityAlerts,
    isNightTime,
    type AuthorityAlert
} from './citySafetyService';
import { isPositiveIncident } from '../utils/incidentLabels';

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
    location?: [number, number]; // [lng, lat] del punto de giro (turn-by-turn)
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

// Llama a Directions a través del PROXY autenticado (token server-side + rate
// limit + tope global). Reenvía la petición idéntica → geometría/tiempos iguales.
// Devuelve el JSON de Mapbox (o null si falla / la para el backend).
async function fetchDirectionsProxy(
    profile: string,
    coords: string,
    alternatives: boolean
): Promise<any | null> {
    try {
        const { data, error } = await supabase.functions.invoke('mapbox-directions', {
            body: { profile, coords, alternatives, language: 'es' },
        });
        if (error) throw error;
        if (data?.error === 'rate_limited' || data?.error === 'budget_blocked') return null;
        return data;
    } catch (e) {
        console.warn('[directions proxy] error:', e);
        return null;
    }
}

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
    if (isBlocked() || !allow('directions', 15)) return null;

    const profile = PROFILE_MAP[mode] || 'walking';
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

    try {
        track('directions');
        const data = await fetchDirectionsProxy(profile, coords, false);

        if (data && data.routes && data.routes.length > 0) {
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
                        bearing_before: step.maneuver.bearing_before,
                        location: step.maneuver.location
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

/**
 * Builds detour waypoints that force the route to go AROUND danger zones sitting
 * on the direct corridor. For each blocking zone we drop a waypoint just past its
 * edge, on the far side from where the zone leans, so Mapbox routes around it.
 * Capped to the 2 worst blockers to bound the number of proxy calls.
 */
function avoidanceWaypointVariants(
    origin: Coordinate,
    destination: Coordinate,
    zones: Array<{ lat: number; lng: number; radius: number }>
): Coordinate[][] {
    const mPerDegLat = 111320;
    const latRef = (origin.lat + destination.lat) / 2;
    const mPerDegLng = 111320 * Math.cos((latRef * Math.PI) / 180);
    const toXY = (p: Coordinate) => ({ x: p.lng * mPerDegLng, y: p.lat * mPerDegLat });
    const toLatLng = (x: number, y: number): Coordinate => ({ lat: y / mPerDegLat, lng: x / mPerDegLng });

    const O = toXY(origin), D = toXY(destination);
    const dx = D.x - O.x, dy = D.y - O.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1) return [];
    const ux = dx / segLen, uy = dy / segLen;   // unit vector along the route
    const nx = -uy, ny = ux;                     // unit perpendicular (left of travel)

    const blocking: Array<{ left: Coordinate; right: Coordinate; block: number }> = [];
    for (const z of zones) {
        const Z = toXY({ lat: z.lat, lng: z.lng });
        const t = (Z.x - O.x) * ux + (Z.y - O.y) * uy;   // projection along the route
        if (t < 0 || t > segLen) continue;                // zone is not between O and D
        const perp = (Z.x - O.x) * nx + (Z.y - O.y) * ny; // signed perpendicular distance
        const clearance = Math.max((z.radius || 100) + 120, 250);
        if (Math.abs(perp) > clearance) continue;          // corridor already skirts it
        blocking.push({
            // We do not guess which side is walkable (coast, railway, river...).
            // Ask Mapbox for both and let the safety score choose the valid one.
            left: toLatLng(Z.x + nx * clearance, Z.y + ny * clearance),
            right: toLatLng(Z.x - nx * clearance, Z.y - ny * clearance),
            block: clearance - Math.abs(perp)   // deeper intrusion → higher priority
        });
    }
    return blocking
        .sort((a, b) => b.block - a.block)
        .slice(0, 2)
        .flatMap(b => [[b.left], [b.right]]);
}

function lateralWaypointVariants(origin: Coordinate, destination: Coordinate): Coordinate[][] {
    const mPerDegLat = 111320;
    const latRef = (origin.lat + destination.lat) / 2;
    const mPerDegLng = 111320 * Math.cos((latRef * Math.PI) / 180);
    const ox = origin.lng * mPerDegLng, oy = origin.lat * mPerDegLat;
    const dx = destination.lng * mPerDegLng - ox;
    const dy = destination.lat * mPerDegLat - oy;
    const length = Math.hypot(dx, dy);
    if (length < 1) return [];
    const nx = -dy / length, ny = dx / length;
    const point = (fraction: number, offset: number): Coordinate => ({
        lng: (ox + dx * fraction + nx * offset) / mPerDegLng,
        lat: (oy + dy * fraction + ny * offset) / mPerDegLat,
    });

    // Long journeys need kilometre-scale alternatives. The old fixed 150–260m
    // offset was snapped straight back onto the same road by Mapbox.
    const inner = Math.max(120, Math.min(1800, length * 0.10));
    const outer = Math.max(220, Math.min(3000, length * 0.18));
    return [
        [point(0.5, inner)],
        [point(0.5, -inner)],
        [point(0.5, outer)],
        [point(0.5, -outer)],
        [point(0.33, inner), point(0.67, inner)],
        [point(0.33, -inner), point(0.67, -inner)],
    ];
}

function routesAreEquivalent(a: RouteResult, b: RouteResult): boolean {
    if (Math.abs(a.distance - b.distance) / Math.max(a.distance, b.distance, 1) > 0.025) return false;
    const fractions = [0.2, 0.4, 0.6, 0.8];
    const distances = fractions.map(f => {
        const ac = a.geometry.coordinates[Math.floor((a.geometry.coordinates.length - 1) * f)];
        const bc = b.geometry.coordinates[Math.floor((b.geometry.coordinates.length - 1) * f)];
        return getHaversineDistance(ac[1], ac[0], bc[1], bc[0]);
    });
    return distances.reduce((sum, d) => sum + d, 0) / distances.length < 35;
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

    const fetchWithWaypoints = async (waypoints: Coordinate[]): Promise<RouteResult[]> => {
        if (isBlocked() || !allow('directions', 15)) return [];
        const coords = [origin, ...waypoints, destination]
            .map(p => `${p.lng},${p.lat}`)
            .join(';');

        try {
            track('directions');
            const data = await fetchDirectionsProxy(profile, coords, true);
            if (!data || !data.routes || data.routes.length === 0) return [];
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

        const genericWaypointVariants = lateralWaypointVariants(origin, destination);

        // bbox around the trip, padded ~1km, to fetch authority alerts once
        const pad = 0.01;
        const bbox = {
            minLng: Math.min(origin.lng, destination.lng) - pad,
            minLat: Math.min(origin.lat, destination.lat) - pad,
            maxLng: Math.max(origin.lng, destination.lng) + pad,
            maxLat: Math.max(origin.lat, destination.lat) + pad
        };

        // STEP 1 — fetch the safety data FIRST so we can build waypoints that
        // actively route AROUND the danger zones on the direct corridor.
        const [
            { data: dangerZones },
            authorityAlerts,
            scoreFeatures,
        ] = await Promise.all([
            // mirrored authority alerts (authority_alert_id set) are already
            // penalised via authorityPenalty — exclude them here to avoid
            // counting the same alert twice
            isWalking ? supabase.from('danger_zones').select('*').is('authority_alert_id', null).or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`) : Promise.resolve({ data: [] }),
            isWalking ? getLiveAuthorityAlerts(bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat) : Promise.resolve([]),
            isWalking ? loadNeighborhoodScores() : Promise.resolve([]),
        ]);

        // STEP 2 — targeted detours around blocking danger zones (walking only).
        // Solo rodeamos alertas MALAS; las buenas (acceso seguro, zona inclusiva,
        // autoridades) no se esquivan.
        const avoidanceVariants = (isWalking && dangerZones)
            ? avoidanceWaypointVariants(
                origin,
                destination,
                (dangerZones as any[])
                    .filter(z => !isPositiveIncident(z.description))
                    .map(z => ({ lat: z.lat, lng: z.lng, radius: z.radius || 100 }))
            )
            : [];
        const waypointVariants = [...genericWaypointVariants, ...avoidanceVariants];

        // STEP 3 — fetch the direct route + every waypoint variant in parallel.
        const [directRoutes, ...waypointRouteSets] = await Promise.all([
            fetchWithWaypoints([]),
            ...waypointVariants.map(wps => fetchWithWaypoints(wps))
        ]);

        const allRawRoutes = [directRoutes, ...waypointRouteSets].flat();
        // Descartar rodeos excesivos: un waypoint lateral que obliga a un bucle
        // ("nudos"/cruces raros) genera una ruta mucho más larga que la directa.
        // Cualquier ruta >1,8× la directa se descarta (la directa siempre pasa).
        const directDistance = directRoutes.reduce(
            (min, r) => Math.min(min, r.distance),
            Infinity
        );
        const maxDetour = Number.isFinite(directDistance) ? directDistance * 1.5 : Infinity;
        const allRoutes = allRawRoutes.filter(
            r => isValidRoute(r, origin, destination) && r.distance <= maxDetour
        );

        // Cuenta zonas cruzadas separando MALAS (a evitar) de BUENAS (a preferir).
        // La ruta segura solo esquiva las malas; las buenas (acceso seguro, zona
        // inclusiva, autoridades presentes) suman un pequeño bonus, no penalizan.
        const countZoneIntersections = (route: RouteResult) => {
            const result = { bad: 0, good: 0 };
            if (!route.geometry || !dangerZones) return result;
            const coords = route.geometry.coordinates;
            dangerZones.forEach((zone: any) => {
                const hit = coords.some((c: any) =>
                    getHaversineDistance(c[1], c[0], zone.lat, zone.lng) < (zone.radius || 100)
                );
                if (!hit) return;
                if (isPositiveIncident(zone.description)) result.good++;
                else result.bad++;
            });
            return result;
        };

        // Deduplicate using several points along the geometry. Comparing only
        // the midpoint collapsed genuinely different long routes.
        type ScoredRoute = RouteResult & { dangerCount: number; goodCount: number; safety: RouteSafetyMetrics };
        const uniqueRoutes: ScoredRoute[] = [];
        for (const route of allRoutes) {
            const isDuplicate = uniqueRoutes.some(u => routesAreEquivalent(route, u));
            if (!isDuplicate) {
                const zc = countZoneIntersections(route);
                uniqueRoutes.push({
                    ...route,
                    dangerCount: zc.bad,
                    goodCount: zc.good,
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

        // Composite danger for the Safest choice:
        //   BAD user reports + authority penalties + barrio exposure
        //   − punto violeta bonus (doubled at night: attended safe points matter
        //     most then) − GOOD zone bonus (acceso seguro / inclusiva / autoridades).
        // Las alertas BUENAS nunca penalizan: restan (la ruta puede preferirlas).
        const violetaWeight = isNightTime() ? 4 : 2;
        const compositeDanger = (r: ScoredRoute) =>
            r.dangerCount * 5
            + r.safety.authorityPenalty
            + r.safety.barrioExposure / 10
            - r.safety.violetaCount * violetaWeight
            - r.goodCount * 2;

        // SAFEST = the passable route with the LOWEST danger, full stop. This is
        // the whole promise of the app: the safe route must AVOID danger zones
        // even when the safest route happens to also be the shortest one.
        //
        // ⚠️ Previously the safe route was chosen only among the NON-fastest
        // routes (to force "safe ≥ fastest duration"). That inverted reality:
        // when the fastest route was the one dodging a danger zone, it got
        // excluded and the safe slot was handed a longer route going STRAIGHT
        // THROUGH the zone. Safety correctness beats that cosmetic guarantee.
        const byDanger = [...candidates].sort((a, b) => {
            // Crossing one reported danger can never be compensated by a nicer
            // neighbourhood score: avoiding explicit alerts is the first rule.
            if (a.dangerCount !== b.dangerCount) return a.dangerCount - b.dangerCount;
            const d = compositeDanger(a) - compositeDanger(b);
            if (Math.abs(d) > 0.01) return d;
            return a.duration - b.duration; // tie on danger → prefer the quicker
        });
        const safeRoute = byDanger[0];

        // FASTEST = shortest duration among passable routes (may equal Safe —
        // that's the ideal case: the safest route is also the quickest, and both
        // cards honestly show it; RouteSelection already dedupes client-side).
        const byDuration = [...candidates].sort((a, b) => a.duration - b.duration);
        const fastestRoute = byDuration[0];

        // BALANCED = best-by-danger among whatever routes are left, so it always
        // sits between Safe and Fast (never safer than Safe, never faster than
        // Fast). Falls back to Safe on short hops with a single valid route.
        const balancedPool = candidates.filter(r => r !== safeRoute && r !== fastestRoute);
        const balancedRoute = balancedPool.length > 0
            ? balancedPool.sort((a, b) => compositeDanger(a) - compositeDanger(b))[0]
            : null;

        // Contract: when a route exists the caller always gets 3 routes. If no
        // meaningful alternative survived validation (typical on very short
        // hops) the routes collapse to the same geometry — handled downstream.
        return {
            fast: fastestRoute,
            balanced: balancedRoute || fastestRoute,
            safe: safeRoute
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
