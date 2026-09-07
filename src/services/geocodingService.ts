// Mapbox Search Box API Service for premium place autocomplete and POI searching
// Searches for places, addresses, and establishments (such as colleges/universities)

import { isBlocked, track } from './mapboxBudget';
import { allow, sanitizeQuery } from './rateLimiter';
import { supabase } from './supabaseClient';

export interface GeocodingResult {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
    isBusiness?: boolean; // negocio destacado de RedCarpet (aparece primero)
}

/**
 * Busca negocios destacados de RedCarpet (nuestra BD) que coincidan con la
 * query. Es GRATIS (no consume Mapbox) y da a los negocios que han pagado
 * visibilidad prioritaria en el buscador, como un directorio propio.
 */
async function searchBusinesses(query: string): Promise<GeocodingResult[]> {
    try {
        const { data } = await supabase
            .from('business_listings')
            .select('id, name, description, category, address, lat, lng')
            .eq('is_active', true)
            .ilike('name', `%${query}%`)
            .limit(5);
        return (data ?? []).map((b: any) => ({
            id: `biz-${b.id}`,
            name: b.name,
            address: b.address || b.description || 'Negocio destacado',
            lat: b.lat,
            lng: b.lng,
            category: b.category || 'business',
            isBusiness: true,
        }));
    } catch {
        return [];
    }
}

// Distancia en metros entre dos coordenadas (Haversine) — para ordenar por cercanía.
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371e3;
    const p1 = (aLat * Math.PI) / 180;
    const p2 = (bLat * Math.PI) / 180;
    const dPhi = ((bLat - aLat) * Math.PI) / 180;
    const dLambda = ((bLng - aLng) * Math.PI) / 180;
    const x =
        Math.sin(dPhi / 2) ** 2 +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Última ubicación conocida del usuario. Se actualiza cada vez que un llamador
// pasa proximity y sirve de fallback cuando alguno no la tiene lista todavía
// (evita el sesgo nacional a Barcelona cuando el GPS llega tarde).
let _lastProximity: { lat: number; lng: number } | null = null;

/** Intenta obtener la posición actual del dispositivo (nativo o navegador). */
async function resolveProximity(
    proximity?: { lat: number; lng: number }
): Promise<{ lat: number; lng: number } | undefined> {
    if (proximity && proximity.lat && proximity.lng) {
        _lastProximity = proximity;
        return proximity;
    }
    // Fallback 1: última conocida en esta sesión
    if (_lastProximity) return _lastProximity;
    // Fallback 2: pedir la posición actual (con timeout corto para no bloquear la UI)
    try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 });
        _lastProximity = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        return _lastProximity;
    } catch {
        return undefined;
    }
}

/**
 * Search for places using Mapbox Search Box FORWARD API.
 *
 * Un solo request que devuelve POIs (cadenas como Mercadona/Aldi), calles y
 * direcciones YA con coordenadas, para poder ordenar por distancia real al
 * usuario. Reemplaza el flujo suggest+retrieve (9 llamadas) por 1 sola,
 * elimina el token de sesión (fuente de estados atascados) y aplica siempre
 * bias geográfico.
 *
 * @param query - Search query string
 * @param proximity - Coordenadas del usuario para priorizar por cercanía
 */
// Caché de deduplicación: evita repetir una búsqueda facturable idéntica
// (autocompletar que rebota, borrar y reescribir lo mismo, remontar la vista).
// Search Box solo da 500 sesiones gratis/mes, así que cada llamada cuenta.
const _searchCache = new Map<string, { results: GeocodingResult[]; expiresAt: number }>();
const SEARCH_TTL_MS = 60 * 1000;

