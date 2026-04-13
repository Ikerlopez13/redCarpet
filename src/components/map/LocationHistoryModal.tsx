// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import type { Location } from '../../services/database.types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface LocationHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId: string;
    memberName: string;
}

export const LocationHistoryModal: React.FC<LocationHistoryModalProps> = ({ isOpen, onClose, memberId, memberName }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<number>(1); // days
    const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
    const mapContainer = "history-map-" + memberId;

    useEffect(() => {
        if (!isOpen) return;

        const fetchHistory = async () => {
            setIsLoading(true);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const { data } = await supabase
                .from('locations')
                .select('*')
                .eq('user_id', memberId)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            setLocations(data || []);
            setIsLoading(false);
        };

        fetchHistory();
    }, [isOpen, memberId, period]);

    // Initialize map
    useEffect(() => {
        if (!isOpen) return;

        // Wait a tick for container to render
        setTimeout(() => {
            const container = document.getElementById(mapContainer);
            if (!container) return;

            // mapboxgl.accessToken is assumed to be set somewhere globally like UnifiedMap
            // But let's retrieve it from env just in case.
            mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

            const initMap = new mapboxgl.Map({
                container: mapContainer,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: locations.length > 0 ? [locations[0].lng, locations[0].lat] : [2.1734, 41.3851],
                zoom: 12,
                pitch: 45
            });

            initMap.on('load', () => {
                setMapInstance(initMap);
            });

            return () => initMap.remove();
        }, 100);
    }, [isOpen]);

    // Update map data when locations change
    useEffect(() => {
        if (!mapInstance || locations.length === 0) return;

        const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: locations.map(loc => [loc.lng, loc.lat])
                    }
                }
            ]
        };

        if (mapInstance.getSource('historyRoute')) {
            (mapInstance.getSource('historyRoute') as mapboxgl.GeoJSONSource).setData(geojson);
        } else {
            mapInstance.addSource('historyRoute', {
                type: 'geojson',
                data: geojson
            });

            mapInstance.addLayer({
                id: 'historyRouteLayer',
                type: 'line',
                source: 'historyRoute',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#eab308', // primary color
                    'line-width': 5,
                    'line-opacity': 0.8
                }
            });
        }

        // Fit bounds
        const bounds = new mapboxgl.LngLatBounds(
            [locations[0].lng, locations[0].lat],
            [locations[0].lng, locations[0].lat]
        );

        locations.forEach(loc => {
            bounds.extend([loc.lng, loc.lat]);
        });

        mapInstance.fitBounds(bounds, { padding: 50 });

    }, [locations, mapInstance]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background-dark animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-background-dark z-10 shadow-md shrink-0">
                <div>
                    <h2 className="text-xl font-bold">Historial de {memberName}</h2>
                    <p className="text-sm text-white/50">Últimos {period} {period === 1 ? 'día' : 'días'}</p>
                </div>
                <button
                    onClick={onClose}
                    className="size-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Filter */}
            <div className="flex gap-2 p-4 shrink-0 overflow-x-auto no-scrollbar border-b border-white/5">
                {[1, 3, 7, 14, 30].map(days => (
                    <button
                        key={days}
                        onClick={() => setPeriod(days)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${period === days ? 'bg-primary text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                    >
                        {days} {days === 1 ? 'día' : 'días'}
                    </button>
                ))}
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-zinc-900">
                <div id={mapContainer} className="absolute inset-0 w-full h-full" />

                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <span className="text-sm font-medium text-white/80">Cargando historial...</span>
                        </div>
                    </div>
                )}

                {!isLoading && locations.length === 0 && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm px-6 text-center">
                        <span className="material-symbols-outlined text-4xl text-white/30 mb-3">location_off</span>
                        <h3 className="text-lg font-bold">Sin registros</h3>
                        <p className="text-sm text-white/60 max-w-xs mt-2">
                            No tenemos datos de ubicación guardados para {memberName} en el periodo seleccionado.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-background-dark text-xs text-white/40 text-center shrink-0">
                El historial se guarda automáticamente hasta por 30 días para usuarios Premium.
            </div>
        </div>
    );
};
