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
import { AuthorityAlerts } from './map/AuthorityAlerts';
import { LOCATIONS } from '../services/directionsService';
import { getNearbyBusStops, getNearbyMetroStations, type BusStop, type MetroStation } from '../services/tmbService';
import { getNearbyPOIs, type POI } from '../services/poiService';
import { getSafeZones, type SafeZone } from '../services/locationService';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../services/supabaseClient';
import type { DangerZone as IncidenceZone } from '../services/database.types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default location: Sagrada Familia, Barcelona (as requested to avoid doxing)
const DEFAULT_VIEW = {
    latitude: 41.4036,
    longitude: 2.1744,
    zoom: 16
};

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
    onZoneClick?: (zoneId: string) => void;
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
    destination,
    onZoneClick
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
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isTrackingUser, setIsTrackingUser] = useState(true);
    const geoControlRef = useRef<any>(null);

    useEffect(() => {
        if (isTrackingUser && userLocation) {
            setViewState(prev => ({
                ...prev,
                latitude: userLocation.lat,
                longitude: userLocation.lng
            }));
        }
    }, [userLocation, isTrackingUser]);

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
                    setIncidenceZones([]);
                }
            } catch (err) {
                console.error("Error fetching incidence zones:", err);
                setIncidenceZones([]);
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

    // Rotate map with compass ONLY during active navigation (showRoutes=true)
    useEffect(() => {
        if (!showRoutes) return;

        const handleHeading = (e: DeviceOrientationEvent) => {
            if ((e as any).webkitCompassHeading !== undefined) {
                setViewState(prev => ({ ...prev, bearing: (e as any).webkitCompassHeading }));
            } else if (e.alpha !== null) {
                setViewState(prev => ({ ...prev, bearing: 360 - e.alpha! }));
            }
        };

        window.addEventListener('deviceorientation', handleHeading, true);
        return () => window.removeEventListener('deviceorientation', handleHeading);
    }, [showRoutes]);

    // Auto trigger geolocation and custom watch on load
    useEffect(() => {
        let watchId: string | null = null;

        const initLocation = async () => {
            try {
                // Load cached location instantly so map centers immediately
                try {
                    const { value: cachedStr } = await Preferences.get({ key: 'LAST_KNOWN_LOCATION' });
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        setUserLocation({ lat: cached.lat, lng: cached.lng });
                        setViewState(prev => ({ ...prev, latitude: cached.lat, longitude: cached.lng, zoom: 17, pitch: 0 }));
                    }
                } catch { /* ignore */ }

                const status = await Geolocation.checkPermissions();
                if (status.location !== 'granted' && status.location !== 'denied') {
                    await Geolocation.requestPermissions();
                }

                // Request orientation permissions for iOS (needed for compass during navigation)
                if (Capacitor.isNativePlatform() && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                    try { await (DeviceOrientationEvent as any).requestPermission(); } catch { /* ignore */ }
                }

                const initialPos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
                if (initialPos) {
                    const { latitude, longitude } = initialPos.coords;
                    setUserLocation({ lat: latitude, lng: longitude });
                    setViewState(prev => ({ ...prev, latitude, longitude, zoom: 17, pitch: 0 }));
                    await Preferences.set({ key: 'LAST_KNOWN_LOCATION', value: JSON.stringify({ lat: latitude, lng: longitude }) });
                }

                // Continuous real-time location updates for the map display only
                watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, async (pos) => {
                    if (pos) {
                        const { latitude, longitude } = pos.coords;
                        setUserLocation({ lat: latitude, lng: longitude });
                        await Preferences.set({ key: 'LAST_KNOWN_LOCATION', value: JSON.stringify({ lat: latitude, lng: longitude }) });
                    }
                });
            } catch (e) {
                console.error("Permission request or location error:", e);
            }
        };

        initLocation();

        return () => {
            if (watchId) {
                Geolocation.clearWatch({ id: watchId });
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
        setIsTrackingUser(true);
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
        } else {
            setViewState(prev => ({ ...prev, zoom: 18, pitch: 0, bearing: 0 }));
            setIs3D(false);
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
                onMove={evt => setViewState(evt.viewState)}
                onMoveStart={evt => { if (evt.originalEvent) setIsTrackingUser(false); }}
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
            
                {/* Custom Native User Location Marker */}
                {userLocation && (
                    <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
                        <div className="relative flex items-center justify-center transition-transform duration-300">
                            <div className="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping" />
                            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.3)] z-10">
                                <div className="w-3.5 h-3.5 bg-blue-500 rounded-full" />
                            </div>
                        </div>
                    </Marker>
                )}

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
                        ].map(z => ({
                            ...z,
                            onClick: onZoneClick
                        }))} 
                    />
                )}

                {/* Safe Zones Layer - Green Circles */}
                {safeZones.length > 0 && (
                    <SafeZones zones={safeZones} />
                )}

                {/* Official authority alerts (València sandbox) — badge + violet puntos violeta */}
                <AuthorityAlerts
                    bounds={[
                        viewState.longitude - 0.05, viewState.latitude - 0.05,
                        viewState.longitude + 0.05, viewState.latitude + 0.05
                    ]}
                />

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
                                offset={-5}
                            />
                        )}
                        {/* Balanced route */}
                        {routeGeometry.balanced && (
                            <RouteLine
                                id="route-balanced"
                                coordinates={routeGeometry.balanced}
                                color={ROUTE_COLORS.balanced}
                                isSelected={selectedRoute === 'balanced'}
                                offset={0}
                            />
                        )}
                        {/* Fast route */}
                        {routeGeometry.fast && (
                            <RouteLine
                                id="route-fast"
                                coordinates={routeGeometry.fast}
                                color={ROUTE_COLORS.fast}
                                isSelected={selectedRoute === 'fast'}
                                offset={5}
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


            {/* Navigation & Location Controls */}
            <div className="absolute bottom-[35%] right-4 z-30 pointer-events-auto flex flex-col gap-3">
                <button
                    onClick={recenterToUser}
                    className={clsx(
                        "size-14 rounded-2xl border shadow-xl backdrop-blur-md flex items-center justify-center transition-all",
                        isTrackingUser 
                            ? "bg-blue-600/90 text-white border-blue-500 shadow-blue-500/20" 
                            : "bg-zinc-900/90 text-white border-white/10 hover:bg-zinc-800"
                    )}
                    title="Centrar en mi ubicación"
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
