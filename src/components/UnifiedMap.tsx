// @ts-nocheck
import React, { useCallback, useState, useEffect, useRef } from 'react';
import Map, { NavigationControl, GeolocateControl, Marker } from 'react-map-gl/mapbox';
import clsx from 'clsx';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapMarker } from './map/MapMarker';
import { DangerZones } from './map/DangerZone';
import { RouteLine, ROUTE_COLORS } from './map/RouteLine';
import { TransitLayer } from './map/TransitMarkers';
import { POILayer } from './map/POIMarker';
import { SafeZones } from './map/SafeZone';
import { LOCATIONS } from '../services/directionsService';
import { getNearbyBusStops, getNearbyMetroStations, type BusStop, type MetroStation } from '../services/tmbService';
import { getNearbyPOIs, type POI } from '../services/poiService';
import { getSafeZones, type SafeZone } from '../services/locationService';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../services/supabaseClient';
import type { DangerZone } from '../services/database.types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default location: Felipe II 229, Barcelona (Sant Martí district)
const DEFAULT_VIEW = {
    latitude: 41.4088,
    longitude: 2.1890,
    zoom: 16
};

// Barcelona danger zones
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

export interface MapMember {
    id: string; // Changed from string | number to string to match FamilyMember
    name: string;
    avatar: string;
    avatarUrl?: string | null;
    lat: number;
    lng: number;
    lastUpdate?: string;
    isEmergency?: boolean;
}

export interface RouteGeometry {
    safe: [number, number][] | null;
    balanced: [number, number][] | null;
    fast: [number, number][] | null;
}

interface UnifiedMapProps {
    children?: React.ReactNode;
    className?: string;
    showMarkers?: boolean;
    familyMembers?: MapMember[];
    showDangerZones?: boolean;
    showRoutes?: boolean;
    showTransit?: boolean;
    showPOIs?: boolean;
    onPOIClick?: (poi: POI) => void;
    onMemberClick?: (memberId: string) => void;
    transportMode?: 'walking' | 'cycling' | 'transit';
    selectedRoute?: 'safe' | 'balanced' | 'fast' | null;
    routeGeometry?: RouteGeometry;
    origin?: { lat: number; lng: number };
    destination?: { lat: number; lng: number };
}

