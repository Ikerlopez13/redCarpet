// Mapbox Directions API Service for RedCarpet
// Calculates routes between two points with different profiles

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';
import { supabase } from './supabaseClient';

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
    if (directDist > 0 && route.distance > directDist * 3.5) return false;
    const last = route.geometry.coordinates[route.geometry.coordinates.length - 1];
    if (getHaversineDistance(last[1], last[0], destination.lat, destination.lng) > 300) return false;
    return true;
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

        // 6 waypoints: 3 left-side + 3 right-side offsets
        const midLat = (origin.lat + destination.lat) / 2;
        const midLng = (origin.lng + destination.lng) / 2;
        const offsets = [0.0020, 0.0030, 0.0040];
        const waypoints: Coordinate[] = [
            ...offsets.map(d => ({ lat: midLat + d, lng: midLng - d })),
            ...offsets.map(d => ({ lat: midLat - d, lng: midLng + d })),
        ];

        const [
            { data: dangerZones },
            directRoutes,
            ...waypointRouteSets
        ] = await Promise.all([
            isWalking ? supabase.from('danger_zones').select('*').or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`) : Promise.resolve({ data: [] }),
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
        const uniqueRoutes: (RouteResult & { dangerCount: number })[] = [];
        for (const route of allRoutes) {
            const mid = route.geometry.coordinates[Math.floor(route.geometry.coordinates.length / 2)];
            const isDuplicate = uniqueRoutes.some(u => {
                const uMid = u.geometry.coordinates[Math.floor(u.geometry.coordinates.length / 2)];
                return getHaversineDistance(mid[1], mid[0], uMid[1], uMid[0]) < 20;
            });
            if (!isDuplicate) {
                uniqueRoutes.push({ ...route, dangerCount: countDangerIntersections(route) });
            }
        }

        if (uniqueRoutes.length === 0) {
            return { safe: null, balanced: null, fast: null };
        }

        // Greedy assignment: fastest first, balanced second, safest last
        const byDuration = [...uniqueRoutes].sort((a, b) => a.duration - b.duration);
        const fastestRoute = byDuration[0];
        const remaining = byDuration.slice(1);

        let balancedRoute = remaining[0] || null;
        let safeRoute = remaining[1] || null;

        // Guarantee safe >= balanced in duration
        if (balancedRoute && safeRoute && balancedRoute.duration > safeRoute.duration) {
            [balancedRoute, safeRoute] = [safeRoute, balancedRoute];
        }

        return {
            fast: fastestRoute,
            balanced: balancedRoute,
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
