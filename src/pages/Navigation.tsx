import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Geolocation } from '@capacitor/geolocation';
import { useTranslation } from 'react-i18next';

import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteLine, ROUTE_COLORS } from '../components/map/RouteLine';
import { IncidenceZones } from '../components/map/IncidenceZone';
import { getRoute, formatDuration, formatDistance, type RouteStep } from '../services/directionsService';
import { searchPlaces } from '../services/geocodingService';
import { ReportDangerModal } from '../components/safety/ReportDangerModal';
import { useSOS } from '../contexts/SOSContext.base';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

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

interface PrecomputedRoute {
    geometry?: [number, number][];
    steps?: RouteStep[];
    duration?: number;
    distance?: number;
}

interface NavigationViewProps {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    destinationName: string;
    transportMode: 'walking' | 'cycling' | 'driving';
    precomputed?: PrecomputedRoute;
    onClose: () => void;
}

export const NavigationView: React.FC<NavigationViewProps> = ({
    origin,
    destination,
    destinationName,
    transportMode,
    precomputed,
    onClose
}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { openSOSModal } = useSOS();

    // Barcelona danger zones - same as UnifiedMap
    const barcelonaIncidenceZones = [
        {
            id: 'zone-bcn-1',
            lat: 41.4070,
            lng: 2.1850,
            radius: 80,
            label: t('navigation.incidence_alert')
        },
        {
            id: 'zone-bcn-2',
            lat: 41.4100,
            lng: 2.1920,
            radius: 60,
            label: t('navigation.attention_zone')
        }
    ];
    const [steps, setSteps] = useState<RouteStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
    const [totalDuration, setTotalDuration] = useState(0);
    const [totalDistance, setTotalDistance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [eta, setEta] = useState('');
    const [showReportDangerModal, setShowReportDangerModal] = useState(false);
    const [viewState, setViewState] = useState({
        latitude: origin.lat,
        longitude: origin.lng,
        zoom: 18,
        bearing: 0,
        pitch: 60
    });
    const [userLocation, setUserLocation] = useState({ lat: origin.lat, lng: origin.lng });
    const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
    const stepsRef = useRef<RouteStep[]>([]);
    const stepIdxRef = useRef(0);
    useEffect(() => { stepsRef.current = steps; }, [steps]);
    useEffect(() => { stepIdxRef.current = currentStepIndex; }, [currentStepIndex]);

    // Distancia en metros entre dos coordenadas (Haversine).
    const metersBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
        const R = 6371e3;
        const p1 = (aLat * Math.PI) / 180, p2 = (bLat * Math.PI) / 180;
        const dPhi = ((bLat - aLat) * Math.PI) / 180, dLam = ((bLng - aLng) * Math.PI) / 180;
        const x = Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLam / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    // Fetch route on mount
    useEffect(() => {
        const applyRoute = (r: { steps: RouteStep[]; coordinates: [number, number][]; duration: number; distance: number }) => {
            setSteps(r.steps || []);
            setRouteGeometry(r.coordinates || null);
            setTotalDuration(r.duration || 0);
            setTotalDistance(r.distance || 0);
            const now = new Date();
            now.setSeconds(now.getSeconds() + (r.duration || 0));
            setEta(now.toLocaleTimeString(i18n.language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
            setViewState(prev => ({ ...prev, latitude: origin.lat, longitude: origin.lng }));
        };

        const fetchRoute = async () => {
            setIsLoading(true);

            // 1) Ruta ya calculada en la selección → usarla directamente (sin
            //    re-pedir Directions, sin fallo por rate-limit, tiempos idénticos).
            if (precomputed?.geometry && precomputed.geometry.length > 1) {
                applyRoute({
                    steps: precomputed.steps || [],
                    coordinates: precomputed.geometry,
                    duration: precomputed.duration || 0,
                    distance: precomputed.distance || 0,
                });
                setIsLoading(false);
                return;
            }

            // 2) Fallback: pedir la ruta, con 1 reintento (no fallar en silencio).
            let route = await getRoute(origin, destination, transportMode);
            if (!route) {
                await new Promise(r => setTimeout(r, 800));
                route = await getRoute(origin, destination, transportMode);
            }
            if (route) {
                applyRoute({
                    steps: route.steps,
                    coordinates: route.geometry.coordinates as [number, number][],
                    duration: route.duration,
                    distance: route.distance,
                });
            }
            setIsLoading(false);
        };
        fetchRoute();
        
    }, [origin, destination, transportMode, precomputed]);

    // Track position and heading for rotation
    useEffect(() => {
        let watchId: string | null = null;
        
        const startTracking = async () => {
            try {
                watchId = await Geolocation.watchPosition({ 
                    enableHighAccuracy: true,
                    timeout: 5000 
                }, (position) => {
                    if (position) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setUserLocation({ lat, lng });

                        // Turn-by-turn: avanzar al siguiente paso cuando llegamos
                        // al punto de giro (~25 m), y actualizar la distancia en vivo.
                        const arr = stepsRef.current;
                        let idx = stepIdxRef.current;
                        if (arr.length > 0) {
                            const targetLoc = (s?: RouteStep) => s?.maneuver?.location;
                            // El "siguiente giro" es el maniobra del paso idx+1 (fin del paso actual).
                            let nextLoc = targetLoc(arr[idx + 1]) || targetLoc(arr[idx]);
                            if (nextLoc) {
                                let d = metersBetween(lat, lng, nextLoc[1], nextLoc[0]);
                                // Si ya pasamos el giro, avanzar (puede saltar varios si vamos rápido).
                                while (d < 25 && idx < arr.length - 1) {
                                    idx++;
                                    const nl = targetLoc(arr[idx + 1]) || targetLoc(arr[idx]);
                                    if (!nl) break;
                                    d = metersBetween(lat, lng, nl[1], nl[0]);
                                }
                                if (idx !== stepIdxRef.current) setCurrentStepIndex(idx);
                                setDistanceToNext(d);
                            }
                        }
                    }
                });
            } catch (e) {
                console.error("Tracking failed:", e);
            }
        };

        const timer = setTimeout(startTracking, 1000);
        return () => {
            clearTimeout(timer);
            if (watchId) Geolocation.clearWatch({ id: watchId });
        };
    }, []);

    const handleRecenter = () => {
        setViewState(prev => ({
            ...prev,
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            zoom: 17,
            pitch: 0,
            bearing: 0
        }));
    };

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];
    // Maniobra que viene (coincide con la distancia en vivo al siguiente giro).
    const upcomingStep = steps[currentStepIndex + 1] || steps[currentStepIndex];

    // POIs cosméticos eliminados: hacían un Search Box (billable) por cada
    // cambio de origin buscando una etiqueta de UI. Solo pintaban pines grises
    // genéricos, sin valor real, y disparaban coste en cada navegación.
    const nearbyPOIs: any[] = [];

    if (isLoading) {
        return (
            <div className="h-full w-full bg-[#0d0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-white text-xl font-bold">{t('navigation.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-background-dark flex flex-col font-display overflow-hidden relative">

            {/* Removed ugly top header per request */}

            {/* Map Area */}
            <div className="flex-1 relative">
                <Map
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    mapStyle="mapbox://styles/mapbox/navigation-night-v1"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                    attributionControl={false}
                >
                    <RouteLine id="navigation-route" coordinates={routeGeometry || []} color={ROUTE_COLORS.safe} isSelected={true} />
                    <IncidenceZones zones={barcelonaIncidenceZones} />

                    {/* POI Icons on Map */}
                    {nearbyPOIs.map(poi => (
                        <Marker key={poi.id} latitude={poi.lat} longitude={poi.lng} anchor="center">
                            <div className="size-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/50 shadow-lg">
                                <span className="material-symbols-outlined text-base">place</span>
                            </div>
                        </Marker>
                    ))}

                    {/* Marcador propio: nunca desaparece al recentrar y no depende
                        del estado interno del GeolocateControl de Mapbox. */}
                    <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
                        <div className="relative size-7" aria-label={t('navigation.your_location', 'Tu ubicación')}>
                            <div className="absolute inset-0 rounded-full bg-blue-500/35 animate-ping" />
                            <div className="absolute inset-1 rounded-full bg-blue-500 border-[3px] border-white shadow-lg" />
                        </div>
                    </Marker>

                    {/* Default Mapbox Popup for Instructions */}
                    <Popup
                        latitude={userLocation.lat}
                        longitude={userLocation.lng}
                        anchor="bottom"
                        offset={30}
                        closeButton={false}
                        closeOnClick={false}
                        style={{ padding: 0, borderRadius: '1rem', overflow: 'hidden' }}
                    >
                        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl max-w-[280px] shadow-xl">
                            <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">
                                    {upcomingStep ? getManeuverIcon(upcomingStep.maneuver.type, upcomingStep.maneuver.modifier) : 'straight'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-lg font-black text-zinc-900 leading-tight tracking-tight">
                                    {distanceToNext != null
                                        ? formatDistance(distanceToNext)
                                        : (upcomingStep ? formatDistance(upcomingStep.distance) : '--')}
                                </p>
                                <p className="text-xs font-semibold text-zinc-500 leading-tight">
                                    {upcomingStep?.maneuver.instruction || t('navigation.continue_straight')}
                                </p>
                            </div>
                        </div>
                    </Popup>

                    <Marker latitude={destination.lat} longitude={destination.lng} anchor="bottom">
                        <div className="flex flex-col items-center">
                            <div className="size-8 bg-primary rounded-full border-3 border-white shadow-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    flag
                                </span>
                            </div>
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white -mt-0.5" />
                        </div>
                    </Marker>
                </Map>

                {/* Floating Map Controls */}
                <div
                    className="absolute right-4 flex flex-col gap-3 z-20"
                    style={{ top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}
                >
                    <button 
                        onClick={handleRecenter}
                        className="size-14 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl">my_location</span>
                    </button>

                    <button 
                        onClick={() => setShowReportDangerModal(true)}
                        className="size-14 bg-safety-orange rounded-2xl shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl font-black">shield</span>
                    </button>

                </div>
            </div>

            {/* Bottom Info & Action Bar - FLOATING ABOVE NAV */}
            <div className="absolute bottom-[20px] left-4 right-4 z-30 space-y-3">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex items-center justify-between">
                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{formatDuration(totalDuration)}</span>
                            <span className="text-sm text-white/40 font-medium">({formatDistance(totalDistance)})</span>
                        </div>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-wider mt-1">{t('navigation.arrival', { time: eta })}</p>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="h-14 px-6 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-2xl flex items-center justify-center gap-2 border border-red-500/30 transition-all active:scale-95 shadow-lg"
                    >
                        <span className="material-symbols-outlined font-black">cancel</span>
                        <span className="font-black uppercase text-sm tracking-tighter">{t('navigation.finish')}</span>
                    </button>
                </div>
            </div>

            <ReportDangerModal 
                isOpen={showReportDangerModal} 
                onClose={() => setShowReportDangerModal(false)} 
                userLat={userLocation.lat} 
                userLng={userLocation.lng} 
            />
        </div>
    );
};



// Page wrapper for routing
export const Navigation: React.FC = () => {
    const { t } = useTranslation();
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
            destinationName={state.destinationName || t('navigation.destination')}
            transportMode={state.transportMode || 'walking'}
            precomputed={state.precomputed}
            onClose={() => navigate('/')}
        />
    );
};
