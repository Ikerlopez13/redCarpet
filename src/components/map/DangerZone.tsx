import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import dangerZoneIcon from '../../assets/icons/danger-zone.svg';

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
    return (
        <>
            {zones.map(zone => (
                <Marker
                    key={zone.id}
                    latitude={zone.lat}
                    longitude={zone.lng}
                    anchor="center"
                >
                    <div className="relative group flex flex-col items-center justify-center cursor-pointer">
                        {/* Image asset for complete native Apple Maps integration capability */}
                        <img
                            src={dangerZoneIcon}
                            alt={zone.label || 'Zona Peligrosa'}
                            className="w-[96px] h-[96px] max-w-none opacity-80"
                            style={{ width: `${(zone.radius || 100) / 1.5}px`, height: `${(zone.radius || 100) / 1.5}px` }}
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-bold text-red-500 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded-full border border-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity">
                            {zone.label}
                        </div>
                    </div>
                </Marker>
            ))}
        </>
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
