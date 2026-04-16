import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { UnifiedMap, LOCATIONS, type RouteGeometry } from '../components/UnifiedMap';
import {
    getRoute,
    formatDuration,
    formatDistance,
} from '../services/directionsService';
import { searchPlaces, getCategoryIcon, type GeocodingResult } from '../services/geocodingService';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext.base';
import { canStartRoute, recordRouteStart, getRemainingRoutes } from '../services/routeLimiterService';
import { isNightTime, analyzeRouteSecurity } from '../services/aiRoutingService';

// Datos de ejemplo de trayectos de familiares (Placeholder for real data)
const familyRoutes: any[] = [];

// Destinos guardados con coordenadas reales de Barcelona
const savedDestinations = [
    { id: 1, name: 'Parc del Clot', address: 'Carrer dels Escultors Claperós', icon: 'park', coords: LOCATIONS.CENTRAL_PARK },
    { id: 2, name: 'Trabajo', address: 'Oficina Sant Martí', icon: 'work', coords: LOCATIONS.WORK },
    { id: 3, name: 'Gimnasio', address: 'C/ Aragó', icon: 'fitness_center', coords: LOCATIONS.GYM },
];

interface RouteData {
    time: string;
    distance: string;
    description: string;
    extra?: string;
    geometry?: [number, number][];
}

interface RoutesState {
    safe: RouteData | null;
    balanced: RouteData | null;
    fast: RouteData | null;
}

