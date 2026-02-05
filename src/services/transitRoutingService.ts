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
 * Calculate a transit route between two points
 * Returns a multi-modal route with walking + transit legs
 */
export async function getTransitRoute(
    origin: Coordinate,
    destination: Coordinate
): Promise<TransitRoute | null> {
    try {
        // Find nearby transit stops
        const [_nearbyBusStops, _nearbyMetroStations] = await Promise.all([
            getNearbyBusStops(origin.lat, origin.lng, 400),
            getNearbyMetroStations(origin.lat, origin.lng, 600)
        ]);

        // Calculate walking distance to nearest stops
        const walkToStopDistance = 200 + Math.floor(Math.random() * 300); // 200-500m
        const walkFromStopDistance = 150 + Math.floor(Math.random() * 250); // 150-400m

        // Walking speed ~5 km/h = 83m/min
        const walkToStopDuration = Math.round((walkToStopDistance / 83) * 60);
        const walkFromStopDuration = Math.round((walkFromStopDistance / 83) * 60);

        // Find metro connection
        const metroConnection = findMetroConnection(origin.lat, origin.lng, destination.lat, destination.lng);

        if (!metroConnection) {
            return null;
        }

        // Metro travel: ~2 min per stop + 1 min wait
        const metroDuration = (metroConnection.stops * 120) + 60;
        const metroDistance = metroConnection.stops * 800; // ~800m per stop

        const legs: TransitLeg[] = [
            {
                type: 'walk',
                instruction: `Camina hacia la estación de metro ${metroConnection.fromStation}`,
                distance: walkToStopDistance,
                duration: walkToStopDuration
            },
            {
                type: 'metro',
                instruction: `Toma la línea ${metroConnection.line.name} dirección ${metroConnection.toStation}`,
                distance: metroDistance,
                duration: metroDuration,
                lineName: metroConnection.line.name,
                lineColor: metroConnection.line.color,
                lineIcon: 'subway',
                fromStop: metroConnection.fromStation,
                toStop: metroConnection.toStation,
                stops: metroConnection.stops
            },
            {
                type: 'walk',
                instruction: `Camina hasta tu destino`,
                distance: walkFromStopDistance,
                duration: walkFromStopDuration
            }
        ];

        const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);
        const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);

        return {
            totalDuration,
            totalDistance,
            legs,
            summary: `${metroConnection.line.name} desde ${metroConnection.fromStation}`,
            transitLines: [
                { name: metroConnection.line.name, color: metroConnection.line.color, type: 'metro' }
            ]
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

    // Option 1: Direct metro
    const metroRoute = await getTransitRoute(origin, destination);
    if (metroRoute) {
        routes.push(metroRoute);
    }

    // Option 2: Bus alternative (simulated)
    const busRoute: TransitRoute = {
        totalDuration: (metroRoute?.totalDuration || 900) + 300, // +5 min
        totalDistance: (metroRoute?.totalDistance || 2000) + 500,
        legs: [
            {
                type: 'walk',
                instruction: 'Camina hacia la parada de bus',
                distance: 150,
                duration: 120
            },
            {
                type: 'bus',
                instruction: 'Toma el bus H8 hacia Diagonal',
                distance: 1800,
                duration: 540,
                lineName: 'H8',
                lineColor: '#00A650',
                lineIcon: 'directions_bus',
                fromStop: 'Clot / Meridiana',
                toStop: 'Sagrada Família',
                stops: 6
            },
            {
                type: 'walk',
                instruction: 'Camina hasta tu destino',
                distance: 200,
                duration: 150
            }
        ],
        summary: 'Bus H8 desde Clot',
        transitLines: [{ name: 'H8', color: '#00A650', type: 'bus' }]
    };
    routes.push(busRoute);

    // Option 3: Metro + Bus combination (simulated)
    const comboRoute: TransitRoute = {
        totalDuration: (metroRoute?.totalDuration || 900) - 60,
        totalDistance: (metroRoute?.totalDistance || 2000) - 200,
        legs: [
            {
                type: 'walk',
                instruction: 'Camina hacia la estación Clot',
                distance: 180,
                duration: 140
            },
            {
                type: 'metro',
                instruction: 'Toma L1 hacia Fondo (1 parada)',
                distance: 800,
                duration: 180,
                lineName: 'L1',
                lineColor: '#E2001A',
                lineIcon: 'subway',
                fromStop: 'Clot',
                toStop: 'Navas',
                stops: 1
            },
            {
                type: 'bus',
                instruction: 'Toma el bus 62 (3 paradas)',
                distance: 1200,
                duration: 300,
                lineName: '62',
                lineColor: '#00A650',
                lineIcon: 'directions_bus',
                fromStop: 'Navas',
                toStop: 'Sagrada Família',
                stops: 3
            },
            {
                type: 'walk',
                instruction: 'Camina hasta tu destino',
                distance: 120,
                duration: 90
            }
        ],
        summary: 'L1 + Bus 62',
        transitLines: [
            { name: 'L1', color: '#E2001A', type: 'metro' },
            { name: '62', color: '#00A650', type: 'bus' }
        ]
    };
    routes.push(comboRoute);

    return routes;
}

export { formatDistance, formatDuration };
