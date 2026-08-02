// Mapbox Directions API Service for RedCarpet
// Calculates routes between two points with different profiles

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';
import { supabase } from './supabaseClient';
import { isBlocked, track } from './mapboxBudget';
import { allow } from './rateLimiter';

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
    location?: [number, number]; // [lng, lat]
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

export interface Neighborhood {
    name: string;
    lat: number;
    lng: number;
    radius: number; // in meters
    dangerWeight: number; // positive for penalty, negative for bonus (safe zone)
}

export const NEIGHBORHOODS: Neighborhood[] = [
    // High-conflict (avoid/penalize)
    { name: 'El Raval', lat: 41.3788, lng: 2.1685, radius: 600, dangerWeight: 250 },
    { name: 'El Gòtic', lat: 41.3825, lng: 2.1770, radius: 500, dangerWeight: 200 },
    { name: 'La Barceloneta', lat: 41.3800, lng: 2.1890, radius: 500, dangerWeight: 150 },
    { name: 'Nou Barris', lat: 41.4420, lng: 2.1800, radius: 700, dangerWeight: 150 },
    
    // Safe (favor/bonus)
    { name: 'L\'Eixample', lat: 41.3930, lng: 2.1620, radius: 1200, dangerWeight: -100 },
    { name: 'Les Corts', lat: 41.3875, lng: 2.1310, radius: 900, dangerWeight: -80 },
    { name: 'Sarrià-Sant Gervasi', lat: 41.4000, lng: 2.1220, radius: 900, dangerWeight: -100 },
    { name: 'Gràcia', lat: 41.4030, lng: 2.1570, radius: 700, dangerWeight: -80 }
];

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

    const url = `${DIRECTIONS_API_BASE}/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?` +
        new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            geometries: 'geojson',
            steps: 'true',
            overview: 'full',
            language: 'es'
        });

    try {
        track('directions');
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

export function isNightTime(): boolean {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
}

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2 - lat1) * Math.PI/180;
    const deltaLambda = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function checkOverlap(routeA: RouteResult, routeB: RouteResult, threshold: number = 0.85): boolean {
    if (!routeA.geometry || !routeB.geometry) return false;
    const coordsA = routeA.geometry.coordinates;
    const coordsB = routeB.geometry.coordinates;
    let nearCount = 0;

    coordsA.forEach((cA: any) => {
        const near = coordsB.some((cB: any) => {
            const dist = getHaversineDistance(cA[1], cA[0], cB[1], cB[0]);
            return dist < 20; // tighter: 20m so parallel streets aren't considered identical
        });
        if (near) nearCount++;
    });

    return (nearCount / coordsA.length) >= threshold;
}

function isValidRoute(route: RouteResult, origin: Coordinate, destination: Coordinate): boolean {
    if (!route.geometry?.coordinates || route.geometry.coordinates.length < 4) return false;
    if (!route.steps || route.steps.length < 2) return false;

    const directDist = getHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);

    // Must be at least 70% of direct distance (no teleporting shortcuts)
    if (route.distance < directDist * 0.7) return false;

    // Can't be an absurd detour: more than 3.5× the direct distance is impossible/wrong
    if (directDist > 0 && route.distance > directDist * 3.5) return false;

    // Route must actually end near destination (within 300m)
    const coords = route.geometry.coordinates;
    const last = coords[coords.length - 1];
    const distToEnd = getHaversineDistance(last[1], last[0], destination.lat, destination.lng);
    if (distToEnd > 300) return false;

    return true;
}