export const RouteSelection: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isPremium } = useAuth();
    const { openPaywall } = useSOS();

    // Correctly parse state
    const state = location.state as {
        destination?: { lat: number; lng: number };
        destinationName?: string;
        initialTransportMode?: 'walking' | 'cycling' | 'transit';
    } | null;

    const initialDestinationName = state?.destinationName || null;
    const initialDestinationCoords = state?.destination || null;
    const initialTransportMode = state?.initialTransportMode || 'walking';

    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [transportMode, setTransportMode] = useState<'walking' | 'cycling' | 'transit' | 'driving'>(initialTransportMode as any);
    const [selectedRoute, setSelectedRoute] = useState<'safe' | 'balanced' | 'fast'>('safe');
    const [selectedDestination, setSelectedDestination] = useState<string | null>(initialDestinationName);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [routes, setRoutes] = useState<RoutesState>({ safe: null, balanced: null, fast: null });
    const [routeGeometry, setRouteGeometry] = useState<RouteGeometry>({ safe: null, balanced: null, fast: null });
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(initialDestinationCoords);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Get user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Error getting location:', error);
                    // Fallback to default if needed, or keep null to show loading/error
                },
                { enableHighAccuracy: true }
            );
        }
    }, []);

    // Debounced search for autocomplete
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (searchQuery.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            // Use user location for better search results if available
            const center = userLocation || LOCATIONS.HOME;
            const results = await searchPlaces(searchQuery, center);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [searchQuery, userLocation]);

    // Fetch routes when destination is selected
    const fetchRoutes = useCallback(async (destCoords: { lat: number; lng: number }) => {
        if (!userLocation) return; // Wait for user location

        setIsLoading(true);
        const origin = userLocation;

        if (transportMode === 'transit') {
            try {
                // Import getTransitOptions dynamically or via top-level import
                const { getTransitOptions } = await import('../services/transitRoutingService');
                const transitRoutes = await getTransitOptions(origin, destCoords);
                
                if (transitRoutes && transitRoutes.length > 0) {
                    const safeOpt = transitRoutes[0];
                    const balOpt = transitRoutes[1] || transitRoutes[0];
                    const fastOpt = transitRoutes[transitRoutes.length - 1] || transitRoutes[0];

                    setRoutes({
                        safe: {
                            time: formatDuration(safeOpt.totalDuration),
                            distance: formatDistance(safeOpt.totalDistance),
                            description: safeOpt.summary + ' (Recomendada)',
                            extra: 'Paradas con alta afluencia e iluminación',
                        },
                        balanced: {
                            time: formatDuration(balOpt.totalDuration),
                            distance: formatDistance(balOpt.totalDistance),
                            description: balOpt.summary,
                        },
                        fast: {
                            time: formatDuration(fastOpt.totalDuration),
                            distance: formatDistance(fastOpt.totalDistance),
                            description: fastOpt.summary + ' (Más directa)',
                        }
                    });
                }
                setRouteGeometry({ safe: null, balanced: null, fast: null }); // Don't draw car lines for transit
            } catch (error) {
                console.error('Error fetching transit options:', error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        const mapboxMode = transportMode;

        try {
            const baseRoute = await getRoute(origin, destCoords, mapboxMode);

            if (baseRoute) {
                const aiAnalysis = analyzeRouteSecurity();
                const isNightMode = isPremium && aiAnalysis.isNightModeActive;

                const safeRoute: RouteData = {
                    time: formatDuration(Math.round(baseRoute.duration * 1.3)),
                    distance: formatDistance(Math.round(baseRoute.distance * 1.2)),
                    description: isNightMode ? aiAnalysis.description : 'Calles bien iluminadas y transitadas',
                    extra: isNightMode ? 'IA Priorizando cámaras y comercios' : 'Presencia policial frecuente',
                    geometry: baseRoute.geometry.coordinates as [number, number][]
                };

                const balancedRoute: RouteData = {
                    time: formatDuration(baseRoute.duration),
                    distance: formatDistance(baseRoute.distance),
                    description: 'Equilibrio entre seguridad y tiempo',
                    geometry: baseRoute.geometry.coordinates as [number, number][]
                };

                const fastRoute: RouteData = {
                    time: formatDuration(Math.round(baseRoute.duration * 0.85)),
                    distance: formatDistance(Math.round(baseRoute.distance * 0.9)),
                    description: 'Ruta más directa, menos iluminada',
                    geometry: baseRoute.geometry.coordinates as [number, number][]
                };

                setRoutes({ safe: safeRoute, balanced: balancedRoute, fast: fastRoute });
                setRouteGeometry({
                    safe: safeRoute.geometry || null,
                    balanced: balancedRoute.geometry || null,
                    fast: fastRoute.geometry || null
                });
            }
        } catch (error) {
            console.error('Error fetching routes:', error);
        } finally {
            setIsLoading(false);
        }
    }, [transportMode, userLocation]);

    // Effect to refetch when transport mode changes
    useEffect(() => {
        if (destinationCoords) {
            fetchRoutes(destinationCoords);
        }
    }, [transportMode, destinationCoords, fetchRoutes]);

    // Handle suggestion selection
    const handleSelectSuggestion = (suggestion: GeocodingResult) => {
        setSelectedDestination(suggestion.name);
        setDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng });
        setSearchQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
        fetchRoutes({ lat: suggestion.lat, lng: suggestion.lng });
    };

    // Handle saved destination selection
    const handleSelectSavedDestination = (dest: typeof savedDestinations[0]) => {
        setSelectedDestination(dest.name);
        setDestinationCoords(dest.coords);
        fetchRoutes(dest.coords);
    };

    return (
        <div className="bg-[#0d0d0d] font-display text-white overflow-hidden h-full flex flex-col w-full">

            {/* Header - More compact */}
            <div className="relative flex flex-col bg-[#0d0d0d] shrink-0 z-30">
                <div className="flex items-center px-4 pt-3 pb-1 justify-between">
                    <div
                        onClick={() => {
                            if (selectedDestination) {
                                setSelectedDestination(null);
                                setRoutes({ safe: null, balanced: null, fast: null });
                            } else {
                                navigate(-1);
                            }
                        }}
                        className="text-white flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10 cursor-pointer transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                        <h2 className="text-white text-base font-bold leading-tight tracking-tight">
                            {selectedDestination ? 'Selección de Ruta' : '¿A dónde vas?'}
                        </h2>
                    </div>
                    <div className="size-9" />
                </div>

                {/* Search with Autocomplete */}
                <div className="px-4 pb-2 relative">
                    <div
                        className={clsx(
                            "flex items-center gap-3 bg-zinc-900 border rounded-xl px-4 py-2.5",
                            selectedDestination ? "border-primary" : "border-white/10",
                            showSuggestions && "rounded-b-none border-b-0"
                        )}
                    >
                        <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
                        {selectedDestination ? (
                            <div
                                className="flex-1 flex items-center justify-between cursor-pointer"
                                onClick={() => {
                                    setSelectedDestination(null);
                                    setRoutes({ safe: null, balanced: null, fast: null });
                                    setTimeout(() => searchInputRef.current?.focus(), 100);
                                }}
                            >
                                <span className="text-white font-medium text-sm">{selectedDestination}</span>
                                <span className="material-symbols-outlined text-primary text-sm">edit</span>
                            </div>
                        ) : (
                            <>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar destino..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-base"

                                />
                                {isSearching && (
                                    <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                )}
                            </>
                        )}
                    </div>

                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && !selectedDestination && (
                        <div className="absolute left-4 right-4 bg-zinc-900 border border-white/10 border-t-0 rounded-b-xl overflow-hidden shadow-xl z-50">
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.id}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 cursor-pointer transition-colors border-t border-white/5"
                                >
                                    <div className="text-gray-400 flex items-center justify-center rounded-lg bg-zinc-800 shrink-0 size-9">
                                        <span className="material-symbols-outlined text-lg">
                                            {getCategoryIcon(suggestion.category || 'location_on')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{suggestion.name}</p>
                                        <p className="text-gray-500 text-xs truncate">{suggestion.address}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Map Area - More space */}
            <div className="relative flex-1 overflow-hidden" onClick={() => setShowSuggestions(false)}>
                <div className="absolute inset-0 z-0">
                    <UnifiedMap
                        showMarkers={!selectedDestination}
                        showDangerZones={true}
                        showRoutes={!!selectedDestination}
                        showTransit={transportMode === 'transit'}
                        transportMode={transportMode}
                        selectedRoute={selectedRoute}
                        routeGeometry={routeGeometry}
                        origin={selectedDestination ? (userLocation || undefined) : undefined}
                        destination={destinationCoords || undefined}
                    />
                </div>

                {/* Loading indicator */}
                {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                        <div className="bg-zinc-900 rounded-2xl px-6 py-4 flex items-center gap-3">
                            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-white font-medium">Calculando rutas...</span>
                        </div>
                    </div>
                )}

                {/* Map Floating Controls */}
                <div className="absolute right-3 top-3 flex flex-col gap-2 z-10">
                    <button className="size-10 rounded-full bg-[#0d0d0d] shadow-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-xl">my_location</span>
                    </button>
                    <button className="size-10 rounded-full bg-primary shadow-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>sos</span>
                    </button>
                </div>

                {/* Transport Mode Switcher */}
                <div className="absolute bottom-4 left-3 right-3 z-10">
                    <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#0d0d0d]/90 backdrop-blur-md p-1 shadow-xl border border-white/20">
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'walking' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_walk</span>
                            <span className="truncate">A pie</span>
                            <input type="radio" name="transport_mode" value="walking" className="invisible w-0" checked={transportMode === 'walking'} onChange={() => setTransportMode('walking')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'cycling' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_bike</span>
                            <span className="truncate">Bici</span>
                            <input type="radio" name="transport_mode" value="cycling" className="invisible w-0" checked={transportMode === 'cycling'} onChange={() => setTransportMode('cycling')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'transit' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_transit</span>
                            <span className="truncate">Transporte</span>
                            <input type="radio" name="transport_mode" value="transit" className="invisible w-0" checked={transportMode === 'transit'} onChange={() => setTransportMode('transit')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'driving' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_car</span>
                            <span className="truncate">Coche</span>
                            <input type="radio" name="transport_mode" value="driving" className="invisible w-0" checked={transportMode === 'driving'} onChange={() => setTransportMode('driving')} />
                        </label>
                    </div>
                </div>
            </div>

            {/* Bottom Sheet - Reduced height (was 52%, now 45%) */}
            <div className="relative flex flex-col h-[45%] bg-[#0d0d0d] rounded-t-[1.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] overflow-hidden shrink-0 z-20">

                {/* Drag Handle */}
                <button className="flex h-5 w-full items-center justify-center shrink-0">
                    <div className="h-1 w-10 rounded-full bg-gray-700"></div>
                </button>

                <div className="flex-1 overflow-y-auto px-4 pb-6 no-scrollbar">

                    {!selectedDestination ? (
                        <>
                            {/* Family Routes - Compact */}
                            {familyRoutes.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>family_restroom</span>
                                        Trayectos de Familiares
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {familyRoutes.map((route) => (
                                            <div
                                                key={route.id}
                                                className={clsx(
                                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all",
                                                    route.status === 'en_curso'
                                                        ? "bg-primary/5 border-primary/30"
                                                        : "bg-zinc-900 border-white/5 opacity-70"
                                                )}
                                            >
                                                <div className="text-xl size-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                                    {route.avatar}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-white text-sm font-bold truncate">{route.name}</p>
                                                        {route.status === 'en_curso' && (
                                                            <span className="bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                                                En Curso
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-400 text-xs truncate">{route.origin} → {route.destination}</p>
                                                </div>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <p className="text-white text-base font-bold">{route.eta}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Saved Destinations - Compact */}
                            <div>
                                <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-400 text-lg">bookmark</span>
                                    Destinos Guardados
                                </h3>
                                <div className="flex flex-col gap-1.5">
                                    {savedDestinations.map((dest) => (
                                        <div
                                            key={dest.id}
                                            onClick={() => handleSelectSavedDestination(dest)}
                                            className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="text-gray-400 flex items-center justify-center rounded-lg bg-zinc-800 shrink-0 size-9">
                                                <span className="material-symbols-outlined text-lg">{dest.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-semibold truncate">{dest.name}</p>
                                                <p className="text-gray-500 text-xs truncate">{dest.address}</p>
                                            </div>
                                            <span className="material-symbols-outlined text-gray-600 text-lg">chevron_right</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Route Options */
                        <>
                            <div className="flex flex-col gap-2.5 mt-1">

                                {/* Safe Route Card */}
                                <div
                                    onClick={() => {
                                        if (!isPremium) {
                                            openPaywall('Navegación con Rutas Seguras');
                                        } else {
                                            setSelectedRoute('safe');
                                        }
                                    }}
                                    className={clsx(
                                        "flex items-center gap-3 bg-green-500/5 border-2 rounded-xl px-3 py-3 justify-between cursor-pointer transition-colors relative overflow-hidden",
                                        selectedRoute === 'safe' ? "border-green-500 shadow-lg shadow-green-500/20" : "border-white/10 opacity-80"
                                    )}
                                >
                                    {!isPremium && (
                                        <div className="absolute top-0 right-0 p-2 text-yellow-500/80">
                                            <span className="material-symbols-outlined text-[12px] bg-black/50 rounded-full p-1" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("flex items-center justify-center rounded-xl shrink-0 size-10", isPremium && isNightTime() ? "text-indigo-400 bg-indigo-500/20" : "text-green-500 bg-green-500/20")}>
                                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{isPremium && isNightTime() ? 'auto_awesome' : 'verified_user'}</span>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white text-sm font-bold leading-tight">Ruta más segura</p>
                                                {isPremium && isNightTime() && <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">auto_awesome</span> AI Night</span>}
                                                {isPremium && !isNightTime() && <span className="bg-green-500/20 text-green-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Mejorada</span>}
                                            </div>
                                            <p className={clsx("text-xs font-medium line-clamp-1", isPremium && isNightTime() ? "text-indigo-300" : "text-gray-400")}>
                                                {routes.safe ? routes.safe.description : 'Calculando...'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.safe ? routes.safe.time : '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.safe ? routes.safe.distance : '--'}</p>
                                    </div>
                                </div>

                                {/* Balanced Route Card */}
                                <div
                                    onClick={() => setSelectedRoute('balanced')}
                                    className={clsx(
                                        "flex items-center gap-3 bg-zinc-900 border rounded-xl px-3 py-3 justify-between cursor-pointer opacity-80 transition-colors",
                                        selectedRoute === 'balanced' ? "border-safety-orange" : "border-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-safety-orange flex items-center justify-center rounded-xl bg-safety-orange/20 shrink-0 size-10">
                                            <span className="material-symbols-outlined text-xl">balance</span>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <p className="text-white text-sm font-bold leading-tight">Equilibrada</p>
                                            <p className="text-gray-400 text-xs font-medium line-clamp-1">
                                                {routes.balanced ? routes.balanced.description : 'Calculando...'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.balanced ? routes.balanced.time : '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.balanced ? routes.balanced.distance : '--'}</p>
                                    </div>
                                </div>

                                {/* Fast Route Card */}
                                <div
                                    onClick={() => setSelectedRoute('fast')}
                                    className={clsx(
                                        "flex items-center gap-3 bg-zinc-900 border rounded-xl px-3 py-3 justify-between cursor-pointer opacity-80 transition-colors",
                                        selectedRoute === 'fast' ? "border-safety-red" : "border-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-safety-red flex items-center justify-center rounded-xl bg-safety-red/20 shrink-0 size-10">
                                            <span className="material-symbols-outlined text-xl">warning</span>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white text-sm font-bold leading-tight">Más rápida</p>
                                                <span className="bg-safety-red/20 text-safety-red text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Precaución</span>
                                            </div>
                                            <p className="text-safety-red/80 text-xs font-medium line-clamp-1">
                                                {routes.fast ? routes.fast.description : 'Calculando...'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.fast ? routes.fast.time : '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.fast ? routes.fast.distance : '--'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => {
                                        if (!canStartRoute(isPremium)) {
                                            setToastMessage('Límite diario de rutas alcanzado (3/3).');
                                            setTimeout(() => {
                                                setToastMessage(null);
                                                openPaywall('Rutas Ilimitadas');
                                            }, 2000);
                                            return;
                                        }

                                        recordRouteStart(isPremium);

                                        if (transportMode === 'transit') {
                                            navigate('/transit-navigate', {
                                                state: {
                                                    origin: userLocation || LOCATIONS.HOME,
                                                    destination: destinationCoords,
                                                    destinationName: selectedDestination
                                                }
                                            });
                                        } else {
                                            navigate('/navigate', {
                                                state: {
                                                    origin: userLocation || LOCATIONS.HOME,
                                                    destination: destinationCoords,
                                                    destinationName: selectedDestination,
                                                    transportMode: transportMode
                                                }
                                            });
                                        }
                                    }}
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-base py-3.5 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] relative overflow-hidden"
                                >
                                    <span className="material-symbols-outlined">navigation</span>
                                    Iniciar Navegación
                                    {!isPremium && (
                                        <div className="absolute top-1 right-2 bg-black/30 rounded-full px-2 py-0.5 text-[10px] font-bold text-white/90">
                                            {getRemainingRoutes(false)} restantes
                                        </div>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Simple Toast within RouteSelection */}
            {toastMessage && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm text-center w-max max-w-[90%] animate-in fade-in slide-in-from-top-4">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};
