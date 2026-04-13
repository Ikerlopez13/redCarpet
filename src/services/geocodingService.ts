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
        language: 'es',
        limit: '10',
        types: 'poi,address,place' // Use standard types only
    });

    // Biasing results towards Barcelona landmark center but allowing global search
    params.append('proximity', proximity ? `${proximity.lng},${proximity.lat}` : '2.1734,41.3851');

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
        'hotel': 'hotel',
        'shop': 'shopping_bag',
        'park': 'park',
        'hospital': 'local_hospital',
        'pharmacy': 'local_pharmacy',
        'school': 'school',
        'gym': 'fitness_center',
        'bank': 'account_balance',
        'gas_station': 'local_gas_station',
        'parking': 'local_parking',
        'transit': 'directions_transit',
        'place': 'place',
        'home': 'home',
        'location_city': 'location_city',
        'holiday_village': 'holiday_village',
        'location_on': 'location_on'
    };
    return iconMap[category] || 'location_on';
}
