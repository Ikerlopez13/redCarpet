// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Geolocation } from '@capacitor/geolocation';

import Map, { Marker, Popup, GeolocateControl } from 'react-map-gl/mapbox';
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
    const [viewState, setViewState] = useState({
        latitude: origin.lat,
        longitude: origin.lng,
        zoom: 18,
        bearing: 0,
        pitch: 60
    });
    const [userLocation, setUserLocation] = useState({ lat: origin.lat, lng: origin.lng });
    const geoControlRef = React.useRef<any>(null);

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
                
                // Set initial view focusing on the first step
                setViewState(prev => ({
                    ...prev,
                    latitude: origin.lat,
                    longitude: origin.lng
                }));
            }
            setIsLoading(false);
        };
        fetchRoute();
        
        // Trigger native mapbox tracking on mount
        setTimeout(() => {
            geoControlRef.current?.trigger();
        }, 500);
    }, [origin, destination, transportMode]);

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
                        setUserLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                        // Removed forcing setViewState here so the map doesn't fight native GeolocateControl
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
            zoom: 17,
            pitch: 0, // Vista cenital (plana)
            bearing: 0 // Mirando al norte
        }));
        geoControlRef.current?.trigger();
    };

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    // Fetch POIs nearby for the map icons
    const [nearbyPOIs, setNearbyPOIs] = useState<any[]>([]);
    useEffect(() => {
        const fetchPOIs = async () => {
            const results = await searchPlaces('lugares de interés', { lat: origin.lat, lng: origin.lng });
            setNearbyPOIs(results);
        };
        fetchPOIs();
    }, [origin]);

    if (isLoading) {
        return (
            <div className="h-full w-full bg-[#0d0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-white text-xl font-bold">Preparando tu ruta segura...</p>
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
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                    attributionControl={false}
                >
                    <RouteLine id="navigation-route" coordinates={routeGeometry || []} color={ROUTE_COLORS.safe} isSelected={true} />
                    <DangerZones zones={barcelonaDangerZones} />

                    {/* POI Icons on Map */}
                    {nearbyPOIs.map(poi => (
                        <Marker key={poi.id} latitude={poi.lat} longitude={poi.lng} anchor="center">
                            <div className="size-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/50 shadow-lg">
                                <span className="material-symbols-outlined text-base">place</span>
                            </div>
                        </Marker>
                    ))}

                    {/* Native Mapbox Geolocation & Tracking Control */}
                    <GeolocateControl
                        ref={geoControlRef}
                        position="top-right"
                        trackUserLocation={true}
                        showUserLocation={true}
                        showUserHeading={true}
                        style={{ display: 'none' }} // Hidden visually but logic runs internally
                    />

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
                                    {currentStep ? getManeuverIcon(currentStep.maneuver.type, currentStep.maneuver.modifier) : 'straight'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-lg font-black text-zinc-900 leading-tight tracking-tight">
                                    {currentStep ? formatDistance(currentStep.distance) : '--'}
                                </p>
                                <p className="text-xs font-semibold text-zinc-500 leading-tight">
                                    {currentStep?.maneuver.instruction || 'Sigue recto'}
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
                <div className="absolute right-4 top-4 flex flex-col gap-3">
                    <button 
                        onClick={handleRecenter}
                        className="size-14 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl">my_location</span>
                    </button>
                    <button className="size-14 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-2xl">volume_up</span>
                    </button>
                    <button 
                        onClick={() => window.location.href = '/report'}
                        className="size-14 bg-amber-500 rounded-2xl shadow-2xl flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-2xl font-black">warning</span>
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
                        <p className="text-xs text-white/40 font-bold uppercase tracking-wider mt-1">Llegada a las {eta}</p>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="h-14 px-6 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-2xl flex items-center justify-center gap-2 border border-red-500/30 transition-all active:scale-95 shadow-lg"
                    >
                        <span className="material-symbols-outlined font-black">cancel</span>
                        <span className="font-black uppercase text-sm tracking-tighter">Finalizar</span>
                    </button>
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
