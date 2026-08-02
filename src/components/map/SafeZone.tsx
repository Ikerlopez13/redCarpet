// @ts-nocheck
import React, { useMemo } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/mapbox';

interface SafeZoneProps {
    id: string;
    lat: number;
    lng: number;
    radius?: number; // in meters
    name?: string;
}

interface SafeZonesProps {
    zones: SafeZoneProps[];
}

/**
 * Helper to generate a circle polygon for Mapbox Source
 */
const createCircleFeature = (lng: number, lat: number, radiusInMeters: number) => {
    const coords = {
        latitude: lat,
        longitude: lng
    };
    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    let theta, x, y;
    for (let i = 0; i < 64; i++) {
        theta = (i / 64) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);

        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [ret]
        }
    };
};

export const SafeZones: React.FC<SafeZonesProps> = ({ zones }) => {
    // Generate GeoJSON for all zones' radii
    const geojsonData = useMemo(() => ({
        type: 'FeatureCollection',
        features: zones.map(zone => createCircleFeature(zone.lng, zone.lat, zone.radius || 100))
    }), [zones]);

    return (
        <>
            {/* Radius Layer - Constant light green circles */}
            <Source id="safe-zones-radii" type="geojson" data={geojsonData}>
                <Layer
                    id="safe-zone-fill"
                    type="fill"
                    paint={{
                        'fill-color': '#22c55e', // green-500
                        'fill-opacity': 0.15
                    }}
                />
                <Layer
                    id="safe-zone-stroke"
                    type="line"
                    paint={{
                        'line-color': '#22c55e',
                        'line-width': 2,
                        'line-opacity': 0.4,
                        'line-dasharray': [2, 2]
                    }}
                />
            </Source>

            {/* Icon Markers */}
            {zones.map(zone => (
                <Marker
                    key={zone.id}
                    latitude={zone.lat}
                    longitude={zone.lng}
                    anchor="center"
                >
                    <div className="relative group flex items-center justify-center">
                        {/* Core Pulse Effect */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="size-6 rounded-full bg-green-500/30 animate-ping" />
                        </div>

                        {/* Main Icon */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="size-8 rounded-full bg-black/90 border-2 border-green-500 flex items-center justify-center shadow-lg shadow-green-900/40">
                                <span className="material-symbols-outlined text-green-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    verified_user
                                </span>
                            </div>
                            
                            {/* Label */}
                            <div className="mt-2 px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg border border-white/20 whitespace-nowrap opacity-90">
                                {zone.name}
                            </div>
                        </div>
                    </div>
                </Marker>
            ))}
        </>
    );
};
