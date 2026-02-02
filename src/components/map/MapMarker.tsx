import React from 'react';
import { Marker } from 'react-map-gl/mapbox';

interface FamilyMember {
    id: number;
    name: string;
    avatar: string;
    lat: number;
    lng: number;
    isEmergency?: boolean;
    lastUpdate?: string;
}

interface MapMarkerProps {
    member: FamilyMember;
    onClick?: () => void;
}

export const MapMarker: React.FC<MapMarkerProps> = ({ member, onClick }) => {
    return (
        <Marker
            latitude={member.lat}
            longitude={member.lng}
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick?.();
            }}
        >
            <div className="flex flex-col items-center cursor-pointer group">
                {/* Avatar container */}
                <div className="relative">
                    {/* Emergency pulse effects */}
                    {member.isEmergency && (
                        <>
                            <div className="absolute -inset-3 bg-primary/20 rounded-full animate-ping" />
                            <div className="absolute -inset-6 bg-primary/10 rounded-full animate-pulse" />
                        </>
                    )}

                    {/* Avatar */}
                    <div className={`
                        relative size-12 rounded-full border-[3px] flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110
                        ${member.isEmergency
                            ? 'border-primary bg-background-dark shadow-[0_0_15px_rgba(255,49,49,0.5)]'
                            : 'border-white bg-gray-200'
                        }
                    `}>
                        <span className="text-2xl">{member.avatar}</span>
                    </div>

                    {/* Pin point */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white drop-shadow-sm" />

                    {/* SOS Badge */}
                    {member.isEmergency && (
                        <div className="absolute -top-3 -right-2 bg-primary text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm border border-white/20 flex items-center gap-0.5 animate-bounce">
                            <span className="material-symbols-outlined text-[8px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            SOS
                        </div>
                    )}
                </div>

                {/* Name label */}
                <div className="mt-1.5 flex flex-col items-center">
                    <div className={`
                        backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md border
                        ${member.isEmergency
                            ? 'bg-primary/90 text-white border-white/10'
                            : 'bg-white/90 text-gray-900 border-gray-100/50'
                        }
                    `}>
                        {member.name}
                    </div>
                    {member.lastUpdate && !member.isEmergency && (
                        <div className="text-[9px] text-gray-600 font-medium mt-0.5 bg-white/80 px-1.5 rounded">
                            {member.lastUpdate}
                        </div>
                    )}
                </div>
            </div>
        </Marker>
    );
};
