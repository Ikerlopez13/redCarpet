// @ts-nocheck
import React from 'react';
import { Marker } from 'react-map-gl/mapbox';

interface FamilyMember {
    id: string | number;
    name: string;
    avatar: string;
    avatarUrl?: string | null;
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
                <div className="relative">
                    {/* Apple Maps Style Pin Shape */}
                    <div className="relative">
                        {/* Pulse effect for emergency */}
                        {member.isEmergency && (
                            <div className="absolute inset-0 bg-primary/40 rounded-full animate-ping -z-10" />
                        )}

                        {/* Main Pin Container */}
                        <div className={`
                            relative size-12 rounded-full border-[3px] flex items-center justify-center shadow-xl transition-all duration-300 group-hover:scale-110
                            ${member.isEmergency
                                ? 'border-primary bg-background-dark shadow-[0_4px_20px_rgba(255,49,49,0.4)]'
                                : 'border-white bg-[#2c2c2c] shadow-[0_4px_12px_rgba(0,0,0,0.3)]'
                            }
                        `}>
                            {/* Inner Circle / Image Area */}
                            <div className="size-full rounded-full overflow-hidden flex items-center justify-center p-0.5">
                                {member.avatarUrl ? (
                                    <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <span className="text-xl">{member.avatar}</span>
                                )}
                            </div>

                            {/* Apple Maps characteristic "tail" */}
                            <div className={`
                                absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r-[3px] border-b-[3px] -z-10
                                ${member.isEmergency ? 'bg-background-dark border-primary' : 'bg-[#2c2c2c] border-white'}
                            `} />
                        </div>

                        {/* SOS Indicator */}
                        {member.isEmergency && (
                            <div className="absolute -top-3 -right-3 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-lg border-2 border-white flex items-center gap-0.5 animate-bounce">
                                <span className="material-symbols-outlined text-[10px] fill-current">warning</span>
                                SOS
                            </div>
                        )}
                    </div>
                </div>

                {/* Apple Maps style label */}
                <div className="mt-3 flex flex-col items-center pointer-events-none">
                    <div className={`
                        px-3 py-1 rounded-full text-[11px] font-bold shadow-lg border backdrop-blur-md transition-colors
                        ${member.isEmergency
                            ? 'bg-primary/95 text-white border-white/10'
                            : 'bg-black/70 text-white border-white/10'
                        }
                    `}>
                        {member.name}
                    </div>
                    {member.lastUpdate && !member.isEmergency && (
                        <div className="text-[9px] text-white/50 font-semibold mt-1 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {member.lastUpdate}
                        </div>
                    )}
                </div>
            </div>
        </Marker>
    );
};
