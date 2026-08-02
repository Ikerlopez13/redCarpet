import React, { useMemo } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { Info } from 'lucide-react';
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
    onClick?: (id: string) => void;
}

interface IncidenceZonesProps {
    zones: IncidenceZoneProps[];
}

// Función para generar un círculo geográfico preciso en metros (Polygon)
const createGeoJSONCircle = (lat: number, lng: number, radiusInMeters: number) => {
    const points = 64; 
    const km = radiusInMeters / 1000;

    const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180));
    const distanceY = km / 110.574;

    const coordinates = [];
    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        coordinates.push([lng + x, lat + y]);
    }
    coordinates.push(coordinates[0]); 

    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
        }
    };
};

export const IncidenceZones: React.FC<IncidenceZonesProps> = ({ zones }) => {
    const { t } = useTranslation();
    
    // Generar la colección de polígonos (Escala real en metros)
    const geojson = useMemo(() => {
        return {
            type: 'FeatureCollection',
            features: zones.map(zone => 
                createGeoJSONCircle(zone.lat, zone.lng, zone.radius || 20)
            )
        };
    }, [zones]);

    return (
        <>
            {/* Área de incidencia - ESCALA REAL (Meters) */}
            <Source id="incidence-zones-source" type="geojson" data={geojson as any}>
                <Layer
                    id="incidence-zones-fill"
                    type="fill"
                    paint={{
                        'fill-color': '#f59e0b',
                        'fill-opacity': 0.2
                    }}
                />
                <Layer
                    id="incidence-zones-line"
                    type="line"
                    paint={{
                        'line-color': '#f59e0b',
                        'line-width': 2,
                        'line-opacity': 0.4
                    }}
                />
            </Source>

            {/* Marcadores Estilizados (Referencia Visual) */}
            {zones.map(zone => (
                <Marker
                    key={zone.id}
                    latitude={zone.lat}
                    longitude={zone.lng}
                    anchor="center"
                >
                    <div 
                        className="flex flex-col items-center gap-2 pointer-events-auto cursor-pointer group" 
                        onClick={(e) => {
                            e.stopPropagation();
                            zone.onClick?.(zone.id);
                        }}
                    >
                        {/* Círculo Central con Icono */}
                        <div className="relative size-12 rounded-full bg-zinc-900 border-[2px] border-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-transform group-hover:scale-110">
                            <Info size={20} className="text-amber-500 fill-amber-500/10" />
                            <div className="absolute inset-0 rounded-full border border-amber-500 animate-pulse opacity-20 pointer-events-none" />
                        </div>

                        {/* Etiqueta Pill Inferior */}
                        <div className="bg-zinc-900/90 backdrop-blur-md px-4 py-1 rounded-full shadow-lg border border-white/10 whitespace-nowrap text-center">
                            <span className="text-white text-[9px] font-bold uppercase tracking-wider">
                                {zone.title || zone.label || t('map.active_zone_detected')}
                            </span>
                        </div>
                    </div>
                </Marker>
            ))}
        </>
    );
};

export const defaultIncidenceZones: IncidenceZoneProps[] = [
    {
        id: 'zone-1',
        lat: 40.4200,
        lng: -3.7050,
        radius: 20,
        label: 'Mejora de Iluminación'
    },
    {
        id: 'zone-2',
        lat: 40.4180,
        lng: -3.7100,
        radius: 20,
        label: 'Zona de atención'
    }
];