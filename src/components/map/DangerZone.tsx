import React from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';
import type { CircleLayer } from 'mapbox-gl';

interface DangerZoneProps {
    id: string;
    lat: number;
    lng: number;
    radius?: number; // in meters
    label?: string;
}

interface DangerZonesProps {
    zones: DangerZoneProps[];
}

export const DangerZones: React.FC<DangerZonesProps> = ({ zones }) => {
    // Convert zones to GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: zones.map(zone => ({
            type: 'Feature',
            properties: {
                id: zone.id,
                label: zone.label || 'Zona Peligrosa',
                radius: zone.radius || 200
            },
            geometry: {
                type: 'Point',
                coordinates: [zone.lng, zone.lat]
            }
        }))
    };

    const outerLayer: Omit<CircleLayer, 'source'> = {
        id: 'danger-zones-outer',
        type: 'circle',
        paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': 'rgba(239, 68, 68, 0.15)',
            'circle-blur': 0.6,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(239, 68, 68, 0.3)'
        }
    };

    const innerLayer: Omit<CircleLayer, 'source'> = {
        id: 'danger-zones-inner',
        type: 'circle',
        paint: {
            'circle-radius': ['/', ['get', 'radius'], 2],
            'circle-color': 'rgba(239, 68, 68, 0.25)',
            'circle-blur': 0.4
        }
    };

    const pulseLayer: Omit<CircleLayer, 'source'> = {
        id: 'danger-zones-pulse',
        type: 'circle',
        paint: {
            'circle-radius': ['/', ['get', 'radius'], 4],
            'circle-color': 'rgba(239, 68, 68, 0.5)',
            'circle-blur': 0.2
        }
    };

    return (
        <Source id="danger-zones" type="geojson" data={geojson}>
            <Layer {...outerLayer} />
            <Layer {...innerLayer} />
            <Layer {...pulseLayer} />
        </Source>
    );
};

// Default danger zones for demo
export const defaultDangerZones: DangerZoneProps[] = [
    {
        id: 'zone-1',
        lat: 40.4200,
        lng: -3.7050,
        radius: 150,
        label: 'Zona Peligrosa'
    },
    {
        id: 'zone-2',
        lat: 40.4180,
        lng: -3.7100,
        radius: 100,
        label: 'Zona de Riesgo'
    }
];
