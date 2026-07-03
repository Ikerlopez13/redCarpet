import React, { useEffect, useMemo, useState } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { BadgeCheck, Flower2, Ban, Lightbulb, Construction, CalendarDays, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import type { AuthorityAlert } from '../../services/citySafetyService';

// Official (authority-created) alerts, rendered visually distinct from user
// reports: institutional badge, type-specific icon, puntos violeta in violet.
// Realtime subscription + 45s polling fallback guarantee resolved alerts
// disappear from the map in well under 60s.

const REFRESH_MS = 45_000;

const TYPE_STYLE: Record<string, { color: string; Icon: React.FC<any> }> = {
    street_closed: { color: '#dc2626', Icon: Ban },
    danger_zone: { color: '#f97316', Icon: AlertTriangle },
    punto_violeta: { color: '#7c3aed', Icon: Flower2 },
    event: { color: '#0ea5e9', Icon: CalendarDays },
    poor_lighting: { color: '#eab308', Icon: Lightbulb },
    works: { color: '#a16207', Icon: Construction },
    other: { color: '#64748b', Icon: AlertTriangle }
};

function circleFeature(lat: number, lng: number, radiusM: number, color: string) {
    const points = 48;
    const km = radiusM / 1000;
    const dx = km / (111.320 * Math.cos((lat * Math.PI) / 180));
    const dy = km / 110.574;
    const ring: number[][] = [];
    for (let i = 0; i <= points; i++) {
        const t = (i / points) * 2 * Math.PI;
        ring.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)]);
    }
    return { type: 'Feature', properties: { color }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

interface Props {
    /** map viewport bounds [minLng, minLat, maxLng, maxLat] */
    bounds: [number, number, number, number] | null;
    onAlertClick?: (alert: AuthorityAlert) => void;
}

export const AuthorityAlerts: React.FC<Props> = ({ bounds: rawBounds, onAlertClick }) => {
    const [alerts, setAlerts] = useState<AuthorityAlert[]>([]);

    // Quantize to a ~2km grid: panning the map only re-fetches when the
    // viewport actually moves to a different area, not on every frame.
    const bounds = useMemo<[number, number, number, number] | null>(() => {
        if (!rawBounds) return null;
        const q = (v: number, up: boolean) => (up ? Math.ceil(v / 0.02) : Math.floor(v / 0.02)) * 0.02;
        return [q(rawBounds[0], false), q(rawBounds[1], false), q(rawBounds[2], true), q(rawBounds[3], true)];
    }, [rawBounds?.[0], rawBounds?.[1], rawBounds?.[2], rawBounds?.[3]]);

    useEffect(() => {
        if (!bounds) return;
        let cancelled = false;

        const load = async () => {
            const { data } = await supabase.rpc('get_live_alerts_in_bbox', {
                min_lon: bounds[0], min_lat: bounds[1], max_lon: bounds[2], max_lat: bounds[3]
            });
            if (!cancelled && data) setAlerts(data as AuthorityAlert[]);
        };

        load();
        const interval = setInterval(load, REFRESH_MS);
        const channel = supabase.channel('app-authority-alerts')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'authority_alerts' },
                load)
            .subscribe();

        return () => {
            cancelled = true;
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [bounds?.[0], bounds?.[1], bounds?.[2], bounds?.[3]]);

    const zonesGeojson = useMemo(() => ({
        type: 'FeatureCollection',
        features: alerts
            .filter(a => a.lat != null && a.type !== 'punto_violeta')
            .map(a => circleFeature(a.lat!, a.lng!, a.radius_m || 100, TYPE_STYLE[a.type]?.color ?? '#64748b'))
    }), [alerts]);

    if (alerts.length === 0) return null;

    return (
        <>
            <Source id="authority-alert-zones" type="geojson" data={zonesGeojson as any}>
                <Layer id="authority-alert-fill" type="fill"
                    paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 }} />
                <Layer id="authority-alert-line" type="line"
                    paint={{ 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 1], 'line-opacity': 0.6 }} />
            </Source>

            {alerts.filter(a => a.lat != null).map(alert => {
                const { color, Icon } = TYPE_STYLE[alert.type] ?? TYPE_STYLE.other;
                const isVioleta = alert.type === 'punto_violeta';
                return (
                    <Marker key={alert.id} latitude={alert.lat!} longitude={alert.lng!} anchor="center">
                        <div
                            className="flex flex-col items-center gap-1 pointer-events-auto cursor-pointer group"
                            onClick={(e) => { e.stopPropagation(); onAlertClick?.(alert); }}
                        >
                            <div
                                className="relative rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-110"
                                style={{ backgroundColor: color, width: isVioleta ? 44 : 38, height: isVioleta ? 44 : 38 }}
                            >
                                <Icon size={isVioleta ? 22 : 18} className="text-white" />
                                {/* official badge — distinguishes authority alerts from user reports */}
                                <BadgeCheck
                                    size={16}
                                    className="absolute -top-1.5 -right-1.5 text-white bg-blue-600 rounded-full"
                                />
                            </div>
                            <div className="bg-zinc-900/90 backdrop-blur-md px-3 py-0.5 rounded-full shadow border border-white/10 whitespace-nowrap">
                                <span className="text-white text-[9px] font-bold uppercase tracking-wider">
                                    {alert.title}
                                </span>
                            </div>
                        </div>
                    </Marker>
                );
            })}
        </>
    );
};
