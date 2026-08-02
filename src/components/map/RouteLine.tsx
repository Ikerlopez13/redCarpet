// @ts-nocheck
import React from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';
import type { LineLayer } from 'mapbox-gl';

interface RouteLineProps {
    id: string;
    coordinates: [number, number][];
    color?: string;
    isSelected?: boolean;
    opacity?: number;
    offset?: number;
}

export const RouteLine: React.FC<RouteLineProps> = ({
    id,
    coordinates,
    color = '#FF3131',
    isSelected = false,
    opacity = 1,
    offset = 0
}) => {
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        }
    };

    // Outer glow layer for selected route
    const glowLayer: Omit<LineLayer, 'source'> = {
        id: `${id}-glow`,
        type: 'line',
        paint: {
            'line-color': color,
            'line-width': isSelected ? 12 : 0,
            'line-opacity': 0.3,
            'line-blur': 3,
            'line-offset': offset
        },
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        }
    };

    // Main route line
    const lineLayer: Omit<LineLayer, 'source'> = {
        id: `${id}-line`,
        type: 'line',
        paint: {
            'line-color': color,
            'line-width': isSelected ? 6 : 4,
            'line-opacity': isSelected ? opacity : opacity * 0.4,
            'line-dasharray': isSelected ? [1, 0] : [2, 1],
            'line-offset': offset
        },
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        }
    };

    return (
        <Source id={id} type="geojson" data={geojson}>
            {isSelected && <Layer {...glowLayer} />}
            <Layer {...lineLayer} />
        </Source>
    );
};

// Route colors for different safety levels
export const ROUTE_COLORS = {
    safe: '#10B981',      // Green
    balanced: '#F59E0B',  // Orange
    fast: '#EF4444'       // Red
};