async function fetchRouteWithWaypoint(
    origin: Coordinate,
    waypoint: Coordinate,
    destination: Coordinate,
    profile: string,
    simulateWalkingSpeed: boolean = false
): Promise<RouteResult | null> {
    if (isBlocked()) return null;

    const url = `${DIRECTIONS_API_BASE}/${profile}/${origin.lng},${origin.lat};${waypoint.lng},${waypoint.lat};${destination.lng},${destination.lat}?` +
        new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            geometries: 'geojson',
            steps: 'true',
            overview: 'full',
            radiuses: 'unlimited;unlimited;unlimited',
            language: 'es'
        });

    try {
        track('directions');
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const calculatedDuration = simulateWalkingSpeed ? route.distance / 1.4 : route.duration;
            return {
                distance: route.distance,
                duration: calculatedDuration,
                geometry: route.geometry,
                steps: route.legs.flatMap((leg: any) => leg.steps).map((step: any) => ({
                    instruction: step.maneuver.instruction || 'Continúa',
                    distance: step.distance,
                    duration: simulateWalkingSpeed ? step.distance / 1.4 : step.duration,
                    name: step.name || '',
                    maneuver: step.maneuver
                }))
            };
        }
    } catch (err) {
        console.error('Error fetching waypoint route:', err);
    }
    return null;
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
    if (isBlocked() || !allow('directions', 15)) {
        return { safe: null, balanced: null, fast: null };
    }

    const fetchProfile = async (profile: string, simulateWalkingSpeed: boolean = false): Promise<RouteResult[]> => {
        if (isBlocked()) return [];

        const url = `${DIRECTIONS_API_BASE}/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?` +
            new URLSearchParams({
                access_token: MAPBOX_TOKEN,
                geometries: 'geojson',
                steps: 'true',
                overview: 'full',
                alternatives: 'true',
                language: 'es'
            });

        try {
            track('directions');
            const response = await fetch(url);
            const data = await response.json();
            if (!data.routes || data.routes.length === 0) return [];

            return data.routes.map((route: any) => {
                const calculatedDuration = simulateWalkingSpeed ? route.distance / 1.4 : route.duration;
                return {
                    distance: route.distance,
                    duration: calculatedDuration,
                    geometry: route.geometry,
                    steps: route.legs[0].steps.map((step: any) => ({
                        instruction: step.maneuver.instruction || 'Continúa',
                        distance: step.distance,
                        duration: simulateWalkingSpeed ? step.distance / 1.4 : step.duration,
                        name: step.name || '',
                        maneuver: step.maneuver
                    }))
                };
            });
        } catch {
            return [];
        }
    };

    try {
        const profile = PROFILE_MAP[baseMode] || 'walking';
        const isWalking = baseMode === 'walking';

        // 1. Fetch active danger zones
        const { data: dangerZonesData } = isWalking 
            ? await supabase.from('danger_zones').select('*').or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`)
            : { data: [] };
        const dangerZones = dangerZonesData || [];

        // 2. Fetch default Mapbox routes
        let defaultRoutes = await fetchProfile(profile, isWalking);

        if (baseMode === 'cycling') {
            return {
                safe: null,
                balanced: null,
                fast: defaultRoutes[0] || null
            };
        }

        // 3. Three independent strategies to force geometrically different paths.
        //    Perpendicular offsets of 250-400m (0.0023–0.0037°) fit urban block sizes
        //    and are small enough that Mapbox can snap to real streets.
        const dLat = destination.lat - origin.lat;
        const dLng = destination.lng - origin.lng;
        const routeDist = Math.sqrt(dLat * dLat + dLng * dLng);

        // Strategy B (balanced detour): LEFT side at 40% of route, offset ~280m
        // Strategy C (safe detour):     RIGHT side at 60% of route, offset ~370m
        //   + a second waypoint RIGHT at 35% with offset ~250m for more variety
        const waypointPromises: Promise<RouteResult | null>[] = [];

        if (routeDist > 0.0005) {
            const perpLat = -dLng / routeDist;
            const perpLng = dLat / routeDist;

            // 6 candidates: 3 left-side offsets, 3 right-side, at different points along the route.
            // Invalid ones (no road nearby) are filtered by isValidRoute() after fetching.
            const waypoints = [
                // Left side
                { lat: origin.lat + dLat * 0.40 + perpLat * 0.0030, lng: origin.lng + dLng * 0.40 + perpLng * 0.0030 },
                { lat: origin.lat + dLat * 0.60 + perpLat * 0.0040, lng: origin.lng + dLng * 0.60 + perpLng * 0.0040 },
                { lat: origin.lat + dLat * 0.50 + perpLat * 0.0020, lng: origin.lng + dLng * 0.50 + perpLng * 0.0020 },
                // Right side
                { lat: origin.lat + dLat * 0.40 + perpLat * (-0.0030), lng: origin.lng + dLng * 0.40 + perpLng * (-0.0030) },
                { lat: origin.lat + dLat * 0.60 + perpLat * (-0.0040), lng: origin.lng + dLng * 0.60 + perpLng * (-0.0040) },
                { lat: origin.lat + dLat * 0.50 + perpLat * (-0.0020), lng: origin.lng + dLng * 0.50 + perpLng * (-0.0020) },
            ];

            waypoints.forEach(wp => {
                waypointPromises.push(
                    fetchRouteWithWaypoint(origin, wp, destination, profile, isWalking)
                );
            });
        }

        const waypointRoutes = await Promise.all(waypointPromises);
        const allRoutes = [
            ...defaultRoutes,
            ...waypointRoutes.filter(Boolean) as RouteResult[]
        ].filter(r => isValidRoute(r, origin, destination));

        // 4. Three distinct scoring algorithms — one per route type
        const night = isNightTime();

        // Shared helper: raw danger components extracted from a route
        const extractComponents = (route: RouteResult) => {
            const coords = route.geometry?.coordinates || [];

            // A. Danger zone penalty
            let dangerZonePenalty = 0;
            let touchesDangerZone = false;
            dangerZones.forEach((zone: any) => {
                const hit = coords.some((c: any) =>
                    getHaversineDistance(c[1], c[0], zone.lat, zone.lng) < (zone.radius || 100)
                );
                if (hit) {
                    touchesDangerZone = true;
                    const severity = zone.type === 'incident' ? 3.0 : zone.type === 'dark' ? 1.5 : 1.0;
                    const hoursAgo = (Date.now() - new Date(zone.created_at).getTime()) / 3_600_000;
                    const recency = hoursAgo <= 2 ? 2.0 : hoursAgo <= 12 ? 1.5 : hoursAgo > 24 ? 0.5 : 1.0;
                    dangerZonePenalty += severity * recency * 100;
                }
            });

            // B. Street quality score (minutes weighted by street type)
            let streetScore = 0;
            let unnamedMinutes = 0;
            route.steps.forEach(step => {
                const name = step.name.toLowerCase();
                const mins = step.duration / 60;
                const isMainAvenue =
                    name.includes('diagonal') || name.includes('gran via') ||
                    name.includes('aragó') || name.includes('meridiana') ||
                    name.includes('mallorca') || name.includes('valència') ||
                    name.includes('passeig') || name.includes('rambla') ||
                    name.includes('avinguda') || name.includes('avenida') ||
                    name.includes('via') || name.includes('felipe ii');
                const isAlley =
                    name.includes('passatge') || name.includes('carreró') ||
                    name.includes('callejón') || name.includes('alley') ||
                    name.includes('pasaje') || name.includes('camí') ||
                    name.includes('sendero');
                const isUnnamed = name === '' || name === 'sin nombre';

                if (isMainAvenue) streetScore += mins * 0.7;       // safer
                else if (isAlley) streetScore += mins * 2.0;        // dangerous
                else if (isUnnamed) { streetScore += mins * 1.3; unnamedMinutes += mins; }
                else streetScore += mins * 1.0;
            });

            // C. Neighborhood score
            let neighborhoodScore = 0;
            NEIGHBORHOODS.forEach(nb => {
                const hit = coords.some((c: any) =>
                    getHaversineDistance(c[1], c[0], nb.lat, nb.lng) < nb.radius
                );
                if (hit) neighborhoodScore += nb.dangerWeight;
            });

            return { dangerZonePenalty, touchesDangerZone, streetScore, neighborhoodScore, unnamedMinutes };
        };

        // ALGORITHM 1 — FASTEST: pure time, ignore safety entirely
        const scoreFastest = (route: RouteResult): number => {
            return route.duration; // lower = better
        };

        // ALGORITHM 2 — BALANCED: 50% time + 50% safety, moderate zone avoidance
        const scoreBalanced = (route: RouteResult): number => {
            if (!route.geometry) return 99999;
            const { dangerZonePenalty, streetScore, neighborhoodScore } = extractComponents(route);
            const nightMult = night ? 1.3 : 1.0;
            const safetyScore = (streetScore + dangerZonePenalty * nightMult + neighborhoodScore) * 0.5;
            const timeScore = (route.duration / 60) * 0.5;
            return timeScore + safetyScore;
        };

        // ALGORITHM 3 — SAFEST: safety only, hard-exclude active danger zones at night,
        //               penalize unnamed streets heavily, reward main avenues
        const scoreSafest = (route: RouteResult): number => {
            if (!route.geometry) return 99999;
            const { dangerZonePenalty, touchesDangerZone, streetScore, neighborhoodScore, unnamedMinutes } = extractComponents(route);
            const nightMult = night ? 2.5 : 1.0;

            // Hard penalty: touching any active danger zone at night is almost disqualifying
            const dangerPenalty = touchesDangerZone && night
                ? dangerZonePenalty * nightMult * 3
                : dangerZonePenalty * nightMult;

            // Extra penalty for unnamed streets (likely unlit alleys)
            const unnamedPenalty = unnamedMinutes * 8;

            // Time barely matters — only a 10% weight
            const timeScore = (route.duration / 60) * 0.1;

            return timeScore + streetScore + dangerPenalty + neighborhoodScore + unnamedPenalty;
        };

        // Score all candidates with each algorithm
        const withScores = allRoutes.filter(r => r && r.geometry).map(route => ({
            ...route,
            scoreFast: scoreFastest(route),
            scoreBalanced: scoreBalanced(route),
            scoreSafe: scoreSafest(route),
            // dangerScore used by UI for badge count — use balanced algo as reference
            dangerScore: scoreBalanced(route),
            dangerCount: Math.floor(extractComponents(route).dangerZonePenalty / 100),
        }));

        // 5. Deduplicate — two routes are considered the same if >55% of coords overlap.
        //    Lower threshold keeps routes that share some streets but differ enough visually.
        const uniqueRoutes: typeof withScores = [];
        withScores.forEach(candidate => {
            const isDuplicate = uniqueRoutes.some(existing =>
                checkOverlap(existing, candidate, 0.55)
            );
            if (!isDuplicate) uniqueRoutes.push(candidate);
        });

        if (uniqueRoutes.length === 0) return { safe: null, balanced: null, fast: null };

        // Each route type picks the best candidate by its own algorithm.
        // To avoid showing 3 identical paths, we force each type to pick a DIFFERENT
        // candidate where possible (greedy assignment: fast gets first pick, then safe, then balanced).
        const sortedFast     = [...uniqueRoutes].sort((a, b) => a.scoreFast - b.scoreFast);
        const sortedSafe     = [...uniqueRoutes].sort((a, b) => a.scoreSafe - b.scoreSafe);
        const sortedBalanced = [...uniqueRoutes].sort((a, b) => a.scoreBalanced - b.scoreBalanced);

        const fastestRoute = sortedFast[0];

        // Balanced picks second — it needs the "middle" route, not the leftover
        let balancedRoute =
            sortedBalanced.find(r => r !== fastestRoute) ||
            sortedBalanced[0];

        // Safest picks last from whatever remains
        let safestRoute =
            sortedSafe.find(r => r !== fastestRoute && r !== balancedRoute) ||
            sortedSafe.find(r => r !== fastestRoute) ||
            sortedSafe[0];

        // Guarantee logical time ordering: balanced must be between fastest and safest.
        // If balanced ended up slower than safest, swap them.
        if (balancedRoute && safestRoute && balancedRoute.duration > safestRoute.duration) {
            [balancedRoute, safestRoute] = [safestRoute, balancedRoute];
        }

        return {
            fast: fastestRoute,
            balanced: balancedRoute,
            safe: safestRoute,
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