export const UnifiedMap: React.FC<UnifiedMapProps> = ({
    children,
    className,
    showMarkers = true,
    familyMembers = [],
    showDangerZones = true,
    showRoutes = false,
    showTransit = false,
    showPOIs = false,
    onPOIClick,
    onMemberClick,
    transportMode = 'walking',
    selectedRoute = 'safe',
    routeGeometry,
    origin,
    destination
}) => {
    const [showTraffic, setShowTraffic] = useState(true);
    const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
    const [viewState, setViewState] = useState({ ...DEFAULT_VIEW, pitch: 0, bearing: 0 });
    const [busStops, setBusStops] = useState<BusStop[]>([]);
    const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
    const [pois, setPois] = useState<POI[]>([]);
    const [dangerZones, setDangerZones] = useState<any[]>([]);
    const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
    const [is3D, setIs3D] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; heading: number | null }>({ lat: DEFAULT_VIEW.latitude, lng: DEFAULT_VIEW.longitude, heading: null });
    const geoControlRef = useRef<any>(null);

    // Fetch Danger Zones from Supabase
    useEffect(() => {
        const fetchDangerZones = async () => {
            try {
                const { data, error } = await supabase
                    .from('danger_zones')
                    .select('*')
                    .or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    const mappedZones = data.map((zone: DangerZone) => ({
                        id: zone.id,
                        lat: zone.lat,
                        lng: zone.lng,
                        radius: zone.radius,
                        label: zone.description || (zone.type === 'dark' ? 'Poca luz' : 
                                                   zone.type === 'incident' ? 'Incidente' : 
                                                   zone.type === 'construction' ? 'Obras' : 
                                                   zone.type === 'traffic' ? 'Tráfico' : 'Peligro')
                    }));
                    setDangerZones(mappedZones);
                } else {
                    // Force demo zones if DB is empty so the user sees the "Red Circles" immediately
                    setDangerZones(barcelonaDangerZones);
                }
            } catch (err) {
                console.error("Error fetching danger zones:", err);
                setDangerZones(barcelonaDangerZones);
            }
        };

        fetchDangerZones();

        // Subscribe to real-time updates for danger zones
        const subscription = supabase
            .channel('danger-zones-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'danger_zones' }, (payload) => {
                console.log('Real-time danger zone update:', payload);
                fetchDangerZones();
            })
            .subscribe();

        // Fetch Safe Zones
        const fetchSafeZones = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: membership } = await supabase
                    .from('family_members')
                    .select('group_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (membership?.group_id) {
                    const zones = await getSafeZones(membership.group_id);
                    setSafeZones(zones);
                }
            } catch (err) {
                console.error("Error fetching safe zones:", err);
            }
        };

        fetchSafeZones();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Auto trigger geolocation and custom watch on load
    useEffect(() => {
        let watchId: string | null = null;
        
        const initLocation = async () => {
            try {
                // Get initial position safely to center the map immediately
                if (Capacitor.isNativePlatform()) {
                    await Geolocation.requestPermissions();
                    const initialPos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
                    if (initialPos) {
                        const lat = initialPos.coords.latitude;
                        const lng = initialPos.coords.longitude;
                        const heading = initialPos.coords.heading;
                        setUserLocation({ lat, lng, heading });
                        setViewState(prev => ({ ...prev, latitude: lat, longitude: lng, zoom: 16 }));
                    }

                    // Start tracking location natively to update the blue dot
                    watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
                        if (position) {
                            setUserLocation({
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                heading: position.coords.heading
                            });
                        }
                    });
                } else {
                    // Web fallback using browser Geolocation API
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            const heading = position.coords.heading;
                            setUserLocation({ lat, lng, heading });
                            setViewState(prev => ({ ...prev, latitude: lat, longitude: lng, zoom: 16 }));
                        },
                        (err) => console.warn('Web geolocation failed:', err),
                        { enableHighAccuracy: true, timeout: 10000 }
                    );

                    const id = navigator.geolocation.watchPosition(
                        (position) => {
                            setUserLocation({
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                heading: position.coords.heading
                            });
                        },
                        (err) => console.warn('Web geolocation watch failed:', err),
                        { enableHighAccuracy: true }
                    );
                    watchId = id.toString();
                }
                
                // Still trigger Mapbox's control just in case they like the compass functionality
                geoControlRef.current?.trigger();
            } catch (e) {
                console.error("Permission request or location error:", e);
            }
        };

        const timer = setTimeout(initLocation, 500);
        
        return () => {
            clearTimeout(timer);
            if (watchId) {
                if (Capacitor.isNativePlatform()) {
                    Geolocation.clearWatch({ id: watchId });
                } else {
                    navigator.geolocation.clearWatch(parseInt(watchId));
                }
            }
        };
    }, []);

    const toggle3D = useCallback(() => {
        setIs3D(prev => {
            const next3D = !prev;
            setViewState(curr => ({
                ...curr,
                pitch: next3D ? 60 : 0
            }));
            return next3D;
        });
    }, []);

    const recenterToUser = useCallback(() => {
        if (userLocation) {
            setViewState(prev => ({
                ...prev,
                latitude: userLocation.lat,
                longitude: userLocation.lng,
                zoom: 18, // Zoom in for "Grandmother-friendly" detail
                pitch: 0,  // Force cenital view
                bearing: 0 // Reset rotation to North
            }));
            setIs3D(false);
            // Also trigger the geolocate control for the native compass if available
            geoControlRef.current?.trigger();
        }
    }, [userLocation]);

    // Fetch transit stops when showTransit is enabled
    useEffect(() => {
        if (showTransit && transportMode === 'transit') {
            const fetchTransit = async () => {
                const [stops, stations] = await Promise.all([
                    getNearbyBusStops(DEFAULT_VIEW.latitude, DEFAULT_VIEW.longitude, 600),
                    getNearbyMetroStations(DEFAULT_VIEW.latitude, DEFAULT_VIEW.longitude, 1000)
                ]);
                setBusStops(stops);
                setMetroStations(stations);
            };
            fetchTransit();
        }
    }, [showTransit, transportMode]);

    // Fetch POIs when showPOIs is enabled (Dynamic loading)
    useEffect(() => {
        if (showPOIs) {
            const timer = setTimeout(async () => {
                // Fetch using current view center, not default
                console.log('Fetching POIs for:', viewState.latitude, viewState.longitude);
                const nearbyPOIs = await getNearbyPOIs(viewState.latitude, viewState.longitude, 1500); // Increased radius to 1.5km
                console.log('Fetched POIs:', nearbyPOIs.length);
                setPois(nearbyPOIs);
            }, 300); // Debounce 300ms

            return () => clearTimeout(timer);
        }
    }, [showPOIs, viewState.latitude, viewState.longitude]); // Depend on view center

    // Force cenital view (2D) when showing routes
    useEffect(() => {
        if (showRoutes && routeGeometry) {
            setViewState(prev => ({
                ...prev,
                pitch: 0,
                bearing: 0
            }));
            setIs3D(false);
        }
    }, [showRoutes, routeGeometry]);

    const handleMarkerClick = useCallback((memberId: string) => {
        // Handle family member marker click
        console.log('Member clicked:', memberId);
        onMemberClick?.(memberId);
    }, [onMemberClick]);

    return (
        <div className={clsx("relative w-full h-full overflow-hidden", className)}>
            <Map
                {...viewState}
                onMove={evt => setViewState({
                    ...evt.viewState,
                    zoom: 16 // Force constant zoom
                })}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                logoPosition="bottom-left"
                scrollZoom={true}
                doubleClickZoom={true}
                touchZoomRotate={true}
                dragRotate={false}
                pitchWithRotate={false}
                dragPan={true}
                touchPitch={false}
            >

                {/* Map UI Cleaned up as requested */}

                {/* Waze-style Incident Confirmation HUD */}
                {activeZoneId && (
                    <div className="absolute bottom-24 left-4 right-4 z-50 animate-slide-up">
                        <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-hidden relative">
                            {/* Glowing Background Accent */}
                            <div className="absolute -top-12 -right-12 size-24 bg-red-600/20 blur-[30px] rounded-full" />
                            
                            <div className="flex items-start gap-4 mb-6">
                                <div className="size-12 rounded-2xl bg-red-600/20 flex items-center justify-center text-red-500 shrink-0">
                                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-black text-lg uppercase tracking-tighter italic">
                                        {barcelonaDangerZones.find(z => z.id === activeZoneId)?.label || 'Incidente Detectado'}
                                    </h3>
                                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">¿Sigue este peligro aquí?</p>
                                </div>
                                <button 
                                    onClick={() => setActiveZoneId(null)}
                                    className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        // Logic to record confirmation would go here
                                        setActiveZoneId(null);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-green-500 text-white rounded-2xl font-black uppercase tracking-tighter italic shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-xl">check_circle</span>
                                    SÍ, SIGUE AQUÍ
                                </button>
                                <button
                                    onClick={() => {
                                        // Logic to record removal would go here
                                        setActiveZoneId(null);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-tighter italic hover:bg-white/10 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-xl">block</span>
                                    YA NO ESTÁ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            
            {/* Nav controls */}
                {/* Nav controls cleaned up */}
                <GeolocateControl
                    ref={geoControlRef}
                    position="top-left"
                    trackUserLocation
                    showUserHeading
                />

                {/* Danger Zones Layer */}
                {showDangerZones && (
                    <DangerZones 
                        zones={barcelonaDangerZones.map(z => ({
                            ...z,
                            onClick: (id) => setActiveZoneId(id)
                        }))} 
                    />
                )}
                {showDangerZones && dangerZones.length > 0 && (
                    <DangerZones key={`zones-${dangerZones.length}`} zones={dangerZones} />
                )}

                {/* Safe Zones Layer - Green Circles */}
                {safeZones.length > 0 && (
                    <SafeZones zones={safeZones} />
                )}

                {/* Transit Layer - Bus Stops & Metro Stations */}
                {showTransit && transportMode === 'transit' && (
                    <TransitLayer
                        busStops={busStops}
                        metroStations={metroStations}
                        showBus={true}
                        showMetro={true}
                    />
                )}

                {/* POI Layer - Points of Interest */}
                {showPOIs && pois.length > 0 && onPOIClick && (
                    <POILayer pois={pois} onPOIClick={onPOIClick} />
                )}

                {/* Route Lines from Directions API */}
                {showRoutes && routeGeometry && (
                    <>
                        {/* Safe route */}
                        {routeGeometry.safe && (
                            <RouteLine
                                id="route-safe"
                                coordinates={routeGeometry.safe}
                                color={ROUTE_COLORS.safe}
                                isSelected={selectedRoute === 'safe'}
                            />
                        )}
                        {/* Balanced route */}
                        {routeGeometry.balanced && (
                            <RouteLine
                                id="route-balanced"
                                coordinates={routeGeometry.balanced}
                                color={ROUTE_COLORS.balanced}
                                isSelected={selectedRoute === 'balanced'}
                            />
                        )}
                        {/* Fast route */}
                        {routeGeometry.fast && (
                            <RouteLine
                                id="route-fast"
                                coordinates={routeGeometry.fast}
                                color={ROUTE_COLORS.fast}
                                isSelected={selectedRoute === 'fast'}
                            />
                        )}
                    </>
                )}

                {/* Custom User Location Marker with Heading Indicator */}
                {userLocation && (
                    <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
                        <div className="relative flex items-center justify-center">
                            {/* Heading Arrow (Sleek Directional Indicator) */}
                            {userLocation.heading !== null && (
                                <div 
                                    className="absolute -top-[1.2rem] transition-transform duration-300 pointer-events-none"
                                    style={{ transform: `rotate(${userLocation.heading}deg)` }}
                                >
                                    {/* Traditional directional arrow */}
                                    <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-blue-600 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                                </div>
                            )}

                            {/* Main Blue Dot */}
                            <div className="relative">
                                <div className="size-5 bg-blue-500 rounded-full border-[3px] border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] z-50 pointer-events-none" />
                                <div className="absolute inset-0 size-5 bg-blue-500 rounded-full animate-ping opacity-30" />
                            </div>
                        </div>
                    </Marker>
                )}

                {/* Origin Marker */}
                {showRoutes && origin && origin.lat && origin.lng && (
                    <Marker latitude={origin.lat} longitude={origin.lng} anchor="center">
                        <div className="relative">
                            <div className="size-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                            <div className="absolute inset-0 size-4 bg-blue-500 rounded-full animate-ping opacity-50" />
                        </div>
                    </Marker>
                )}

                {/* Destination Marker */}
                {showRoutes && destination && destination.lat && destination.lng && (
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
                )}

                {/* Family Member Markers */}
                {showMarkers && familyMembers.map(member => (
                    <MapMarker
                        key={member.id}
                        member={member}
                        onClick={() => handleMarkerClick(member.id)}
                    />
                ))}
            </Map>

            {/* Children Content - High z-index for UI widgets */}
            <div className="absolute inset-0 z-20 w-full h-full pointer-events-none">
                <div className="w-full h-full *:pointer-events-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Export locations for use in other components
export { LOCATIONS };
