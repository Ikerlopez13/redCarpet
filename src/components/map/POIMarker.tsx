import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import type { POI } from '../../services/poiService';

interface POIMarkerProps {
    poi: POI;
    onClick: (poi: POI) => void;
}

// Category color mapping to match the provided glowing gradient style
const categoryColors: Record<string, { bg: string; icon: string; shadow: string }> = {
    restaurant: { bg: 'from-[#FF8A33] to-[#FF6B33]', icon: 'text-white', shadow: 'shadow-[#FF8A33]/60' },
    cafe: { bg: 'from-[#FFB020] to-[#FF9A20]', icon: 'text-white', shadow: 'shadow-[#FFB020]/60' },
    shop: { bg: 'from-[#4B96F3] to-[#3B82F6]', icon: 'text-white', shadow: 'shadow-[#4B96F3]/60' },
    park: { bg: 'from-[#50B657] to-[#34D399]', icon: 'text-white', shadow: 'shadow-[#50B657]/60' },
    hospital: { bg: 'from-[#FF6B6B] to-[#F43F5E]', icon: 'text-white', shadow: 'shadow-[#FF6B6B]/60' },
    pharmacy: { bg: 'from-[#47C295] to-[#10B981]', icon: 'text-white', shadow: 'shadow-[#47C295]/60' },
    gym: { bg: 'from-[#B46EE5] to-[#8B5CF6]', icon: 'text-white', shadow: 'shadow-[#B46EE5]/60' },
    bar: { bg: 'from-[#A85CD6] to-[#9333EA]', icon: 'text-white', shadow: 'shadow-[#A85CD6]/60' },
    hotel: { bg: 'from-[#3b82f6] to-[#2563eb]', icon: 'text-white', shadow: 'shadow-[#3b82f6]/60' },
};

const defaultColors = { bg: 'from-zinc-500 to-zinc-600', icon: 'text-white', shadow: 'shadow-zinc-500/60' };

export const POIMarker: React.FC<POIMarkerProps> = ({ poi, onClick }) => {
    const colors = categoryColors[poi.category] || defaultColors;

    return (
        <Marker
            latitude={poi.lat}
            longitude={poi.lng}
            anchor="bottom"
            onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClick(poi);
            }}
        >
            <div
                className="cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 flex flex-col items-center group relative"
            >
                {/* Glowing drop shadow behind the whole marker component */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full blur-[10px] bg-gradient-to-br ${colors.bg}`} />

                {/* Main circular body */}
                <div className={`
                    relative z-10 size-[32px] rounded-full flex flex-col items-center justify-center 
                    bg-gradient-to-br ${colors.bg}
                    border-[1.5px] border-white/20
                    shadow-[0_4px_12px_rgba(0,0,0,0.5)]
                `}>
                    {/* Inner highlight (Glass effect) */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

                    <span
                        className={`material-symbols-outlined text-white text-[16px] drop-shadow-sm font-extrabold`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        {poi.categoryIcon || 'place'}
                    </span>
                </div>

                {/* Small indicator triangle pointing to exact location */}
                <div className="relative z-0 -mt-1 drop-shadow-md">
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white/30" />
                </div>
            </div>
        </Marker>
    );
};

interface POILayerProps {
    pois: POI[];
    onPOIClick: (poi: POI) => void;
}

export const POILayer: React.FC<POILayerProps> = ({ pois, onPOIClick }) => {
    return (
        <>
            {pois.map(poi => (
                <POIMarker key={poi.id} poi={poi} onClick={onPOIClick} />
            ))}
        </>
    );
};
