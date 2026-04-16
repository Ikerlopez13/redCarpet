// Mapbox Geocoding API Service for place autocomplete
// Searches for places and returns suggestions

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GEOCODING_API_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export interface GeocodingResult {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
}

/**
 * Search for places using Mapbox Geocoding API
 * @param query - Search query string
 * @param proximity - Optional coordinates to bias results towards
 */
export async function searchPlaces(
    query: string,
    proximity?: { lat: number; lng: number }
): Promise<GeocodingResult[]> {
    if (!query || query.length < 2) {
        return [];
    }

    const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        autocomplete: 'true',
        fuzzyMatch: 'true',
        language: 'es',
        country: 'es',
        limit: '20',
        types: 'poi,address,neighborhood,locality,place'
    });

    // Use provided proximity or fallback to a broad geographic bias if none provided
    if (proximity) {
        params.append('proximity', `${proximity.lng},${proximity.lat}`);
    } else {
        // Broad bias for Spain if no location available
        params.append('proximity', '2.1734,41.3851');
    }

    const url = `${GEOCODING_API_BASE}/${encodeURIComponent(query)}.json?${params}`;


    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features) {
            return data.features.map((feature: any) => ({
                id: feature.id,
                name: feature.text,
                address: feature.place_name,
                lat: feature.center[1],
                lng: feature.center[0],
                category: feature.properties?.category || getIconFromType(feature.place_type?.[0])
            }));
        }
        return [];
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
}

/**
 * Get an icon name based on place type
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
