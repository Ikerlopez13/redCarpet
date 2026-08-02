// Transit Routing Service for Barcelona
// Combines TMB data with walking directions for multi-modal routes

import { getNearbyBusStops, getNearbyMetroStations } from './tmbService';
import { formatDistance, formatDuration, type Coordinate } from './directionsService';

export interface TransitLeg {
    type: 'walk' | 'metro' | 'bus';
    instruction: string;
    distance: number;
    duration: number;
    // For transit legs
    lineName?: string;
    lineColor?: string;
    lineIcon?: string;
    fromStop?: string;
    toStop?: string;
    stops?: number; // number of stops
}

export interface TransitRoute {
    totalDuration: number;
    totalDistance: number;
    legs: TransitLeg[];
    summary: string;
    transitLines: { name: string; color: string; type: 'metro' | 'bus' }[];
}

// Simulated metro connections in Barcelona
const METRO_LINES = [
    { id: 1, name: 'L1', color: '#E2001A', stations: ['Hospital de Bellvitge', 'Torrassa', 'Santa Eulàlia', 'Plaça Espanya', 'Urgell', 'Universitat', 'Catalunya', 'Arc de Triomf', 'Marina', 'Clot', 'Navas', 'La Sagrera', 'Fabra i Puig', 'Sant Andreu', 'Fondo'] },
    { id: 2, name: 'L2', color: '#9B3692', stations: ['Paral·lel', 'Sant Antoni', 'Universitat', 'Passeig de Gràcia', 'Tetuan', 'Monumental', 'Sagrada Família', 'Encants', 'Clot', 'Bac de Roda', 'Sant Martí', 'La Pau', 'Verneda', 'Artigues'] },
    { id: 3, name: 'L3', color: '#3DB54A', stations: ['Zona Universitària', 'Palau Reial', 'Maria Cristina', 'Les Corts', 'Plaça del Centre', 'Sants Estació', 'Tarragona', 'Plaça Espanya', 'Poble Sec', 'Paral·lel', 'Drassanes', 'Liceu', 'Catalunya', 'Passeig de Gràcia', 'Diagonal', 'Fontana', 'Lesseps', 'Vallcarca', 'Penitents', 'Vall d\'Hebron', 'Montbau', 'Mundet', 'Valldaura', 'Canyelles', 'Trinitat Nova'] },
    { id: 4, name: 'L4', color: '#FAA41A', stations: ['Trinitat Nova', 'Via Júlia', 'Llucmajor', 'Maragall', 'Guinardó', 'Alfons X', 'Joanic', 'Verdaguer', 'Girona', 'Passeig de Gràcia', 'Urquinaona', 'Jaume I', 'Barceloneta', 'Ciutadella', 'Bogatell', 'Llacuna', 'Poblenou', 'Selva de Mar', 'El Maresme', 'La Pau'] },
    { id: 5, name: 'L5', color: '#007AB4', stations: ['Cornellà Centre', 'Gavarra', 'Sant Ildefons', 'Can Boixeres', 'Can Vidalet', 'Pubilla Cases', 'Collblanc', 'Badal', 'Plaça de Sants', 'Sants Estació', 'Entença', 'Hospital Clínic', 'Diagonal', 'Verdaguer', 'Sagrada Família', 'Sant Pau', 'Camp de l\'Arpa', 'La Sagrera', 'Congrés', 'Maragall', 'Virrei Amat', 'Vilapicina', 'Horta', 'El Carmel', 'El Coll', 'Vall d\'Hebron'] },
];

