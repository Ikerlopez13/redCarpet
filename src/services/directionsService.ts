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

export async function getAlternativeRoutes(
    origin: Coordinate,
    destination: Coordinate,
    baseMode: string = 'walking'
): Promise<{
    safe: RouteResult | null;
    balanced: RouteResult | null;
    fast: RouteResult | null;
}> {
    const fetchProfile = async (profile: string, simulateWalkingSpeed: boolean = false): Promise<RouteResult[]> => {
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
        
        const [
            { data: dangerZones },
            apiRoutes,
            dbSafeRoute
        ] = await Promise.all([
            isWalking ? supabase.from('danger_zones').select('*').or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`) : Promise.resolve({ data: [] }),
            fetchProfile(profile, false),
            isWalking ? getSafeRouteFromSupabase(origin, destination) : Promise.resolve(null)
        ]);

        const countDangerIntersections = (route: RouteResult | null) => {
            if (!route || !route.geometry || !dangerZones) return 0;
            let intersections = 0;
            const coords = route.geometry.coordinates;
            dangerZones.forEach((zone: any) => {
                const hit = coords.some((c: any) => {
                    const R = 6371e3;
                    const lat1 = c[1] * Math.PI/180;
                    const lat2 = zone.lat * Math.PI/180;
                    const dLat = (zone.lat - c[1]) * Math.PI/180;
                    const dLon = (zone.lng - c[0]) * Math.PI/180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(lat1) * Math.cos(lat2) *
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    const cDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return (R * cDist) < (zone.radius || 100);
                });
                if (hit) intersections++;
            });
            return intersections;
        };

        const uniqueRoutesMap = new Map<number, any>();
        apiRoutes.forEach(r => {
            // Deduplicate by distance (allow a small delta if needed, but Mapbox distance is usually exact)
            if (!uniqueRoutesMap.has(r.distance)) {
                uniqueRoutesMap.set(r.distance, { ...r, dangerCount: countDangerIntersections(r) });
            }
        });
        const uniqueRoutes = Array.from(uniqueRoutesMap.values());
        const sortedRoutes = [...uniqueRoutes].sort((a, b) => a.distance - b.distance);

        const fastestRoute = sortedRoutes[0] || null;
        let balancedRoute = null;
        let safeRoute = null;

        if (isWalking) {
            if (dbSafeRoute) {
                safeRoute = dbSafeRoute;
                safeRoute.dangerCount = countDangerIntersections(safeRoute);
            } else if (sortedRoutes.length > 2) {
                safeRoute = sortedRoutes[sortedRoutes.length - 1];
            } else if (sortedRoutes.length === 2) {
                safeRoute = sortedRoutes[1];
            }

            if (sortedRoutes.length > 2) {
                balancedRoute = sortedRoutes[1]; // Middle route
            }
            
            // Fix references if there are no alternatives
            if (!safeRoute) safeRoute = fastestRoute;
            if (!balancedRoute) balancedRoute = fastestRoute;

            // Nullify duplicates so the UI doesn't render 3 identical cards
            if (balancedRoute && fastestRoute && balancedRoute.distance === fastestRoute.distance) {
                balancedRoute = null;
            }
            if (safeRoute && fastestRoute && safeRoute.distance === fastestRoute.distance) {
                safeRoute = null;
            }
            if (safeRoute && balancedRoute && safeRoute.distance === balancedRoute.distance) {
                safeRoute = null;
            }

            return { fast: fastestRoute as any, balanced: balancedRoute as any, safe: safeRoute as any };
        } else {
            // For bikes, transit, cars: just return the distinct routes Mapbox gives us
            safeRoute = sortedRoutes.length > 2 ? sortedRoutes[2] : null;
            balancedRoute = sortedRoutes.length > 1 ? sortedRoutes[1] : null;
            
            return { fast: fastestRoute as any, balanced: balancedRoute as any, safe: safeRoute as any };
        }
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
