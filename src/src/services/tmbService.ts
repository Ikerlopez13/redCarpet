// TMB Barcelona Transit API Service
// Provides bus stops, metro stations, and line information

const TMB_APP_ID = import.meta.env.VITE_TMB_APP_ID;
const TMB_APP_KEY = import.meta.env.VITE_TMB_APP_KEY;
const TMB_BASE_URL = 'https://api.tmb.cat/v1/transit';

export interface BusStop {
    id: number;
    name: string;
    description: string;
    lat: number;
    lng: number;
    lines?: string[];
}

export interface MetroStation {
    id: string;
    name: string;
    lat: number;
    lng: number;
    lines?: MetroLine[];
}

export interface MetroLine {
    id: number;
    name: string;
    color: string;
}

// Metro line colors (official TMB colors)
const METRO_COLORS: Record<number, string> = {
    1: '#E2001A', // L1 - Roja
    2: '#9B3692', // L2 - Lila
    3: '#3DB54A', // L3 - Verde
    4: '#FAA41A', // L4 - Amarilla
    5: '#007AB4', // L5 - Azul
    9: '#DA6229', // L9 - Naranja
    10: '#00A9E0', // L10 - Azul claro
    11: '#8FC31F', // L11 - Verde claro
};

/**
 * Build URL with TMB auth params
 */
function buildUrl(endpoint: string): string {
    const url = new URL(`${TMB_BASE_URL}/${endpoint}`);
    url.searchParams.append('app_id', TMB_APP_ID);
    url.searchParams.append('app_key', TMB_APP_KEY);
    return url.toString();
}

/**
 * Get all bus stops in Barcelona
 */
export async function getBusStops(): Promise<BusStop[]> {
    try {
        const response = await fetch(buildUrl('parades'));
        const data = await response.json();

        if (data.features) {
            return data.features.map((feature: any) => ({
                id: feature.properties.CODI_PARADA,
                name: feature.properties.NOM_PARADA,
                description: feature.properties.DESC_PARADA || '',
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching bus stops:', error);
        return [];
    }
}

/**
 * Get bus stops near a location
 */
export async function getNearbyBusStops(
    lat: number,
    lng: number,
    radiusMeters: number = 500
): Promise<BusStop[]> {
    const allStops = await getBusStops();

    return allStops.filter(stop => {
        const distance = getDistance(lat, lng, stop.lat, stop.lng);
        return distance <= radiusMeters;
    }).slice(0, 20); // Limit to 20 nearest
}

/**
 * Get all metro stations
 */
export async function getMetroStations(): Promise<MetroStation[]> {
    try {
        const response = await fetch(buildUrl('estacions'));
        const data = await response.json();

        if (data.features) {
            return data.features.map((feature: any) => ({
                id: feature.properties.CODI_GRUP_ESTACIO,
                name: feature.properties.NOM_ESTACIO,
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching metro stations:', error);
        return [];
    }
}

/**
 * Get metro stations near a location
 */
export async function getNearbyMetroStations(
    lat: number,
    lng: number,
    radiusMeters: number = 800
): Promise<MetroStation[]> {
    const allStations = await getMetroStations();

    return allStations.filter(station => {
        const distance = getDistance(lat, lng, station.lat, station.lng);
        return distance <= radiusMeters;
    }).slice(0, 10); // Limit to 10 nearest
}

/**
 * Get metro lines
 */
export async function getMetroLines(): Promise<MetroLine[]> {
    try {
        const response = await fetch(buildUrl('linies/metro'));
        const data = await response.json();

        if (data.features) {
            return data.features.map((feature: any) => ({
                id: feature.properties.CODI_LINIA,
                name: feature.properties.NOM_LINIA,
                color: METRO_COLORS[feature.properties.CODI_LINIA] || '#888888',
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching metro lines:', error);
        return [];
    }
}

/**
 * Get bus lines
 */
export async function getBusLines(): Promise<{ id: number; name: string }[]> {
    try {
        const response = await fetch(buildUrl('linies/bus'));
        const data = await response.json();

        if (data.features) {
            return data.features.map((feature: any) => ({
                id: feature.properties.CODI_LINIA,
                name: feature.properties.NOM_LINIA,
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching bus lines:', error);
        return [];
    }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export { METRO_COLORS };
