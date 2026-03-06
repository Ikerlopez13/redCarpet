import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteLine, ROUTE_COLORS } from '../components/map/RouteLine';
import { DangerZones } from '../components/map/DangerZone';
import { getRoute, formatDuration, formatDistance, type RouteStep } from '../services/directionsService';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Barcelona danger zones - same as UnifiedMap
const barcelonaDangerZones = [
    {
        id: 'zone-bcn-1',
        lat: 41.4070,
        lng: 2.1850,
        radius: 80,
        label: 'Zona con incidentes'
    },
    {
        id: 'zone-bcn-2',
        lat: 41.4100,
        lng: 2.1920,
        radius: 60,
        label: 'Zona poco iluminada'
    }
];

// Icons for maneuvers
const getManeuverIcon = (type: string, modifier?: string): string => {
    if (type.includes('arrive')) return 'flag';
    if (type.includes('depart')) return 'trip_origin';
    if (type.includes('turn')) {
        if (modifier?.includes('left')) return 'turn_left';
        if (modifier?.includes('right')) return 'turn_right';
        if (modifier?.includes('slight left')) return 'turn_slight_left';
        if (modifier?.includes('slight right')) return 'turn_slight_right';
        if (modifier?.includes('sharp left')) return 'turn_sharp_left';
        if (modifier?.includes('sharp right')) return 'turn_sharp_right';
        return 'straight';
    }
    if (type.includes('roundabout')) return 'roundabout_right';
    if (type.includes('continue')) return 'straight';
    if (type.includes('merge')) return 'merge';
    if (type.includes('fork')) return 'fork_right';
    return 'straight';
};

interface NavigationViewProps {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    destinationName: string;
    transportMode: 'walking' | 'cycling' | 'driving';
    onClose: () => void;
}

