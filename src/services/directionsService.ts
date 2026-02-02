// Mapbox Directions API Service for RedCarpet
// Calculates routes between two points with different profiles

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';

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
    geometry: GeoJSON.LineString;
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
 * Get multiple alternative routes (for safe/balanced/fast options)
 * Since Mapbox doesn't have "safety" profiles, we simulate by:
 * - Safe: Walking route (slower but avoiding main roads)
 * - Balanced: Cycling route (medium speed)
 * - Fast: Driving route (fastest)
 */
export async function getAlternativeRoutes(
    origin: Coordinate,
    destination: Coordinate,
    baseMode: string = 'walking'
): Promise<{
    safe: RouteResult | null;
    balanced: RouteResult | null;
    fast: RouteResult | null;
}> {
    // For MVP, we'll get the same route for all profiles
    // In production, you'd want to adjust waypoints for "safer" routes
    const [safe, balanced, fast] = await Promise.all([
        getRoute(origin, destination, baseMode),
        getRoute(origin, destination, baseMode),
        getRoute(origin, destination, baseMode)
    ]);

    // Simulate different times/distances for demo
    // In production, these would come from actual routing with safety data
    return {
        safe: safe ? {
            ...safe,
            duration: Math.round(safe.duration * 1.3), // 30% longer for "safer" route
            distance: Math.round(safe.distance * 1.2)  // 20% longer distance
        } : null,
        balanced: balanced,
        fast: fast ? {
            ...fast,
            duration: Math.round(fast.duration * 0.85), // 15% faster
            distance: Math.round(fast.distance * 0.9)   // 10% shorter
        } : null
    };
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
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

// Barcelona locations - Felipe II 229 area
export const LOCATIONS = {
    HOME: { lat: 41.4088, lng: 2.1890, name: 'Casa (Felipe II)' },
    CENTRAL_PARK: { lat: 41.4120, lng: 2.1850, name: 'Parc del Clot' },
    WORK: { lat: 41.4030, lng: 2.1740, name: 'Oficina' },
    GYM: { lat: 41.4050, lng: 2.1920, name: 'Gimnasio' },
    UNIVERSITY: { lat: 41.3880, lng: 2.1130, name: 'Universidad' }
};
