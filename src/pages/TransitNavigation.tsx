import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteLine, ROUTE_COLORS } from '../components/map/RouteLine';
import { getTransitOptions, formatDistance, formatDuration, type TransitRoute, type TransitLeg } from '../services/transitRoutingService';
import { getRoute } from '../services/directionsService';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface TransitNavigationProps {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    destinationName: string;
    onClose: () => void;
}

const LegIcon: React.FC<{ leg: TransitLeg }> = ({ leg }) => {
    if (leg.type === 'walk') {
        return (
            <div className="size-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">directions_walk</span>
            </div>
        );
    }
    if (leg.type === 'metro') {
        return (
            <div
                className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: leg.lineColor }}
            >
                {leg.lineName}
            </div>
        );
    }
    if (leg.type === 'bus') {
        return (
            <div
                className="size-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: leg.lineColor }}
            >
                {leg.lineName}
            </div>
        );
    }
    return null;
};

export const TransitNavigation: React.FC<TransitNavigationProps> = ({
    origin,
    destination,
    destinationName,
    onClose
}) => {
    const [routes, setRoutes] = useState<TransitRoute[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showSteps, setShowSteps] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);

    useEffect(() => {
        const fetchRoutes = async () => {
            setIsLoading(true);

            // Get transit options
            const transitRoutes = await getTransitOptions(origin, destination);
            setRoutes(transitRoutes);

            // Get geometry for map
            const walkingRoute = await getRoute(origin, destination, 'walking');
            if (walkingRoute) {
                setRouteGeometry(walkingRoute.geometry.coordinates as [number, number][]);
            }

            setIsLoading(false);
        };
        fetchRoutes();
    }, [origin, destination]);

    const selectedRoute = routes[selectedRouteIndex];

    const handleStartNavigation = () => {
        setShowSteps(true);
        setCurrentStepIndex(0);
    };

    const advanceStep = () => {
        if (selectedRoute && currentStepIndex < selectedRoute.legs.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full bg-[#0d0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-white font-medium">Buscando opciones de transporte...</p>
                </div>
            </div>
        );
    }

    // Step-by-step navigation mode
    if (showSteps && selectedRoute) {
        const currentLeg = selectedRoute.legs[currentStepIndex];
        const nextLeg = selectedRoute.legs[currentStepIndex + 1];
        const progress = ((currentStepIndex + 1) / selectedRoute.legs.length) * 100;

        return (
            <div className="h-full w-full bg-[#0d0d0d] flex flex-col font-display overflow-hidden">
                {/* Header with current step */}
                <div
                    className="shrink-0 text-white z-20"
                    style={{ backgroundColor: currentLeg.type === 'walk' ? '#3B82F6' : currentLeg.lineColor || '#E2001A' }}
                >
                    <div className="px-4 pt-10 pb-3">
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-3xl">
                                    {currentLeg.type === 'walk' ? 'directions_walk' :
                                        currentLeg.type === 'metro' ? 'subway' : 'directions_bus'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                {currentLeg.type === 'walk' ? (
                                    <>
                                        <p className="text-2xl font-bold">{formatDistance(currentLeg.distance)}</p>
                                        <p className="text-sm opacity-90 truncate">{currentLeg.instruction}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-2xl font-bold">{currentLeg.lineName}</p>
                                        <p className="text-sm opacity-90 truncate">
                                            {currentLeg.fromStop} → {currentLeg.toStop}
                                        </p>
                                        <p className="text-xs opacity-70">{currentLeg.stops} paradas</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Next step preview */}
                    {nextLeg && (
                        <div className="bg-black/20 px-4 py-2 flex items-center gap-3">
                            <span className="material-symbols-outlined text-lg opacity-70">
                                {nextLeg.type === 'walk' ? 'directions_walk' :
                                    nextLeg.type === 'metro' ? 'subway' : 'directions_bus'}
                            </span>
                            <span className="text-sm opacity-80 truncate flex-1">
                                Después: {nextLeg.instruction}
                            </span>
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
                            pitch: 45
                        }}
                        mapStyle="mapbox://styles/mapbox/dark-v11"
                        mapboxAccessToken={MAPBOX_TOKEN}
                        style={{ width: '100%', height: '100%' }}
                        attributionControl={false}
                    >
                        {routeGeometry && (
                            <RouteLine
                                id="transit-route"
                                coordinates={routeGeometry}
                                color={selectedRoute.transitLines[0]?.color || ROUTE_COLORS.safe}
                                isSelected={true}
                            />
                        )}
                        <Marker latitude={origin.lat} longitude={origin.lng} anchor="center">
                            <div className="size-5 bg-blue-500 rounded-full border-3 border-white shadow-lg" />
                        </Marker>
                        <Marker latitude={destination.lat} longitude={destination.lng} anchor="bottom">
                            <div className="size-8 bg-primary rounded-full border-3 border-white shadow-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                            </div>
                        </Marker>
                    </Map>

                    {currentStepIndex < selectedRoute.legs.length - 1 && (
                        <button
                            onClick={advanceStep}
                            className="absolute left-4 top-4 px-4 py-2 bg-zinc-800 text-white text-xs rounded-lg"
                        >
                            Siguiente paso →
                        </button>
                    )}
                </div>

                {/* Bottom progress */}
                <div className="bg-[#0d0d0d] border-t border-white/10 px-4 py-4 shrink-0">
                    <div className="h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xl font-bold text-white">{formatDuration(selectedRoute.totalDuration)}</p>
                            <p className="text-xs text-white/60">{formatDistance(selectedRoute.totalDistance)}</p>
                        </div>
                        <button onClick={onClose} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-sm">
                            Finalizar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Route selection mode
    return (
        <div className="h-full w-full bg-[#0d0d0d] flex flex-col font-display overflow-hidden">
            {/* Header */}
            <div className="bg-[#0d0d0d] px-4 pt-10 pb-3 shrink-0 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="size-10 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <p className="text-white font-bold">{destinationName}</p>
                        <p className="text-white/50 text-xs">Opciones de transporte público</p>
                    </div>
                </div>
            </div>

            {/* Route options */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {routes.map((route, index) => (
                    <div
                        key={index}
                        onClick={() => setSelectedRouteIndex(index)}
                        className={clsx(
                            "p-4 rounded-2xl border cursor-pointer transition-all",
                            selectedRouteIndex === index
                                ? "bg-primary/10 border-primary"
                                : "bg-zinc-900 border-white/10"
                        )}
                    >
                        {/* Route summary */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {route.transitLines.map((line, i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "px-2 py-1 text-white text-xs font-bold",
                                            line.type === 'metro' ? 'rounded-full' : 'rounded'
                                        )}
                                        style={{ backgroundColor: line.color }}
                                    >
                                        {line.name}
                                    </div>
                                ))}
                            </div>
                            <div className="text-right">
                                <p className="text-white font-bold">{formatDuration(route.totalDuration)}</p>
                                <p className="text-white/50 text-xs">{formatDistance(route.totalDistance)}</p>
                            </div>
                        </div>

                        {/* Legs timeline */}
                        <div className="flex items-center gap-2">
                            {route.legs.map((leg, legIndex) => (
                                <React.Fragment key={legIndex}>
                                    <div className="flex items-center gap-1">
                                        <span
                                            className="material-symbols-outlined text-base"
                                            style={{ color: leg.type === 'walk' ? '#60A5FA' : leg.lineColor }}
                                        >
                                            {leg.type === 'walk' ? 'directions_walk' :
                                                leg.type === 'metro' ? 'subway' : 'directions_bus'}
                                        </span>
                                        <span className="text-white/60 text-xs">{formatDistance(leg.distance)}</span>
                                    </div>
                                    {legIndex < route.legs.length - 1 && (
                                        <span className="material-symbols-outlined text-white/30 text-sm">chevron_right</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Detailed steps when selected */}
                        {selectedRouteIndex === index && (
                            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                {route.legs.map((leg, legIndex) => (
                                    <div key={legIndex} className="flex items-start gap-3">
                                        <LegIcon leg={leg} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium">{leg.instruction}</p>
                                            <p className="text-white/50 text-xs">
                                                {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
                                                {leg.stops && ` · ${leg.stops} paradas`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Start button */}
            <div className="shrink-0 px-4 py-4 bg-[#0d0d0d] border-t border-white/10">
                <button
                    onClick={handleStartNavigation}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">navigation</span>
                    Iniciar Navegación
                </button>
            </div>
        </div>
    );
};

// Page wrapper
export const TransitNavigationPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as any;

    if (!state?.origin || !state?.destination) {
        navigate('/');
        return null;
    }

    return (
        <TransitNavigation
            origin={state.origin}
            destination={state.destination}
            destinationName={state.destinationName || 'Destino'}
            onClose={() => navigate('/')}
        />
    );
};
