import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { UnifiedMap, LOCATIONS, type RouteGeometry } from '../components/UnifiedMap';
import {
    getAlternativeRoutes,
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
    const { t } = useTranslation();
    const { isPremium } = useAuth();
    const { openPaywall, openSOSModal } = useSOS();

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
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [routes, setRoutes] = useState<RoutesState>({ safe: null, balanced: null, fast: null });
    const [routeGeometry, setRouteGeometry] = useState<RouteGeometry>({ safe: null, balanced: null, fast: null });
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(initialDestinationCoords);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Get user location — load cached immediately, then refresh with GPS
    useEffect(() => {
        const fetchLoc = async () => {
            try {
                const { Preferences } = await import('@capacitor/preferences');
                const { value: cachedStr } = await Preferences.get({ key: 'LAST_KNOWN_LOCATION' });
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    setUserLocation(prev => prev ?? cached);
                }
            } catch { /* ignore */ }

            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            } catch (error) {
                console.error('Error getting location:', error);
            }
        };
        fetchLoc();
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
            const center = userLocation || { lat: 41.3851, lng: 2.1734 }; // Barcelona center
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
        setLoadingProgress(0);
        setLoadingMessage('Preparando ruta...');
        
        let progress = 0;
        const messages = [
            'Conectando con Ministerio del Interior...',
            'Analizando índices de conflictividad...',
            'Verificando alumbrado de calles...',
            'Generando rutas inteligentes...'
        ];
        
        const progressInterval = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress > 90) progress = 90;
            setLoadingProgress(progress);
            
            const msgIndex = Math.min(Math.floor(progress / 25), messages.length - 1);
            setLoadingMessage(messages[msgIndex]);
        }, 150);

        const origin = userLocation;

        if (transportMode === 'transit' || transportMode === 'driving') {
            setRoutes({ safe: null, balanced: null, fast: null });
            setRouteGeometry({ safe: null, balanced: null, fast: null });
            clearInterval(progressInterval);
            setLoadingProgress(100);
            setTimeout(() => setIsLoading(false), 250);
            return;
        }

        const mapboxMode = transportMode;

        try {
            const routesResult = await getAlternativeRoutes(origin, destCoords, mapboxMode);

            if (routesResult && routesResult.fast) {
                const aiAnalysis = analyzeRouteSecurity();
                const isNightMode = isPremium && aiAnalysis.isNightModeActive;

                const safeBase = routesResult.safe || routesResult.fast;
                const balancedBase = routesResult.balanced || routesResult.fast;
                const fastBase = routesResult.fast;

                const safeRoute: RouteData = {
                    time: formatDuration(safeBase.duration),
                    distance: formatDistance(safeBase.distance),
                    description: isNightMode ? aiAnalysis.description : 'Evita callejones. Vías principales.',
                    extra: safeBase.dangerCount > 0 ? `⚠️ Atraviesa ${safeBase.dangerCount} zona(s) del Ministerio` : 'Fuentes Oficiales / Zonas Seguras',
                    geometry: safeBase.geometry.coordinates as [number, number][]
                };

                const balancedRoute: RouteData = {
                    time: formatDuration(balancedBase.duration),
                    distance: formatDistance(balancedBase.distance),
                    description: balancedBase.dangerCount > 0 ? `⚠️ Atraviesa ${balancedBase.dangerCount} zona(s) de conflicto` : t('route.balanced_desc'),
                    geometry: balancedBase.geometry.coordinates as [number, number][]
                };

                const fastRoute: RouteData = {
                    time: formatDuration(fastBase.duration),
                    distance: formatDistance(fastBase.distance),
                    description: fastBase.dangerCount > 0 ? `⚠️ PELIGRO: Atraviesa ${fastBase.dangerCount} zona(s) conflictivas` : t('route.fast_desc'),
                    geometry: fastBase.geometry.coordinates as [number, number][]
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
            clearInterval(progressInterval);
            setLoadingProgress(100);
            setTimeout(() => setIsLoading(false), 250);
        }
    }, [transportMode, userLocation, isPremium, t]);

    const handleNativeRedirect = useCallback(async (mode: 'walking' | 'cycling' | 'transit' | 'driving', dest: { lat: number; lng: number }) => {
        if (!userLocation) return;
        try {
            const { Capacitor } = await import('@capacitor/core');
            const isAndroid = Capacitor.getPlatform() === 'android';
            
            let appleDirFlg = 'd';
            let googleMode = 'driving';
            if (mode === 'transit') {
                appleDirFlg = 'r';
                googleMode = 'transit';
            } else if (mode === 'cycling') {
                appleDirFlg = 'w';
                googleMode = 'bicycling';
            }

            const url = isAndroid
                ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${dest.lat},${dest.lng}&travelmode=${googleMode}`
                : `http://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${dest.lat},${dest.lng}&dirflg=${appleDirFlg}`;

            window.open(url, '_blank');
        } catch (err) {
            console.error('Error opening native maps:', err);
        }
    }, [userLocation]);

    // Effect to refetch when transport mode changes or redirect if non-walking modes are chosen
    useEffect(() => {
        if (destinationCoords) {
            if (transportMode === 'transit' || transportMode === 'driving') {
                handleNativeRedirect(transportMode, destinationCoords);
                setTransportMode('walking');
            } else {
                fetchRoutes(destinationCoords);
            }
        }
    }, [transportMode, destinationCoords, fetchRoutes, handleNativeRedirect]);

    // Handle suggestion selection
    const handleSelectSuggestion = (suggestion: GeocodingResult) => {
        setSelectedDestination(suggestion.name);
        setDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng });
        setSearchQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
    };

    // Handle saved destination selection
    const handleSelectSavedDestination = (dest: typeof savedDestinations[0]) => {
        setSelectedDestination(dest.name);
        setDestinationCoords(dest.coords);
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
                            {selectedDestination ? t('route.title') : t('route.where_to')}
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
                                    placeholder={t('route.search_placeholder')}
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
                        showIncidenceZones={true}
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
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                        <div className="bg-zinc-900 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl border border-white/10 w-4/5 max-w-sm">
                            <div className="relative size-16 flex items-center justify-center">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-white font-bold text-sm">{loadingProgress}%</span>
                            </div>
                            <div className="text-center">
                                <span className="text-white font-bold text-lg block mb-1">{t('route.calculating')}</span>
                                <span className="text-primary/80 font-medium text-xs leading-tight block h-8">{loadingMessage}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map Floating Controls */}
                <div className="absolute right-3 top-3 flex flex-col gap-2 z-10">
                    <button className="size-10 rounded-full bg-[#0d0d0d] shadow-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-xl">my_location</span>
                    </button>
                </div>

                {/* Transport Mode Switcher */}
                <div className="absolute bottom-4 left-3 right-3 z-10">
                    <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#0d0d0d]/90 backdrop-blur-md p-1 shadow-xl border border-white/20">
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'walking' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_walk</span>
                            <span className="truncate">{t('route.walking')}</span>
                            <input type="radio" name="transport_mode" value="walking" className="invisible w-0" checked={transportMode === 'walking'} onChange={() => setTransportMode('walking')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'cycling' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_bike</span>
                            <span className="truncate">{t('route.cycling')}</span>
                            <input type="radio" name="transport_mode" value="cycling" className="invisible w-0" checked={transportMode === 'cycling'} onChange={() => setTransportMode('cycling')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'transit' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_transit</span>
                            <span className="truncate">{t('route.transit')}</span>
                            <input type="radio" name="transport_mode" value="transit" className="invisible w-0" checked={transportMode === 'transit'} onChange={() => setTransportMode('transit')} />
                        </label>
                        <label className={clsx("flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-all", transportMode === 'driving' ? "bg-primary text-white" : "text-gray-400")}>
                            <span className="material-symbols-outlined mr-1 text-[18px]">directions_car</span>
                            <span className="truncate">{t('route.driving')}</span>
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
                                        {t('route.family_journeys')}
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
                                    {t('route.saved_destinations')}
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
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 mt-4">
                                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-white font-bold text-lg">{t('route.calculating')}</p>
                                    <p className="text-primary/80 text-sm mt-2 text-center max-w-[250px] leading-tight">{loadingMessage}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2.5 mt-1">
                                        {transportMode === 'transit' || transportMode === 'driving' ? (
                                            <div className="flex items-center gap-3 bg-blue-500/10 border-2 border-blue-500/50 rounded-xl px-4 py-6 justify-center text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="size-12 bg-blue-500 rounded-full flex items-center justify-center text-white mb-1 shadow-lg shadow-blue-500/30">
                                                        <span className="material-symbols-outlined text-2xl">
                                                            {transportMode === 'transit' ? 'directions_transit' : transportMode === 'cycling' ? 'pedal_bike' : 'directions_car'}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-white font-bold text-lg">
                                                        {transportMode === 'transit' ? t('route.transit') : transportMode === 'cycling' ? 'Bicicleta' : 'Coche'}
                                                    </h3>
                                                    <p className="text-blue-200/70 text-sm max-w-[250px]">
                                                        {t('transit.open_native_maps') || 'Abre Apple Maps o Google Maps para ver la ruta exacta.'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Safe Route Card */}
                                                {routes.safe && (
                                                    <div
                                                        onClick={() => {
                                                            if (!isPremium) {
                                                                openPaywall(t('route.gate_safe_nav'));
                                                            } else {
                                                                setSelectedRoute('safe');
                                                            }
                                                        }}
                                                        className={clsx(
                                                            "flex items-center gap-3 bg-green-500/5 border-2 rounded-xl px-3 py-3 justify-between cursor-pointer transition-colors relative overflow-hidden",
                                                            selectedRoute === 'safe' ? "border-green-500 shadow-lg shadow-green-500/20" : "border-white/10 opacity-80"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={clsx("flex items-center justify-center rounded-xl shrink-0 size-10", isPremium && isNightTime() ? "text-indigo-400 bg-indigo-500/20" : "text-green-500 bg-green-500/20")}>
                                                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{isPremium && isNightTime() ? 'auto_awesome' : 'verified_user'}</span>
                                                            </div>
                                                            <div className="flex flex-col justify-center">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-white text-sm font-bold leading-tight">{t('route.safe_route')}</p>
                                                                    {isPremium && isNightTime() && <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">auto_awesome</span> AI Night</span>}
                                                                    {isPremium && !isNightTime() && <span className="bg-green-500/20 text-green-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">{t('route.enhanced')}</span>}
                                                                </div>
                                                                <p className={clsx("text-xs font-medium line-clamp-1", isPremium && isNightTime() ? "text-indigo-300" : "text-gray-400")}>
                                                                    {routes.safe.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <p className="text-white text-base font-bold">{routes.safe.time}</p>
                                                            <p className="text-gray-400 text-[10px]">{routes.safe.distance}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Balanced Route Card */}
                                                {routes.balanced && (
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
                                                                <p className="text-white text-sm font-bold leading-tight">{t('route.balanced_route')}</p>
                                                                <p className="text-gray-400 text-xs font-medium line-clamp-1">
                                                                    {routes.balanced.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <p className="text-white text-base font-bold">{routes.balanced.time}</p>
                                                            <p className="text-gray-400 text-[10px]">{routes.balanced.distance}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fast Route Card */}
                                                {routes.fast && (
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
                                                                    <p className="text-white text-sm font-bold leading-tight">{t('route.fast_route')}</p>
                                                                    <span className="bg-safety-red/20 text-safety-red text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">{t('route.caution')}</span>
                                                                </div>
                                                                <p className="text-safety-red/80 text-xs font-medium line-clamp-1">
                                                                    {routes.fast.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <p className="text-white text-base font-bold">{routes.fast.time}</p>
                                                            <p className="text-gray-400 text-[10px]">{routes.fast.distance}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <button
                                            onClick={async () => {
                                                if (transportMode === 'transit' && destinationCoords && userLocation) {
                                                    const { Browser } = await import('@capacitor/browser');
                                                    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=transit`;
                                                    await Browser.open({ url, presentationStyle: 'fullscreen' });
                                                    return;
                                                }

                                                if (!canStartRoute(isPremium)) {
                                                    setToastMessage(t('route.limit_reached'));
                                                    setTimeout(() => {
                                                        setToastMessage(null);
                                                        openPaywall(t('route.gate_unlimited'));
                                                    }, 2000);
                                                    return;
                                                }

                                                recordRouteStart(isPremium);

                                                navigate('/navigate', {
                                                    state: {
                                                        origin: userLocation || { lat: 41.3851, lng: 2.1734 },
                                                        destination: destinationCoords,
                                                        destinationName: selectedDestination,
                                                        transportMode
                                                    }
                                                });
                                            }}
                                            className={clsx(
                                                "w-full font-bold text-base py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] relative overflow-hidden",
                                                (transportMode === 'transit' || transportMode === 'driving') ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30" : "bg-primary hover:bg-primary/90 text-white shadow-primary/30"
                                            )}
                                        >
                                            <span className="material-symbols-outlined">{(transportMode === 'transit' || transportMode === 'driving') ? 'map' : 'navigation'}</span>
                                            {(transportMode === 'transit' || transportMode === 'driving') ? 'Abrir en Mapas' : t('route.start_nav')}
                                            {(transportMode === 'walking' || transportMode === 'cycling') && !isPremium && (
                                                <div className="absolute top-1 right-2 bg-black/30 rounded-full px-2 py-0.5 text-[10px] font-bold text-white/90">
                                                    {getRemainingRoutes(false)} {t('route.remaining')}
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
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