export const NavigationView: React.FC<NavigationViewProps> = ({
    origin,
    destination,
    destinationName,
    transportMode,
    onClose
}) => {
    const [steps, setSteps] = useState<RouteStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
    const [totalDuration, setTotalDuration] = useState(0);
    const [totalDistance, setTotalDistance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [eta, setEta] = useState('');

    // Fetch route on mount
    useEffect(() => {
        const fetchRoute = async () => {
            setIsLoading(true);
            const route = await getRoute(origin, destination, transportMode);
            if (route) {
                setSteps(route.steps);
                setRouteGeometry(route.geometry.coordinates as [number, number][]);
                setTotalDuration(route.duration);
                setTotalDistance(route.distance);

                // Calculate ETA
                const now = new Date();
                now.setSeconds(now.getSeconds() + route.duration);
                setEta(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
            }
            setIsLoading(false);
        };
        fetchRoute();
    }, [origin, destination, transportMode]);

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    // Simulated navigation - advance steps
    const advanceStep = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full bg-[#0d0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-white font-medium">Calculando ruta...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-[#0d0d0d] flex flex-col font-display overflow-hidden">

            {/* Top Navigation Bar - Current instruction */}
            <div className="bg-primary text-white shrink-0 z-20">
                {/* Main instruction */}
                <div className="px-4 pt-10 pb-3">
                    <div className="flex items-center gap-4">
                        <div className="size-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-4xl">
                                {currentStep ? getManeuverIcon(currentStep.maneuver.type, currentStep.maneuver.modifier) : 'straight'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-3xl font-bold truncate">
                                {currentStep ? formatDistance(currentStep.distance) : '--'}
                            </p>
                            <p className="text-lg opacity-90 truncate">
                                {currentStep?.maneuver.instruction || 'Iniciando navegación...'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Next step preview */}
                {nextStep && (
                    <div className="bg-primary/80 px-4 py-2 flex items-center gap-3 border-t border-white/20">
                        <span className="material-symbols-outlined text-xl opacity-70">
                            {getManeuverIcon(nextStep.maneuver.type, nextStep.maneuver.modifier)}
                        </span>
                        <span className="text-sm opacity-80 truncate flex-1">
                            Después: {nextStep.maneuver.instruction}
                        </span>
                        <span className="text-sm font-bold">{formatDistance(nextStep.distance)}</span>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                <Map
                    initialViewState={{
                        latitude: (origin.lat + destination.lat) / 2,
                        longitude: (origin.lng + destination.lng) / 2,
                        zoom: 14,
                        bearing: 0,
                        pitch: 60
                    }}
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                    attributionControl={false}
                >
                    {/* Route line */}
                    {routeGeometry && (
                        <RouteLine
                            id="navigation-route"
                            coordinates={routeGeometry}
                            color={ROUTE_COLORS.safe}
                            isSelected={true}
                        />
                    )}

                    {/* Danger Zones Layer - Always visible during navigation */}
                    <DangerZones zones={barcelonaDangerZones} />

                    {/* Current position marker */}
                    <Marker latitude={origin.lat} longitude={origin.lng} anchor="center">
                        <div className="relative">
                            <div className="size-6 bg-blue-500 rounded-full border-4 border-white shadow-xl" />
                            <div className="absolute inset-0 size-6 bg-blue-500 rounded-full animate-ping opacity-40" />
                        </div>
                    </Marker>

                    {/* Destination marker */}
                    <Marker latitude={destination.lat} longitude={destination.lng} anchor="bottom">
                        <div className="flex flex-col items-center">
                            <div className="size-10 bg-primary rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    flag
                                </span>
                            </div>
                        </div>
                    </Marker>
                </Map>

                {/* Floating controls */}
                <div className="absolute right-4 top-4 flex flex-col gap-2">
                    <button className="size-12 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-800">
                        <span className="material-symbols-outlined">my_location</span>
                    </button>
                    <button className="size-12 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-800">
                        <span className="material-symbols-outlined">volume_up</span>
                    </button>
                </div>

                {/* Report danger/warning button */}
                <div className="absolute left-4 bottom-4">
                    <button
                        onClick={() => {
                            // Pass current location to report incident if needed (future improvement)
                            window.location.href = '/report';
                            // Using window.location or navigate depending on if we are in router context. 
                            // Navigation component is inside BrowserRouter so navigate hook works.
                            // But wait, 'navigate' is from hook call in 'NavigationView'? No, NavigationView uses useNavigate?
                            // Let me check if 'navigate' is available in scope.
                        }}
                        className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-2xl shadow-lg font-semibold transition-transform active:scale-95"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                        Añadir aviso
                    </button>
                </div>

                {/* Simulate navigation button - DEV ONLY */}
                {currentStepIndex < steps.length - 1 && (
                    <button
                        onClick={advanceStep}
                        className="absolute left-4 top-4 px-4 py-2 bg-zinc-800 text-white text-xs rounded-lg opacity-60"
                    >
                        Simular paso →
                    </button>
                )}
            </div>

            {/* Bottom bar - ETA and controls */}
            <div className="bg-[#0d0d0d] border-t border-white/10 px-4 py-4 shrink-0 z-20">
                {/* Progress bar */}
                <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-2xl font-bold text-white">{formatDuration(totalDuration)}</p>
                        <p className="text-sm text-white/60">
                            {formatDistance(totalDistance)} · Llegada: {eta}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="size-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">alt_route</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-primary text-white font-bold rounded-xl"
                        >
                            Finalizar
                        </button>
                    </div>
                </div>

                {/* Destination info */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3">
                    <div className="size-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            location_on
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{destinationName}</p>
                        <p className="text-white/50 text-xs truncate">
                            {steps[steps.length - 1]?.name || 'Destino'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Page wrapper for routing
export const Navigation: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as any;

    if (!state?.origin || !state?.destination) {
        // Redirect back if no navigation data
        navigate('/');
        return null;
    }

    return (
        <NavigationView
            origin={state.origin}
            destination={state.destination}
            destinationName={state.destinationName || 'Destino'}
            transportMode={state.transportMode || 'walking'}
            onClose={() => navigate('/')}
        />
    );
};
