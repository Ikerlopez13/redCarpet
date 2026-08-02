import React, { useEffect, useRef } from 'react';
import MapProvider from '../../services/mapProvider';
import type { LngLatLike } from 'mapbox-gl';

interface MapViewProps {
  /** DOM id for the map container */
  containerId?: string;
  /** Initial map center */
  center?: LngLatLike;
  /** Initial zoom level */
  zoom?: number;
  /** Callback when map is ready */
  onMapReady?: (map: any) => void;
}

/**
 * Simple wrapper component that renders a Mapbox GL map.
 * The map instance is managed by the singleton MapProvider.
 */
const MapView: React.FC<MapViewProps> = ({
  containerId = 'map-container',
  center = [0, 0],
  zoom = 2,
  onMapReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Initialize map only once
    MapProvider.initMap(containerId, center, zoom);
    const map = MapProvider.getMap();
    if (map && onMapReady) {
      onMapReady(map);
    }
    // Cleanup on unmount
    return () => {
      const m = MapProvider.getMap();
      if (m) m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id={containerId}
      ref={containerRef}
      className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
    />
  );
};

export default MapView;
