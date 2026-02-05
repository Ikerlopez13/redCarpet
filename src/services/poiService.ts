// POI Service - Fetch nearby places using Mapbox Geocoding API

export interface POI {
    id: string;
    name: string;
    category: string;
    categoryIcon: string;
    address: string;
    lat: number;
    lng: number;
    distance?: number; // in meters
}

export type POICategory = 'restaurant' | 'cafe' | 'shop' | 'park' | 'hospital' | 'pharmacy' | 'gym' | 'bar' | 'hotel';

const categoryConfig: Record<POICategory, { icon: string; label: string; types: string[] }> = {
    restaurant: { icon: 'restaurant', label: 'Restaurante', types: ['restaurant', 'food'] },
    cafe: { icon: 'local_cafe', label: 'Cafetería', types: ['cafe', 'coffee'] },
    shop: { icon: 'shopping_bag', label: 'Tienda', types: ['shop', 'store', 'supermarket'] },
    park: { icon: 'park', label: 'Parque', types: ['park', 'garden'] },
    hospital: { icon: 'local_hospital', label: 'Hospital', types: ['hospital', 'clinic'] },
    pharmacy: { icon: 'medication', label: 'Farmacia', types: ['pharmacy'] },
    gym: { icon: 'fitness_center', label: 'Gimnasio', types: ['gym', 'fitness'] },
    bar: { icon: 'sports_bar', label: 'Bar', types: ['bar', 'pub'] },
    hotel: { icon: 'hotel', label: 'Hotel', types: ['hotel', 'lodging'] },
};

// Barcelona sample POIs near Felipe II area (for demo - would use API in production)
const samplePOIs: POI[] = [
    {
        id: 'poi-1',
        name: 'La Pepita',
        category: 'restaurant',
        categoryIcon: 'restaurant',
        address: 'Carrer del Clot, 188',
        lat: 41.4095,
        lng: 2.1875,
    },
    {
        id: 'poi-2',
        name: 'Parc del Clot',
        category: 'park',
        categoryIcon: 'park',
        address: 'C/ dels Escultors Claperós',
        lat: 41.4085,
        lng: 2.1920,
    },
    {
        id: 'poi-3',
        name: 'Mercadona',
        category: 'shop',
        categoryIcon: 'shopping_bag',
        address: 'C/ de Rogent, 102',
        lat: 41.4070,
        lng: 2.1860,
    },
    {
        id: 'poi-4',
        name: 'Farmacia Clot',
        category: 'pharmacy',
        categoryIcon: 'medication',
        address: 'Plaça del Clot, 5',
        lat: 41.4100,
        lng: 2.1900,
    },
    {
        id: 'poi-5',
        name: 'CAP Clot',
        category: 'hospital',
        categoryIcon: 'local_hospital',
        address: 'Av. Meridiana, 428',
        lat: 41.4115,
        lng: 2.1880,
    },
    {
        id: 'poi-6',
        name: 'Cafè del Bon Pastor',
        category: 'cafe',
        categoryIcon: 'local_cafe',
        address: 'C/ del Clot, 142',
        lat: 41.4078,
        lng: 2.1892,
    },
    {
        id: 'poi-7',
        name: 'Holmes Place Clot',
        category: 'gym',
        categoryIcon: 'fitness_center',
        address: 'Gran Via de les Corts, 671',
        lat: 41.4055,
        lng: 2.1905,
    },
    {
        id: 'poi-8',
        name: 'Hotel Catalonia Clot',
        category: 'hotel',
        categoryIcon: 'hotel',
        address: 'C/ de Mallorca, 585',
        lat: 41.4050,
        lng: 2.1870,
    },
];

/**
 * Get nearby POIs (using sample data for demo)
 * In production, this would call Mapbox Places API
 */
export async function getNearbyPOIs(
    lat: number,
    lng: number,
    radiusMeters: number = 500,
    category?: POICategory
): Promise<POI[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Calculate distance for each POI
    const poisWithDistance = samplePOIs.map(poi => ({
        ...poi,
        distance: calculateDistance(lat, lng, poi.lat, poi.lng),
    }));

    // Filter by radius and optionally by category
    let filtered = poisWithDistance.filter(poi => poi.distance <= radiusMeters);

    if (category) {
        filtered = filtered.filter(poi => poi.category === category);
    }

    // Sort by distance
    return filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/**
 * Search POIs by query text
 */
export async function searchPOIs(query: string, lat: number, lng: number): Promise<POI[]> {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();

    const poisWithDistance = samplePOIs
        .filter(poi =>
            poi.name.toLowerCase().includes(lowerQuery) ||
            poi.address.toLowerCase().includes(lowerQuery) ||
            poi.category.toLowerCase().includes(lowerQuery)
        )
        .map(poi => ({
            ...poi,
            distance: calculateDistance(lat, lng, poi.lat, poi.lng),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return poisWithDistance;
}

/**
 * Get POI categories with icons
 */
export function getPOICategories(): { id: POICategory; icon: string; label: string }[] {
    return Object.entries(categoryConfig).map(([id, config]) => ({
        id: id as POICategory,
        icon: config.icon,
        label: config.label,
    }));
}

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format distance for display
 */
export function formatPOIDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}
