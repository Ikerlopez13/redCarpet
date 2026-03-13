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

export type POICategoryExtended = POICategory | 'landmark' | 'monument' | 'museum' | 'attraction';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Get nearby POIs using Mapbox Geocoding API
 * Includes landmarks and monuments for better map richness
 */
export async function getNearbyPOIs(
    lat: number,
    lng: number,
    radiusMeters: number = 2000,
    category?: POICategory
): Promise<POI[]> {
    if (!MAPBOX_TOKEN) {
        console.warn('Mapbox token not found, falling back to empty POIs');
        return [];
    }

    try {
        // Broad search for POIs and landmarks
        const queries = category
            ? [categoryConfig[category].types[0]]
            : ['landmark', 'monument', 'museum', 'tourist_attraction', 'restaurant', 'park', 'cafe', 'poi'];

        // We'll combine multiple queries to ensure landmark richness
        const responses = await Promise.all(queries.slice(0, 3).map(q =>
            fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?` +
                `proximity=${lng},${lat}&` +
                `types=poi&` +
                `access_token=${MAPBOX_TOKEN}&` +
                `limit=15`
            ).then(r => r.json())
        ));

        const allFeatures = responses.flatMap(r => r.features || []);

        // Deduplicate features by ID
        const uniqueFeatures = Array.from(new Map(allFeatures.map(f => [f.id, f])).values());

        const pois: POI[] = uniqueFeatures.map((f: any) => {
            const [poiLng, poiLat] = f.center;
            const distance = calculateDistance(lat, lng, poiLat, poiLng);

            // Extract category info from Mapbox properties
            const mbtypes = (f.properties?.category || '').toLowerCase();
            const mbtext = (f.text || '').toLowerCase();

            let poiCategory: POICategory = 'shop'; // default

            if (mbtypes.includes('restaurant') || mbtypes.includes('food')) poiCategory = 'restaurant';
            else if (mbtypes.includes('cafe') || mbtext.includes('café') || mbtypes.includes('coffee')) poiCategory = 'cafe';
            else if (mbtypes.includes('park') || mbtypes.includes('garden')) poiCategory = 'park';
            else if (mbtypes.includes('hospital') || mbtypes.includes('medical')) poiCategory = 'hospital';
            else if (mbtypes.includes('pharmacy')) poiCategory = 'pharmacy';
            else if (mbtypes.includes('gym') || mbtypes.includes('fitness')) poiCategory = 'gym';
            else if (mbtypes.includes('bar') || mbtypes.includes('pub')) poiCategory = 'bar';
            else if (mbtypes.includes('hotel') || mbtypes.includes('lodging')) poiCategory = 'hotel';

            // Special handling for landmarks (High priority icons)
            let iconOverride = categoryConfig[poiCategory].icon;
            if (mbtypes.includes('landmark') || mbtypes.includes('monument') || mbtypes.includes('museum') || mbtypes.includes('attraction')) {
                iconOverride = 'account_balance'; // Monument/History icon
                if (mbtypes.includes('museum')) iconOverride = 'museum';
                if (mbtypes.includes('attraction')) iconOverride = 'local_activity';
            }

            return {
                id: f.id,
                name: f.text_es || f.text || 'Lugar desconocido',
                category: poiCategory,
                categoryIcon: iconOverride,
                address: f.properties?.address || f.place_name?.split(',')[0] || 'Dirección no disponible',
                lat: poiLat,
                lng: poiLng,
                distance
            };
        });

        // Filter and sort by distance
        return pois
            .filter(p => p.distance! <= radiusMeters)
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    } catch (e) {
        console.error('Error fetching nearby POIs:', e);
        return [];
    }
}

/**
 * Search POIs by query text using Mapbox Geocoding API
 */
export async function searchPOIs(query: string, lat: number, lng: number): Promise<POI[]> {
    if (!query.trim() || !MAPBOX_TOKEN) return [];

    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
            `proximity=${lng},${lat}&` +
            `types=poi,address,place&` +
            `access_token=${MAPBOX_TOKEN}&` +
            `limit=10`
        );

        if (!response.ok) throw new Error('Mapbox search error');

        const data = await response.json();
        if (!data.features) return [];

        return data.features.map((f: any) => {
            const [poiLng, poiLat] = f.center;
            const distance = calculateDistance(lat, lng, poiLat, poiLng);

            // Basic category inference for search results
            const mbtypes = f.properties?.category || '';
            let poiCategory: POICategory = 'shop';
            if (mbtypes.includes('restaurant')) poiCategory = 'restaurant';
            else if (mbtypes.includes('cafe')) poiCategory = 'cafe';

            return {
                id: f.id,
                name: f.text_es || f.text,
                category: poiCategory,
                categoryIcon: categoryConfig[poiCategory].icon,
                address: f.place_name?.split(',')[0] || f.place_name,
                lat: poiLat,
                lng: poiLng,
                distance
            };
        });
    } catch (e) {
        console.error('Error searching POIs:', e);
        return [];
    }
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