export async function searchPlaces(
    query: string,
    proximity?: { lat: number; lng: number }
): Promise<GeocodingResult[]> {
    const clean = sanitizeQuery(query);
    // Mínimo 3 caracteres: menos ruido, menos llamadas facturables.
    if (!clean || clean.length < 3) {
        return [];
    }

    // Dedupe: misma query + misma zona (~1km) → resultados cacheados, sin llamada.
    const cacheKey = `${clean.toLowerCase()}|${proximity ? `${proximity.lat.toFixed(2)},${proximity.lng.toFixed(2)}` : 'no'}`;
    const cached = _searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.results;
    }

    // Negocios destacados de RedCarpet (gratis, nuestra BD) — se lanzan siempre,
    // aunque Mapbox esté bloqueado por presupuesto/rate.
    const businessesPromise = searchBusinesses(clean);

    // Budget + rate guard SOLO para Mapbox. Si está bloqueado, devolvemos al
    // menos los negocios (no consumen Mapbox).
    if (isBlocked() || !allow('searchbox', 40)) {
        return await businessesPromise;
    }

    // Garantizar bias geográfico SIEMPRE: si el llamador no trae ubicación,
    // usamos la última conocida o pedimos la posición actual.
    const prox = await resolveProximity(proximity);

    // Llamada al PROXY autenticado (Edge Function). El token de Mapbox vive
    // server-side y el rate limit / corte de presupuesto se aplican en backend.
    // 1 request con 1 reintento ante fallo de red transitorio.
    let data: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { data: resp, error } = await supabase.functions.invoke('mapbox-search', {
                body: {
                    q: clean,
                    language: 'es',
                    proximity: prox ? `${prox.lng},${prox.lat}` : '',
                },
            });
            if (error) throw error;
            // El backend nos frenó (rate limit / presupuesto): devolvemos negocios.
            if (resp?.error === 'rate_limited' || resp?.error === 'budget_blocked') {
                return await businessesPromise;
            }
            data = resp;
            break;
        } catch (error) {
            if (attempt === 1) {
                console.error('Error searching places (proxy, tras reintento):', error);
                return await businessesPromise; // al menos los negocios
            }
        }
    }

    track('searchbox');

    const features: any[] = data?.features ?? [];
    if (features.length === 0) return await businessesPromise;

    const results: GeocodingResult[] = features
        .filter((f) => f?.geometry?.coordinates?.length === 2)
        .map((f) => {
            const p = f.properties ?? {};
            const [lng, lat] = f.geometry.coordinates;
            return {
                id: p.mapbox_id || `${lat},${lng}`,
                name: p.name || p.place_formatted || 'Lugar',
                address: p.full_address || p.place_formatted || '',
                lat,
                lng,
                category:
                    p.maki ||
                    (p.poi_category_ids ? p.poi_category_ids[0] : p.feature_type || 'place'),
            } as GeocodingResult;
        });

    // Ordenar por distancia real al usuario. Mantenemos el orden de relevancia
    // de la API como criterio de desempate cuando no hay ubicación.
    if (prox) {
        results.sort(
            (a, b) =>
                haversine(prox.lat, prox.lng, a.lat, a.lng) -
                haversine(prox.lat, prox.lng, b.lat, b.lng)
        );
    }

    // Negocios destacados PRIMERO (han pagado visibilidad). Solo descartamos de
    // Mapbox el resultado que sea EL MISMO local (mismo nombre + a <60 m), no
    // todos los de la cadena: si buscas "mercadona" y hay uno destacado, deben
    // seguir apareciendo el resto de Mercadonas cercanos.
    const businesses = await businessesPromise;
    const isSamePlace = (r: GeocodingResult) =>
        businesses.some(
            b =>
                b.name.toLowerCase() === r.name.toLowerCase() &&
                haversine(b.lat, b.lng, r.lat, r.lng) < 60
        );
    const merged = [
        ...businesses,
        ...results.filter(r => !isSamePlace(r)),
    ];

    _searchCache.set(cacheKey, { results: merged, expiresAt: Date.now() + SEARCH_TTL_MS });
    return merged;
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
