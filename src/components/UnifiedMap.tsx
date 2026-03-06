import React, { useCallback, useState, useEffect } from 'react';
import Map, { NavigationControl, GeolocateControl, Marker } from 'react-map-gl/mapbox';
import clsx from 'clsx';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapMarker } from './map/MapMarker';
import { DangerZones } from './map/DangerZone';
import { RouteLine, ROUTE_COLORS } from './map/RouteLine';
import { TransitLayer } from './map/TransitMarkers';
import { POILayer } from './map/POIMarker';
import { LOCATIONS } from '../services/directionsService';
import { getNearbyBusStops, getNearbyMetroStations, type BusStop, type MetroStation } from '../services/tmbService';
import { getNearbyPOIs, type POI } from '../services/poiService';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default location: Felipe II 229, Barcelona (Sant Martí district)
const DEFAULT_VIEW = {
    latitude: 41.4088,
    longitude: 2.1890,
    zoom: 15
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
    const [viewState, setViewState] = useState(DEFAULT_VIEW);
    const [busStops, setBusStops] = useState<BusStop[]>([]);
    const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
    const [pois, setPois] = useState<POI[]>([]);

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
            >
                {/* Navigation Controls */}
                <NavigationControl position="top-left" showCompass={false} />
                <GeolocateControl
                    position="top-left"
                    trackUserLocation
                    showUserHeading
                />

                {/* Danger Zones Layer */}
                {showDangerZones && (
                    <DangerZones zones={barcelonaDangerZones} />
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