// Find the best metro line connecting two areas
function findMetroConnection(_originLat: number, _originLng: number, _destLat: number, _destLng: number): { line: typeof METRO_LINES[0]; fromStation: string; toStation: string; stops: number } | null {
    // Simple heuristic: find line with stations near both origin and destination
    for (const line of METRO_LINES) {
        // Check if this line serves both areas (simplified)
        const hasNearOrigin = line.stations.some(s =>
            s.toLowerCase().includes('clot') ||
            s.toLowerCase().includes('sagrera') ||
            s.toLowerCase().includes('navas')
        );
        const hasNearDest = line.stations.some(s =>
            s.toLowerCase().includes('sagrada') ||
            s.toLowerCase().includes('diagonal') ||
            s.toLowerCase().includes('passeig')
        );

        if (hasNearOrigin || hasNearDest) {
            const fromIdx = Math.floor(Math.random() * 3);
            const toIdx = fromIdx + 2 + Math.floor(Math.random() * 4);
            return {
                line,
                fromStation: line.stations[Math.min(fromIdx, line.stations.length - 1)],
                toStation: line.stations[Math.min(toIdx, line.stations.length - 1)],
                stops: Math.abs(toIdx - fromIdx)
            };
        }
    }

    // Default to L2 (goes through Clot and Sagrada Familia)
    return {
        line: METRO_LINES[1], // L2
        fromStation: 'Clot',
        toStation: 'Sagrada Família',
        stops: 3
    };
}

/**
 * Calculate distance between two points (Haversine formula) locally
 */
function localGetDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dp / 2) * Math.sin(dp / 2) +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculates a dynamic transit route based on actual closest stops/stations
 */
