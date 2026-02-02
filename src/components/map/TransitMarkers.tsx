import React from 'react';
import { Marker } from 'react-map-gl/mapbox';
import type { BusStop, MetroStation } from '../../services/tmbService';
import { METRO_COLORS } from '../../services/tmbService';

interface TransitStopMarkerProps {
    stop: BusStop;
    onClick?: () => void;
}

export const BusStopMarker: React.FC<TransitStopMarkerProps> = ({ stop, onClick }) => {
    return (
        <Marker
            latitude={stop.lat}
            longitude={stop.lng}
            anchor="center"
            onClick={onClick}
        >
            <div className="group relative cursor-pointer">
                {/* Bus stop icon */}
                <div className="size-7 bg-[#00A650] rounded-lg flex items-center justify-center shadow-lg border-2 border-white/80 transition-transform group-hover:scale-110">
                    <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        directions_bus
                    </span>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                    <div className="bg-zinc-900 text-white text-xs px-2 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10">
                        <p className="font-bold">{stop.name}</p>
                        {stop.description && (
                            <p className="text-gray-400 text-[10px]">{stop.description}</p>
                        )}
                    </div>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-900 mx-auto" />
                </div>
            </div>
        </Marker>
    );
};

interface MetroStationMarkerProps {
    station: MetroStation;
    lineId?: number;
    onClick?: () => void;
}

export const MetroStationMarker: React.FC<MetroStationMarkerProps> = ({ station, lineId, onClick }) => {
    const color = lineId ? METRO_COLORS[lineId] : '#E2001A';

    return (
        <Marker
            latitude={station.lat}
            longitude={station.lng}
            anchor="center"
            onClick={onClick}
        >
            <div className="group relative cursor-pointer">
                {/* Metro station icon */}
                <div
                    className="size-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-110"
                    style={{ backgroundColor: color }}
                >
                    <span className="text-white text-xs font-black">M</span>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                    <div className="bg-zinc-900 text-white text-xs px-2 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10">
                        <p className="font-bold">{station.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div
                                className="size-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                style={{ backgroundColor: color }}
                            >
                                M
                            </div>
                            <span className="text-gray-400 text-[10px]">Metro</span>
                        </div>
                    </div>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-900 mx-auto" />
                </div>
            </div>
        </Marker>
    );
};

interface TransitLayerProps {
    busStops: BusStop[];
    metroStations: MetroStation[];
    showBus?: boolean;
    showMetro?: boolean;
}

export const TransitLayer: React.FC<TransitLayerProps> = ({
    busStops,
    metroStations,
    showBus = true,
    showMetro = true
}) => {
    return (
        <>
            {showBus && busStops.map(stop => (
                <BusStopMarker key={`bus-${stop.id}`} stop={stop} />
            ))}
            {showMetro && metroStations.map(station => (
                <MetroStationMarker key={`metro-${station.id}`} station={station} />
            ))}
        </>
    );
};
