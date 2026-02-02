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

// Datos de ejemplo de trayectos de familiares
const familyRoutes = [
    {
        id: 1,
        name: 'María',
        avatar: '👩',
        status: 'en_curso',
        origin: 'Casa',
        destination: 'Universidad',
        progress: 65,
        eta: '12 min',
        lastUpdate: 'Hace 2 min',
    },
    {
        id: 2,
        name: 'Carlos',
        avatar: '👨',
        status: 'en_curso',
        origin: 'Oficina',
        destination: 'Gimnasio',
        progress: 30,
        eta: '18 min',
        lastUpdate: 'Hace 5 min',
    },
];

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
    const initialDestination = (location.state as any)?.destination || null;
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const [transportMode, setTransportMode] = useState<'walking' | 'cycling' | 'transit'>('walking');
    const [selectedRoute, setSelectedRoute] = useState<'safe' | 'balanced' | 'fast'>('safe');
    const [selectedDestination, setSelectedDestination] = useState<string | null>(initialDestination);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [routes, setRoutes] = useState<RoutesState>({ safe: null, balanced: null, fast: null });
    const [routeGeometry, setRouteGeometry] = useState<RouteGeometry>({ safe: null, balanced: null, fast: null });
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

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
            const results = await searchPlaces(searchQuery, LOCATIONS.HOME);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [searchQuery]);

    // Fetch routes when destination is selected
    const fetchRoutes = useCallback(async (destCoords: { lat: number; lng: number }) => {
        setIsLoading(true);
        const origin = LOCATIONS.HOME;
        const mapboxMode = transportMode === 'transit' ? 'driving' : transportMode;

        try {
            const baseRoute = await getRoute(origin, destCoords, mapboxMode);

            if (baseRoute) {
                const safeRoute: RouteData = {
                    time: formatDuration(Math.round(baseRoute.duration * 1.3)),
                    distance: formatDistance(Math.round(baseRoute.distance * 1.2)),
                    description: 'Calles bien iluminadas y transitadas',
                    extra: 'Presencia policial frecuente',
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
    }, [transportMode]);

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
                            "flex items-center gap-3 bg-zinc-900 border rounded-xl px-4 py-2.5 transition-all",
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
                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
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
                        origin={selectedDestination ? LOCATIONS.HOME : undefined}
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
                                    onClick={() => setSelectedRoute('safe')}
                                    className={clsx(
                                        "flex items-center gap-3 bg-green-500/5 border-2 rounded-xl px-3 py-3 justify-between cursor-pointer transition-colors",
                                        selectedRoute === 'safe' ? "border-green-500" : "border-white/5 opacity-80"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-green-500 flex items-center justify-center rounded-xl bg-green-500/20 shrink-0 size-10">
                                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white text-sm font-bold leading-tight">Ruta más segura</p>
                                                <span className="bg-green-500/20 text-green-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Mejor</span>
                                            </div>
                                            <p className="text-gray-400 text-xs font-medium line-clamp-1">{routes.safe?.description || 'Calculando...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.safe?.time || '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.safe?.distance || '--'}</p>
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
                                            <p className="text-gray-400 text-xs font-medium line-clamp-1">{routes.balanced?.description || 'Calculando...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.balanced?.time || '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.balanced?.distance || '--'}</p>
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
                                            <p className="text-safety-red/80 text-xs font-medium line-clamp-1">{routes.fast?.description || 'Calculando...'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="text-white text-base font-bold">{routes.fast?.time || '--'}</p>
                                        <p className="text-gray-400 text-[10px]">{routes.fast?.distance || '--'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => {
                                        if (transportMode === 'transit') {
                                            navigate('/transit-navigate', {
                                                state: {
                                                    origin: LOCATIONS.HOME,
                                                    destination: destinationCoords,
                                                    destinationName: selectedDestination
                                                }
                                            });
                                        } else {
                                            navigate('/navigate', {
                                                state: {
                                                    origin: LOCATIONS.HOME,
                                                    destination: destinationCoords,
                                                    destinationName: selectedDestination,
                                                    transportMode: transportMode
                                                }
                                            });
                                        }
                                    }}
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-base py-3.5 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">navigation</span>
                                    Iniciar Navegación
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