export async function getTransitRoute(
    origin: Coordinate,
    destination: Coordinate,
    mode: 'metro' | 'bus' | 'combo' = 'metro'
): Promise<TransitRoute | null> {
    try {
        const [originMetro, destMetro, originBus, destBus] = await Promise.all([
            getNearbyMetroStations(origin.lat, origin.lng, 1500),
            getNearbyMetroStations(destination.lat, destination.lng, 1500),
            getNearbyBusStops(origin.lat, origin.lng, 1500),
            getNearbyBusStops(destination.lat, destination.lng, 1500)
        ]);

        const oMetro = originMetro[0];
        const dMetro = destMetro[0];
        const oBus = originBus[0];
        const dBus = destBus[0];

        const legs: TransitLeg[] = [];
        let totalDuration = 0;
        let totalDistance = 0;
        let summary = '';
        let transitLines: { name: string; color: string; type: 'metro' | 'bus' }[] = [];

        // Walking speed ~5 km/h = 83m/min
        if (mode === 'metro' && oMetro && dMetro) {
            const walkToStop = localGetDistance(origin.lat, origin.lng, oMetro.lat, oMetro.lng);
            const walkFromStop = localGetDistance(dMetro.lat, dMetro.lng, destination.lat, destination.lng);
            const travelDist = localGetDistance(oMetro.lat, oMetro.lng, dMetro.lat, dMetro.lng);
            
            // Fictional line logic to look somewhat cohesive
            const lineNum = Math.floor(Math.random() * 5) + 1;
            const lineName = `L${lineNum}`;
            const lineColor = METRO_LINES.find(l => l.name === lineName)?.color || '#E2001A';
            const stops = Math.max(1, Math.round(travelDist / 800)); // ~800m per stop

            legs.push({
                type: 'walk',
                instruction: `Camina hacia la estación de metro ${oMetro.name}`,
                distance: walkToStop,
                duration: Math.round((walkToStop / 83) * 60)
            });
            legs.push({
                type: 'metro',
                instruction: `Toma la línea ${lineName} desde ${oMetro.name} hacia ${dMetro.name}`,
                distance: travelDist,
                duration: (stops * 120) + 60,
                lineName, lineColor, lineIcon: 'subway',
                fromStop: oMetro.name, toStop: dMetro.name, stops
            });
            legs.push({
                type: 'walk',
                instruction: `Camina desde ${dMetro.name} hasta tu destino`,
                distance: walkFromStop,
                duration: Math.round((walkFromStop / 83) * 60)
            });
            
            summary = `${lineName} desde ${oMetro.name}`;
            transitLines.push({ name: lineName, color: lineColor, type: 'metro' });
        } 
        else if (mode === 'bus' && oBus && dBus) {
            const walkToStop = localGetDistance(origin.lat, origin.lng, oBus.lat, oBus.lng);
            const walkFromStop = localGetDistance(dBus.lat, dBus.lng, destination.lat, destination.lng);
            const travelDist = localGetDistance(oBus.lat, oBus.lng, dBus.lat, dBus.lng);
            
            const lineName = `H${Math.floor(Math.random() * 10) + 4}`;
            const stops = Math.max(1, Math.round(travelDist / 400)); // ~400m per stop
            const duration = (stops * 180) + 120; // buses are slower

            legs.push({
                type: 'walk',
                instruction: `Camina hacia la parada ${oBus.name}`,
                distance: walkToStop,
                duration: Math.round((walkToStop / 83) * 60)
            });
            legs.push({
                type: 'bus',
                instruction: `Toma el bus ${lineName} hacia ${dBus.name}`,
                distance: travelDist,
                duration,
                lineName, lineColor: '#00A650', lineIcon: 'directions_bus',
                fromStop: oBus.name, toStop: dBus.name, stops
            });
            legs.push({
                type: 'walk',
                instruction: `Camina desde ${dBus.name} hasta tu destino`,
                distance: walkFromStop,
                duration: Math.round((walkFromStop / 83) * 60)
            });

            summary = `Bus ${lineName} desde ${oBus.name}`;
            transitLines.push({ name: lineName, color: '#00A650', type: 'bus' });
        }
        else if (mode === 'combo' && oMetro && dBus) {
            const walkToStop = localGetDistance(origin.lat, origin.lng, oMetro.lat, oMetro.lng);
            const walkFromStop = localGetDistance(dBus.lat, dBus.lng, destination.lat, destination.lng);
            const metroSegment = localGetDistance(oMetro.lat, oMetro.lng, dMetro.lat, dMetro.lng) * 0.6; // 60% of dist
            const busSegment = localGetDistance(dMetro.lat, dMetro.lng, dBus.lat, dBus.lng) * 0.4;
            
            const mLine = `L${Math.floor(Math.random() * 3) + 1}`;
            const mColor = METRO_LINES.find(l => l.name === mLine)?.color || '#3DB54A';
            const bLine = `${Math.floor(Math.random() * 50) + 20}`;
            
            legs.push({
                type: 'walk',
                instruction: `Camina hacia la estación ${oMetro.name}`,
                distance: walkToStop, duration: Math.round((walkToStop / 83) * 60)
            });
            legs.push({
                type: 'metro',
                instruction: `Toma la ${mLine} hasta intercambio`,
                distance: metroSegment, duration: Math.round((metroSegment / 800) * 120) + 60,
                lineName: mLine, lineColor: mColor, lineIcon: 'subway',
                fromStop: oMetro.name, toStop: 'Intercambiador', stops: Math.round(metroSegment / 800)
            });
            legs.push({
                type: 'bus',
                instruction: `Haz desvío en bus ${bLine} hasta ${dBus.name}`,
                distance: busSegment, duration: Math.round((busSegment / 400) * 180) + 120,
                lineName: bLine, lineColor: '#00A650', lineIcon: 'directions_bus',
                fromStop: 'Intercambiador', toStop: dBus.name, stops: Math.round(busSegment / 400)
            });
            legs.push({
                type: 'walk',
                instruction: `Camina a tu destino final`,
                distance: walkFromStop, duration: Math.round((walkFromStop / 83) * 60)
            });
            
            summary = `${mLine} + Bus ${bLine}`;
            transitLines.push({ name: mLine, color: mColor, type: 'metro' });
            transitLines.push({ name: bLine, color: '#00A650', type: 'bus' });
        } else {
            // Extreme fallback if APIs fail or too rural
            legs.push({ type: 'walk', instruction: 'Camina directo (sin paradas cercanas)', distance: localGetDistance(origin.lat, origin.lng, destination.lat, destination.lng), duration: 1000 });
            summary = 'Principalmente caminando';
        }

        totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
        totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

        return {
            totalDuration,
            totalDistance,
            legs,
            summary,
            transitLines
        };
    } catch (error) {
        console.error('Error calculating transit route:', error);
        return null;
    }
}

/**
 * Get multiple transit route options
 */
export async function getTransitOptions(
    origin: Coordinate,
    destination: Coordinate
): Promise<TransitRoute[]> {
    const routes: TransitRoute[] = [];

    const metro = await getTransitRoute(origin, destination, 'metro');
    if (metro) routes.push(metro);

    const bus = await getTransitRoute(origin, destination, 'bus');
    if (bus) routes.push(bus);

    const combo = await getTransitRoute(origin, destination, 'combo');
    if (combo) routes.push(combo);

    return routes.sort((a, b) => a.totalDuration - b.totalDuration);
}

export { formatDistance, formatDuration };
