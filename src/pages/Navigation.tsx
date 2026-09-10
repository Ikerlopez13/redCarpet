import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Geolocation } from '@capacitor/geolocation';
import { useTranslation } from 'react-i18next';

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteLine } from '../components/map/RouteLine';
import { getRoute, formatDuration, formatDistance, type RouteStep } from '../services/directionsService';
import { ReportDangerModal } from '../components/safety/ReportDangerModal';

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
    const [heading, setHeading] = useState(0);
    const [isFollowing, setIsFollowing] = useState(true);
    const stepsRef = useRef<RouteStep[]>([]);
    const stepIdxRef = useRef(0);
    const followingRef = useRef(true);
    useEffect(() => { stepsRef.current = steps; }, [steps]);
    useEffect(() => { stepIdxRef.current = currentStepIndex; }, [currentStepIndex]);
    useEffect(() => { followingRef.current = isFollowing; }, [isFollowing]);

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
                        const gpsHeading = position.coords.heading;
                        const nextHeading = gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0
                            ? gpsHeading
                            : null;
                        setUserLocation({ lat, lng });
                        if (nextHeading !== null) setHeading(nextHeading);
                        if (followingRef.current) {
                            setViewState(prev => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng,
                                zoom: Math.max(prev.zoom, 17.5),
                                pitch: 55,
                                bearing: nextHeading ?? prev.bearing,
                            }));
                        }

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

    // Brújula como apoyo cuando el usuario camina despacio y el GPS todavía no
    // proporciona rumbo. El marcador rota respecto al mapa, no respecto a la UI.
    useEffect(() => {
        const handleOrientation = (event: DeviceOrientationEvent) => {
            const compass = (event as any).webkitCompassHeading;
            const nextHeading = typeof compass === 'number'
                ? compass
                : (event.alpha == null ? null : 360 - event.alpha);
            if (nextHeading == null || !Number.isFinite(nextHeading)) return;
            setHeading(nextHeading);
            if (followingRef.current) {
                setViewState(prev => ({ ...prev, bearing: nextHeading }));
            }
        };
        window.addEventListener('deviceorientation', handleOrientation, true);
        return () => window.removeEventListener('deviceorientation', handleOrientation, true);
    }, []);

    const handleRecenter = () => {
        setIsFollowing(true);
        setViewState(prev => ({
            ...prev,
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            zoom: 17,
            pitch: 55,
            bearing: heading
        }));
    };

    // Maniobra que viene (coincide con la distancia en vivo al siguiente giro).
    const upcomingStep = steps[currentStepIndex + 1] || steps[currentStepIndex];
    const followingStep = steps[currentStepIndex + 2];

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
        <div className="h-full w-full bg-[#080808] font-display overflow-hidden relative">
            <div className="absolute inset-0">
                <Map
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    onMoveStart={evt => { if (evt.originalEvent) setIsFollowing(false); }}
                    mapStyle="mapbox://styles/mapbox/navigation-night-v1"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                    attributionControl={false}
                >
                    <RouteLine id="navigation-route" coordinates={routeGeometry || []} color="#FF3131" isSelected={true} />

                    {/* Marcador propio: nunca desaparece al recentrar y no depende
                        del estado interno del GeolocateControl de Mapbox. */}
                    <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
                        <div
                            className="relative size-10 flex items-center justify-center"
                            aria-label={t('navigation.your_location', 'Tu ubicación')}
                            style={{ transform: `rotate(${heading - viewState.bearing}deg)` }}
                        >
                            <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
                            <div className="relative size-8 rounded-full bg-white border-[3px] border-primary shadow-[0_4px_18px_rgba(255,49,49,0.45)] flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-[23px] leading-none">navigation</span>
                            </div>
                        </div>
                    </Marker>

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
            </div>

            {/* Maniobra principal: una sola tarjeta, legible de un vistazo. */}
            <div
                className="absolute left-3 right-3 z-30"
                style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
            >
                <div className="overflow-hidden rounded-[1.65rem] border border-white/10 bg-zinc-950/90 backdrop-blur-2xl shadow-2xl">
                    <div className="flex items-center gap-4 px-5 py-4 min-h-[108px]">
                        <span className="material-symbols-outlined text-white text-[58px] leading-none shrink-0">
                            {upcomingStep ? getManeuverIcon(upcomingStep.maneuver.type, upcomingStep.maneuver.modifier) : 'straight'}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-[34px] font-black leading-none tracking-tight">
                                {distanceToNext != null
                                    ? formatDistance(distanceToNext)
                                    : (upcomingStep ? formatDistance(upcomingStep.distance) : '--')}
                            </p>
                            <p className="mt-2 text-zinc-300 text-xl font-semibold leading-tight line-clamp-2">
                                {upcomingStep?.maneuver.instruction || t('navigation.continue_straight')}
                            </p>
                        </div>
                    </div>
                    {followingStep && (
                        <div className="flex items-center gap-3 border-t border-white/10 bg-white/[0.045] px-5 py-3">
                            <span className="material-symbols-outlined text-zinc-300 text-3xl">
                                {getManeuverIcon(followingStep.maneuver.type, followingStep.maneuver.modifier)}
                            </span>
                            <p className="text-zinc-300 text-base font-semibold truncate">
                                {followingStep.maneuver.instruction}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Solo los dos controles necesarios, separados de la instrucción. */}
            <div className="absolute right-3 top-[190px] flex flex-col gap-3 z-20">
                    <button 
                        onClick={handleRecenter}
                        className={`size-12 backdrop-blur-xl rounded-full border shadow-2xl flex items-center justify-center active:scale-95 transition-all ${isFollowing ? 'bg-primary text-white border-primary' : 'bg-zinc-950/90 text-white border-white/10'}`}
                    >
                        <span className="material-symbols-outlined text-2xl">my_location</span>
                    </button>

                    <button 
                        onClick={() => setShowReportDangerModal(true)}
                        className="size-12 bg-zinc-950/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl flex items-center justify-center text-primary active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl">report</span>
                    </button>
            </div>

            {/* Resumen inferior inspirado en navegación nativa, con branding oscuro. */}
            <div
                className="absolute left-3 right-3 z-30"
                style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
            >
                <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-[1.75rem] px-5 pt-4 pb-3 shadow-2xl">
                    <div className="grid grid-cols-3 items-start text-center">
                        <div>
                            <p className="text-white text-2xl font-black leading-tight">{eta}</p>
                            <p className="text-zinc-500 text-xs font-semibold">Llegada</p>
                        </div>
                        <div>
                            <p className="text-white text-2xl font-black leading-tight">{formatDuration(totalDuration)}</p>
                            <p className="text-zinc-500 text-xs font-semibold">Tiempo</p>
                        </div>
                        <div>
                            <p className="text-white text-2xl font-black leading-tight">{formatDistance(totalDistance)}</p>
                            <p className="text-zinc-500 text-xs font-semibold">Distancia</p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-300">{destinationName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-10 px-4 bg-primary/15 text-primary rounded-full flex items-center justify-center gap-1.5 border border-primary/30 active:scale-95 transition-transform"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                            <span className="font-bold text-sm">{t('navigation.finish')}</span>
                        </button>
                    </div>
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
