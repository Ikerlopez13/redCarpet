import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import Map, { NavigationControl, GeolocateControl, Marker, Source, Layer } from 'react-map-gl/mapbox';
import clsx from 'clsx';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapMarker } from './map/MapMarker';
import { IncidenceZones } from './map/IncidenceZone';
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
import type { DangerZone as IncidenceZone } from '../services/database.types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default location: Felipe II 229, Barcelona (Sant Martí district)
const DEFAULT_VIEW = {
    latitude: 41.4088,
    longitude: 2.1890,
    zoom: 16
};

// Barcelona visibility points
const barcelonaIncidencePoints = [
    {
        id: 'zone-bcn-1',
        lat: 41.4070,
        lng: 2.1850,
        radius: 80,
        titleKey: 'map.light_notice',
        descriptionKey: 'map.improve_light'
    },
    {
        id: 'zone-bcn-2',
        lat: 41.4100,
        lng: 2.1920,
        radius: 60,
        titleKey: 'map.attention_zone',
        descriptionKey: 'map.incident_road'
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
    showIncidenceZones?: boolean;
    externalIncidenceZones?: any[];
    showRoutes?: boolean;
    showTransit?: boolean;
    showPOIs?: boolean;
    onPOIClick?: (poi: POI) => void;
    onMemberClick?: (memberId: string) => void;
    transportMode?: 'walking' | 'cycling' | 'transit' | 'driving';
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
    showIncidenceZones = true,
    externalIncidenceZones = [],
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
    const { t } = useTranslation();
    const [showTraffic, setShowTraffic] = useState(true);
    const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
    const [viewState, setViewState] = useState({ ...DEFAULT_VIEW, pitch: 0, bearing: 0 });
    const [busStops, setBusStops] = useState<BusStop[]>([]);
    const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
    const [pois, setPois] = useState<POI[]>([]);
    const [incidenceZones, setIncidenceZones] = useState<any[]>([]);
    const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
    const [is3D, setIs3D] = useState(false);
    const geoControlRef = useRef<any>(null);

    // Fetch Danger Zones from Supabase
    useEffect(() => {
        const fetchIncidenceZones = async () => {
            try {
                const { data, error } = await supabase
                    .from('danger_zones')
                    .select('*')
                    .or(`expires_at.gte.${new Date().toISOString()},expires_at.is.null`);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    const mappedZones = data.map((zone: IncidenceZone) => {
                        let title = (zone.type === 'dark' ? t('map.light_notice') : 
                                     zone.type === 'incident' ? t('map.incident') : 
                                     zone.type === 'construction' ? t('map.construction') : 
                                     zone.type === 'traffic' ? t('map.traffic') : t('map.poi'));
                        let description = zone.description || t('map.active_zone_detected');
                        
                        if (zone.description && zone.description.includes(' - ')) {
                            const parts = zone.description.split(' - ');
                            title = parts[0];
                            description = parts[1];
                        }

                        return {
                            id: zone.id,
                            lat: zone.lat,
                            lng: zone.lng,
                            radius: zone.radius,
                            title,
                            description
                        };
                    });
                    setIncidenceZones(mappedZones);
                } else {
                    // Force demo zones if DB is empty
                    setIncidenceZones(barcelonaIncidencePoints);
                }
            } catch (err) {
                console.error("Error fetching incidence zones:", err);
                setIncidenceZones(barcelonaIncidencePoints);
            }
        };

        fetchIncidenceZones();

        // Subscribe to real-time updates for incidence zones
        const subscription = supabase
            .channel('danger-zones-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'danger_zones' }, (payload: any) => {
                console.log('Real-time incidence update:', payload);
                fetchIncidenceZones();
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
        
        const handleHeading = (e: DeviceOrientationEvent) => {
            if (e.webkitCompassHeading !== undefined) {
                // iOS heading
                const heading = e.webkitCompassHeading;
                setViewState(prev => ({ ...prev, bearing: heading }));
            } else if (e.alpha !== null) {
                // Android heading
                setViewState(prev => ({ ...prev, bearing: 360 - e.alpha }));
            }
        };

        const initLocation = async () => {
            try {
                if (Capacitor.isNativePlatform()) {
                    const status = await Geolocation.checkPermissions();
                    if (status.location !== 'granted' && status.location !== 'denied') {
                        await Geolocation.requestPermissions();
                    }
                    
                    // Request orientation permissions for iOS
                    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                        await (DeviceOrientationEvent as any).requestPermission();
                    }
                    
                const initialPos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
                if (initialPos) {
                    const { latitude, longitude } = initialPos.coords;
                    setViewState(prev => ({ 
                        ...prev, 
                        latitude, 
                        longitude, 
                        zoom: 17, // Start closer for better "Grandmother-friendly" feel
                        pitch: 0 
                    }));
                }

                }

                // Trigger Mapbox's control to render the native blue dot and handle tracking
                setTimeout(() => {
                    geoControlRef.current?.trigger();
                }, 500);

                // Listen for device orientation to rotate map
                window.addEventListener('deviceorientation', handleHeading, true);
            } catch (e) {
                console.error("Permission request or location error:", e);
                // Fallback to default view happens automatically as state is initialized with DEFAULT_VIEW
            }
        };

        initLocation();
        
        return () => {
            window.removeEventListener('deviceorientation', handleHeading);
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
        setViewState(prev => ({
            ...prev,
            zoom: 18, // Zoom in for "Grandmother-friendly" detail
            pitch: 0,  // Force cenital view
            bearing: 0 // Reset rotation to North
        }));
        setIs3D(false);
        // Trigger the geolocate control natively
        geoControlRef.current?.trigger();
    }, []);

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
                onMove={evt => setViewState(evt.viewState)}
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
            
            {/* Nav controls */}
                {/* Nav controls cleaned up */}
                <GeolocateControl
                    ref={geoControlRef}
                    position="top-left"
                    trackUserLocation
                    showUserHeading
                />

                {/* Incidence Zones Component - Centered Info & Absolute Size */}
                {showIncidenceZones && (
                    <IncidenceZones 
                        zones={[
                            ...barcelonaIncidencePoints.map(p => ({
                                ...p,
                                title: t(p.titleKey),
                                description: t(p.descriptionKey)
                            })),
                            ...incidenceZones,
                            ...externalIncidenceZones
                        ]} 
                    />
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

                {/* Removed Custom User Location Marker because Mapbox Handles it via GeolocateControl */}

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

            {/* Custom Recenter Button (Red, Safe Position) */}
            <div className="absolute top-[150px] right-4 z-40 pointer-events-auto">
                <button
                    onClick={recenterToUser}
                    className="size-12 bg-red-600 rounded-[1rem] border border-red-500/50 flex items-center justify-center shadow-lg shadow-red-600/30 text-white hover:bg-red-500 active:scale-90 transition-all pointer-events-auto"
                >
                    <span className="material-symbols-outlined text-2xl">my_location</span>
                </button>
            </div>

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
