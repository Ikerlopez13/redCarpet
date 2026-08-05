import React, { useMemo } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { useTranslation } from 'react-i18next';

interface IncidenceZoneProps {
    id: string;
    lat: number;
    lng: number;
    radius?: number;
    title?: string;
    label?: string;
    description?: string;
    type?: string;
    color?: string;
    onClick?: (id: string) => void;
}

interface IncidenceZonesProps {
    zones: IncidenceZoneProps[];
}

const createGeoJSONCircle = (lat: number, lng: number, radiusInMeters: number, color: string) => {
    const points = 64;
    const km = radiusInMeters / 1000;
    const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180));
    const distanceY = km / 110.574;

    const coordinates = [];
    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        coordinates.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
    }
    coordinates.push(coordinates[0]);

    return {
        type: 'Feature',
        properties: { color },
        geometry: { type: 'Polygon', coordinates: [coordinates] }
    };
};

export const IncidenceZones: React.FC<IncidenceZonesProps> = ({ zones }) => {
    const { t } = useTranslation();

    const geojson = useMemo(() => ({
        type: 'FeatureCollection',
        features: zones.map(zone =>
            createGeoJSONCircle(zone.lat, zone.lng, zone.radius || 20, zone.color || '#f59e0b')
        )
    }), [zones]);

    return (
        <>
            <Source id="incidence-zones-source" type="geojson" data={geojson as any}>
                <Layer
                    id="incidence-zones-fill"
                    type="fill"
                    paint={{
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.18
                    }}
                />
                <Layer
                    id="incidence-zones-line"
                    type="line"
                    paint={{
                        'line-color': ['get', 'color'],
                        'line-width': 2,
                        'line-opacity': 0.5
                    }}
                />
            </Source>

            {zones.map(zone => {
                const c = zone.color || '#f59e0b';
                return (
                    <Marker
                        key={zone.id}
                        latitude={zone.lat}
                        longitude={zone.lng}
                        anchor="center"
                    >
                        <div
                            className="flex flex-col items-center gap-1.5 pointer-events-auto cursor-pointer group"
                            onClick={(e) => {
                                e.stopPropagation();
                                zone.onClick?.(zone.id);
                            }}
                        >
                            <div
                                className="relative size-11 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                                style={{
                                    backgroundColor: '#111',
                                    border: `2px solid ${c}`,
                                    boxShadow: `0 0 14px ${c}55`
                                }}
                            >
                                <div
                                    className="size-3 rounded-full"
                                    style={{ backgroundColor: c }}
                                />
                                <div
                                    className="absolute inset-0 rounded-full animate-pulse opacity-20 pointer-events-none"
                                    style={{ border: `1px solid ${c}` }}
                                />
                            </div>

                            <div className="bg-zinc-900/90 backdrop-blur-md px-3 py-1 rounded-full shadow-lg border border-white/10 whitespace-nowrap">
                                <span className="text-white text-[9px] font-bold uppercase tracking-wider">
                                    {zone.title || zone.label || t('map.active_zone_detected')}
                                </span>
                            </div>
                        </div>
                    </Marker>
                );
            })}
        </>
    );
};

export const defaultIncidenceZones: IncidenceZoneProps[] = [
    { id: 'zone-1', lat: 40.4200, lng: -3.7050, radius: 20, label: 'Mejora de Iluminación', color: '#eab308' },
    { id: 'zone-2', lat: 40.4180, lng: -3.7100, radius: 20, label: 'Zona de atención', color: '#ef4444' },
];
