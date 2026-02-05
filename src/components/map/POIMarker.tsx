import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import type { POI } from '../../services/poiService';

interface POIMarkerProps {
    poi: POI;
    onClick: (poi: POI) => void;
}

// Category color mapping for a more vibrant look
const categoryColors: Record<string, { bg: string; icon: string; glow: string }> = {
    restaurant: { bg: 'from-orange-500 to-red-500', icon: 'text-white', glow: 'shadow-orange-500/50' },
    cafe: { bg: 'from-amber-500 to-orange-500', icon: 'text-white', glow: 'shadow-amber-500/50' },
    shop: { bg: 'from-blue-500 to-indigo-500', icon: 'text-white', glow: 'shadow-blue-500/50' },
    park: { bg: 'from-green-500 to-emerald-500', icon: 'text-white', glow: 'shadow-green-500/50' },
    hospital: { bg: 'from-red-500 to-pink-500', icon: 'text-white', glow: 'shadow-red-500/50' },
    pharmacy: { bg: 'from-emerald-500 to-teal-500', icon: 'text-white', glow: 'shadow-emerald-500/50' },
    gym: { bg: 'from-purple-500 to-violet-500', icon: 'text-white', glow: 'shadow-purple-500/50' },
    bar: { bg: 'from-violet-500 to-purple-500', icon: 'text-white', glow: 'shadow-violet-500/50' },
    hotel: { bg: 'from-indigo-500 to-blue-500', icon: 'text-white', glow: 'shadow-indigo-500/50' },
};

const defaultColors = { bg: 'from-zinc-600 to-zinc-700', icon: 'text-white', glow: 'shadow-zinc-500/50' };

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
                className="cursor-pointer transition-all duration-200 hover:scale-110 hover:-translate-y-1 active:scale-95"
                title={poi.name}
            >
                {/* Pin shape with gradient */}
                <div className={`relative flex flex-col items-center`}>
                    {/* Main marker body */}
                    <div className={`
                        size-10 rounded-2xl bg-gradient-to-br ${colors.bg}
                        flex items-center justify-center
                        shadow-lg ${colors.glow}
                        border border-white/20
                        backdrop-blur-sm
                    `}>
                        <span
                            className={`material-symbols-outlined ${colors.icon} text-lg`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            {poi.categoryIcon}
                        </span>
                    </div>

                    {/* Pin tail */}
                    <div className={`
                        w-0 h-0 -mt-1
                        border-l-[6px] border-l-transparent
                        border-r-[6px] border-r-transparent
                        border-t-[8px] border-t-white/30
                    `} />
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
