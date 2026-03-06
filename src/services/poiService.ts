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

// Deterministic pseudo-random number generator
function pseudoRandom(seed: number) {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// Generate a deterministic ID based on grid coordinates
function generateId(latGrid: number, lngGrid: number, index: number): string {
    return `poi_${latGrid}_${lngGrid}_${index}`;
}

const CATEGORIES: POICategory[] = ['restaurant', 'cafe', 'shop', 'park', 'hospital', 'pharmacy', 'gym', 'bar', 'hotel'];
const NAMES_PREFIX = ['Gran', 'Royal', 'City', 'Blue', 'Red', 'Golden', 'Silver', 'Central', 'Urban', 'Local'];
const NAMES_SUFFIX = ['Place', 'Spot', 'Corner', 'Hub', 'Point', 'Center', 'Station', 'Lounge', 'Garden', 'Market'];

/**
 * Get nearby POIs (Procedurally generated for infinite map coverage)
 */
export async function getNearbyPOIs(
    lat: number,
    lng: number,
    radiusMeters: number = 800,
    category?: POICategory
): Promise<POI[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const pois: POI[] = [];

    // Grid size roughly 200 meters (0.002 degrees approx)
    const gridSize = 0.002;
    const searchRadiusGrid = Math.ceil((radiusMeters / 111000) / gridSize) + 1;

    const centerLatGrid = Math.floor(lat / gridSize);
    const centerLngGrid = Math.floor(lng / gridSize);

    for (let x = -searchRadiusGrid; x <= searchRadiusGrid; x++) {
        for (let y = -searchRadiusGrid; y <= searchRadiusGrid; y++) {
            const currentLatGrid = centerLatGrid + x;
            const currentLngGrid = centerLngGrid + y;

            // Seed based on grid coordinates to be deterministic
            // We mix the bits to avoid patterns
            const seed = (currentLatGrid * 13371337) ^ (currentLngGrid * 73317331);

            // Should this grid cell have a POI? (70% chance)
            if (pseudoRandom(seed) > 0.3) {
                // Determine number of POIs in this cell (0-2)
                const numPOIs = Math.floor(pseudoRandom(seed + 1) * 3);

                for (let i = 0; i < numPOIs; i++) {
                    const poiSeed = seed + (i + 1) * 1000;

                    // Generate position within the cell
                    const latOffset = pseudoRandom(poiSeed) * gridSize;
                    const lngOffset = pseudoRandom(poiSeed + 1) * gridSize;

                    const poiLat = (currentLatGrid * gridSize) + latOffset;
                    const poiLng = (currentLngGrid * gridSize) + lngOffset;

                    // Filter by actual distance radius
                    const distance = calculateDistance(lat, lng, poiLat, poiLng);
                    if (distance > radiusMeters) continue;

                    // Generate random category
                    const catIndex = Math.floor(pseudoRandom(poiSeed + 2) * CATEGORIES.length);
                    const poiCategory = CATEGORIES[catIndex];

                    if (category && poiCategory !== category) continue;

                    // Generate Name
                    const prefix = NAMES_PREFIX[Math.floor(pseudoRandom(poiSeed + 3) * NAMES_PREFIX.length)];
                    const suffix = NAMES_SUFFIX[Math.floor(pseudoRandom(poiSeed + 4) * NAMES_SUFFIX.length)];
                    const label = categoryConfig[poiCategory].label;
                    const name = `${prefix} ${label} ${suffix}`;

                    pois.push({
                        id: generateId(currentLatGrid, currentLngGrid, i),
                        name: name,
                        category: poiCategory,
                        categoryIcon: categoryConfig[poiCategory].icon,
                        address: `${label} Street, ${Math.floor(pseudoRandom(poiSeed + 5) * 100)}`,
                        lat: poiLat,
                        lng: poiLng,
                        distance
                    });
                }
            }
        }
    }

    return pois.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/**
 * Search POIs by query text
 */
/**
 * Search POIs by query text
 */
export async function searchPOIs(query: string, lat: number, lng: number): Promise<POI[]> {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();

    // Generate POIs in a wider area for search
    const nearbyPOIs = await getNearbyPOIs(lat, lng, 2000);

    const filtered = nearbyPOIs
        .filter(poi =>
            poi.name.toLowerCase().includes(lowerQuery) ||
            poi.address.toLowerCase().includes(lowerQuery) ||
            poi.category.toLowerCase().includes(lowerQuery)
        )
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return filtered;
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
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
