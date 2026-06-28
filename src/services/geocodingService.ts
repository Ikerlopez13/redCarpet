// Mapbox Search Box API Service for premium place autocomplete and POI searching
// Searches for places, addresses, and establishments (such as colleges/universities)

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface GeocodingResult {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
}

// Generate a random session token for Search Box API billing/sessionization
function generateSessionToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Keep a persistent session token that updates per search sequence
let activeSessionToken = generateSessionToken();

// Haversine distance calculation (meters)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Search for places using Mapbox Search Box API (Suggest & Retrieve)
 * Results are sorted by proximity to user location (closest first)
 * @param query - Search query string
 * @param proximity - Optional coordinates to bias results towards (and sort by distance)
 */
export async function searchPlaces(
    query: string,
    proximity?: { lat: number; lng: number }
): Promise<GeocodingResult[]> {
    if (!query || query.trim().length < 2) {
        return [];
    }

    // Refresh session token if a new search interaction starts (2 chars)
    if (query.trim().length === 2) {
        activeSessionToken = generateSessionToken();
    }

    const suggestUrl = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
    suggestUrl.searchParams.append('q', query);
    suggestUrl.searchParams.append('access_token', MAPBOX_TOKEN);
    suggestUrl.searchParams.append('session_token', activeSessionToken);
    suggestUrl.searchParams.append('limit', '10');
    suggestUrl.searchParams.append('language', 'es');
    suggestUrl.searchParams.append('country', 'es');
    // Heavily prioritize POIs (universities, businesses) and addresses to ensure high quality results
    suggestUrl.searchParams.append('types', 'poi,address,place,neighborhood');

    if (proximity) {
        suggestUrl.searchParams.append('proximity', `${proximity.lng},${proximity.lat}`);
    }

    try {
        const response = await fetch(suggestUrl.toString());
        const data = await response.json();

        console.log('🔎 Mapbox Suggest response:', { status: response.status, suggestionsCount: data.suggestions?.length || 0, data });

        if (!data.suggestions || data.suggestions.length === 0) {
            console.warn('⚠️ No suggestions from Mapbox for query:', query);
            return [];
        }

        // Sort suggestions to prioritize exact addresses over POIs
        const sortedSuggestions = data.suggestions.sort((a: any, b: any) => {
            if (a.feature_type === 'address' && b.feature_type !== 'address') return -1;
            if (b.feature_type === 'address' && a.feature_type !== 'address') return 1;
            return 0;
        });

        // Retrieve coordinates for more suggestions (max 10) to allow better distance-based sorting
        const suggestionsToFetch = sortedSuggestions.slice(0, 10);

        const results = await Promise.all(
            suggestionsToFetch.map(async (suggestion: any) => {
                try {
                    const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?access_token=${MAPBOX_TOKEN}&session_token=${activeSessionToken}`;
                    const retrieveResponse = await fetch(retrieveUrl);
                    const retrieveData = await retrieveResponse.json();

                    if (retrieveData.features && retrieveData.features.length > 0) {
                        const feature = retrieveData.features[0];
                        const lat = feature.geometry.coordinates[1];
                        const lng = feature.geometry.coordinates[0];
                        const distance = proximity ? calculateDistance(proximity.lat, proximity.lng, lat, lng) : 0;

                        return {
                            id: suggestion.mapbox_id,
                            name: suggestion.name,
                            address: suggestion.full_address || suggestion.place_formatted,
                            lat,
                            lng,
                            category: suggestion.maki || (suggestion.poi_category_ids ? suggestion.poi_category_ids[0] : 'place'),
                            distance
                        } as GeocodingResult & { distance: number };
                    }
                } catch (err) {
                    console.error(`Error retrieving details for Mapbox ID ${suggestion.mapbox_id}:`, err);
                }
                return null;
            })
        );

        // Filter out failed retrievals and sort by distance (closest first)
        const filtered = results.filter((r): r is (GeocodingResult & { distance: number }) => r !== null);

        if (proximity) {
            // Sort by distance, prioritizing results within 50km
            return filtered
                .filter(r => r.distance <= 50000) // Filter to 50km radius
                .sort((a, b) => a.distance - b.distance)
                .map(({ distance, ...rest }) => rest); // Remove distance field before returning
        }

        return filtered.map(({ distance, ...rest }) => rest);

    } catch (error) {
        console.error('Error searching places with Search Box API:', error);
        return [];
    }
}

/**
 * Get an icon name based on place type (legacy helper)
 */
function getIconFromType(type: string): string {
    switch (type) {
        case 'poi':
            return 'place';
        case 'address':
            return 'home';
        case 'place':
        case 'locality':
            return 'location_city';
        case 'neighborhood':
            return 'holiday_village';
        default:
            return 'location_on';
    }
}

/**
 * Get icon for category
 */
export function getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
        'restaurant': 'restaurant',
        'cafe': 'local_cafe',
        'bar': 'local_bar',
        'pub': 'sports_bar',
        'hotel': 'hotel',
        'shop': 'shopping_bag',
        'store': 'store',
        'mall': 'mall',
        'park': 'park',
        'garden': 'yard',
        'hospital': 'local_hospital',
        'pharmacy': 'local_pharmacy',
        'school': 'school',
        'university': 'school',
        'college': 'account_balance',
        'gym': 'fitness_center',
        'bank': 'account_balance',
        'atm': 'atm',
        'gas_station': 'local_gas_station',
        'parking': 'local_parking',
        'transit': 'directions_transit',
        'bus': 'directions_bus',
        'train': 'directions_railway',
        'subway': 'directions_subway',
        'airport': 'local_airport',
        'museum': 'museum',
        'monument': 'account_balance',
        'landmark': 'castle',
        'attraction': 'local_activity',
        'church': 'church',
        'stadium': 'stadium',
        'theater': 'theater_comedy',
        'movie': 'movie',
        'plaza': 'location_city',
        'place': 'place',
        'home': 'home',
        'location_city': 'location_city',
        'holiday_village': 'holiday_village',
        'location_on': 'location_on'
    };
    return iconMap[category] || 'location_on';
}
