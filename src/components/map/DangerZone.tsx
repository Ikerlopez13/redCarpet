// @ts-nocheck
import React from 'react';
import { Marker } from 'react-map-gl/mapbox';

interface DangerZoneProps {
    id: string;
    lat: number;
    lng: number;
    radius?: number; // in meters
    label?: string;
    onClick?: (id: string) => void;
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
                    <div 
                        className="relative group flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            zone.onClick?.(zone.id);
                        }}
                    >
                        {/* Outer Pulse - The "Red Circle" requested by user */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="size-20 rounded-full bg-red-600/20 border-2 border-red-600/40 animate-pulse" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="size-32 rounded-full bg-red-600/10 animate-ping opacity-30" />
                        </div>

                        {/* Main Icon */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="size-10 rounded-full bg-black/80 border-2 border-red-600 flex items-center justify-center shadow-lg shadow-red-900/40 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    warning
                                </span>
                            </div>
                            
                            {/* Label */}
                            <div className="mt-2 px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg border border-white/20 whitespace-nowrap opacity-90">
                                {zone.label}
                            </div>
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
