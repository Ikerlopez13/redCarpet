import { useCallback, useEffect, useMemo, useState } from 'react';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDashboard } from './DashboardLayout';
import {
    getScoresGeojson, listAlerts, listUserIncidents, subscribeToAlerts,
    getScoreHistory, type CityAlert
} from './dashboardService';
import AlertFormModal from './AlertFormModal';
import { dt } from './i18n';
import { Plus, X } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// score 0 (green) → 100 (red) choropleth ramp
const CHOROPLETH_PAINT: any = {
    'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'score'], 0],
        0, '#22c55e', 25, '#eab308', 50, '#f97316', 75, '#dc2626', 100, '#7f1d1d'
    ],
    // low-confidence barrios render washed out (visible flag, Task 3)
    'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'confidence'], 0], 0, 0.15, 1, 0.55]
};

const ALERT_COLORS: Record<string, string> = {
    street_closed: '#dc2626', danger_zone: '#f97316', punto_violeta: '#7c3aed',
    event: '#0ea5e9', poor_lighting: '#eab308', works: '#a16207', other: '#64748b'
};

interface BarrioSelection {
    id: string;
    name: string;
    district: string;
    score: number | null;
    confidence: number | null;
    sources: string[];
    history: Awaited<ReturnType<typeof getScoreHistory>>;
}

export default function OverviewMap() {
    const { profile, cityBounds } = useDashboard();
    const citySlug = profile.city?.slug ?? 'valencia';

    const [scores, setScores] = useState<GeoJSON.FeatureCollection | null>(null);
    const [alerts, setAlerts] = useState<CityAlert[]>([]);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [layers, setLayers] = useState({ alerts: true, violeta: true, closures: true, incidents: false });
    const [incidentDays, setIncidentDays] = useState<7 | 30>(7);
    const [creating, setCreating] = useState<{ lat: number; lng: number } | null>(null);
    const [createMode, setCreateMode] = useState(false);
    const [barrio, setBarrio] = useState<BarrioSelection | null>(null);

    const cityId = profile.city_id!;

    const refreshAlerts = useCallback(() => {
        listAlerts(cityId, 'active').then(setAlerts).catch(console.error);
    }, [cityId]);

    useEffect(() => {
        getScoresGeojson(citySlug).then(setScores).catch(console.error);
        refreshAlerts();
        return subscribeToAlerts(cityId, refreshAlerts);
    }, [citySlug, cityId, refreshAlerts]);

    useEffect(() => {
        if (layers.incidents) {
            listUserIncidents(cityId, incidentDays).then(setIncidents).catch(console.error);
        }
    }, [layers.incidents, incidentDays, cityId]);

    const onMapClick = useCallback(async (e: any) => {
        if (createMode) {
            setCreating({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            setCreateMode(false);
            return;
        }
        const feature = e.features?.[0];
        if (feature?.properties?.neighborhood_id) {
            const p = feature.properties;
            const history = await getScoreHistory(p.neighborhood_id).catch(() => []);
            setBarrio({
                id: p.neighborhood_id,
                name: p.name,
                district: p.district_name,
                score: p.score ?? null,
                confidence: p.confidence ?? null,
                sources: typeof p.data_sources === 'string' ? JSON.parse(p.data_sources) : (p.data_sources ?? []),
                history
            });
        }
    }, [createMode]);

    const visibleAlerts = useMemo(() => alerts.filter(a => {
        if (a.type === 'punto_violeta') return layers.violeta;
        if (a.type === 'street_closed') return layers.closures;
        return layers.alerts;
    }), [alerts, layers]);

    const bounds = cityBounds ?? [-0.45, 39.27, -0.27, 39.57]; // València fallback

    return (
        <div className="relative h-full min-h-[calc(100vh-57px)]">
            <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]], fitBoundsOptions: { padding: 20 } }}
                maxBounds={[[bounds[0] - 0.05, bounds[1] - 0.05], [bounds[2] + 0.05, bounds[3] + 0.05]]}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                interactiveLayerIds={['choropleth']}
                onClick={onMapClick}
                cursor={createMode ? 'crosshair' : 'grab'}
            >
                <NavigationControl position="top-right" />
                {scores && (
                    <Source id="scores" type="geojson" data={scores}>
                        <Layer id="choropleth" type="fill" paint={CHOROPLETH_PAINT} />
                        <Layer id="choropleth-line" type="line"
                            paint={{ 'line-color': '#71717a', 'line-width': 0.5 }} />
                    </Source>
                )}

                {visibleAlerts.map(a => a.lat != null && (
                    <Marker key={a.id} latitude={a.lat} longitude={a.lng!} anchor="center">
                        <div
                            title={`${dt('type_' + a.type)} — ${a.title}`}
                            className="rounded-full border-2 border-white shadow-lg"
                            style={{
                                backgroundColor: ALERT_COLORS[a.type],
                                width: a.type === 'punto_violeta' ? 22 : 16,
                                height: a.type === 'punto_violeta' ? 22 : 16
                            }}
                        />
                    </Marker>
                ))}

                {layers.incidents && incidents.map(i => (
                    <Marker key={i.id} latitude={i.lat} longitude={i.lng} anchor="center">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-800/60 border border-white"
                            title={`${i.type} · ${new Date(i.created_at).toLocaleDateString()}`} />
                    </Marker>
                ))}
            </Map>

            {/* layer toggles */}
            <div className="absolute top-4 left-4 bg-[#0d0d0d]/95 backdrop-blur border border-white/10 rounded-2xl shadow-xl p-4 text-sm space-y-2.5 w-60 text-zinc-200">
                {([
                    ['alerts', dt('layer_alerts')],
                    ['violeta', dt('layer_violeta')],
                    ['closures', dt('layer_closures')],
                    ['incidents', incidentDays === 7 ? dt('layer_incidents_7') : dt('layer_incidents_30')]
                ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={layers[key]}
                            onChange={() => setLayers(l => ({ ...l, [key]: !l[key] }))} />
                        {key === 'violeta' && <span className="w-3 h-3 rounded-full bg-violet-600 inline-block" />}
                        {label}
                    </label>
                ))}
                {layers.incidents && (
                    <div className="flex gap-2 pl-6">
                        {[7, 30].map(d => (
                            <button key={d}
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${incidentDays === d ? 'bg-red-600 text-white' : 'bg-white/10 text-zinc-400'}`}
                                onClick={() => setIncidentDays(d as 7 | 30)}>{d}d</button>
                        ))}
                    </div>
                )}
            </div>

            {/* create alert */}
            <button
                onClick={() => setCreateMode(m => !m)}
                className={`absolute bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-black uppercase tracking-wider text-sm
                    ${createMode ? 'bg-zinc-800 text-white border border-white/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_6px_25px_rgba(220,38,38,0.45)]'}`}
            >
                <Plus className="w-5 h-5" /> {createMode ? dt('click_map_hint') : dt('alert_create')}
            </button>

            {creating && (
                <AlertFormModal
                    location={creating}
                    onClose={() => setCreating(null)}
                    onSaved={() => { setCreating(null); refreshAlerts(); }}
                />
            )}

            {/* barrio detail panel */}
            {barrio && (
                <div className="absolute top-0 right-0 h-full w-80 bg-[#0d0d0d]/95 backdrop-blur border-l border-white/10 shadow-2xl p-5 overflow-y-auto text-zinc-200">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h2 className="font-black italic uppercase text-white">{barrio.name}</h2>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{barrio.district}</p>
                        </div>
                        <button onClick={() => setBarrio(null)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{dt('score')}</p>
                        <p className="text-3xl font-bold" style={{
                            color: (barrio.score ?? 0) > 60 ? '#ef4444' : (barrio.score ?? 0) > 30 ? '#f97316' : '#22c55e'
                        }}>{barrio.score?.toFixed(0) ?? '—'}<span className="text-base text-zinc-600">/100</span></p>
                        <p className="text-xs text-zinc-500">
                            {dt('confidence')}: {barrio.confidence != null ? `${Math.round(barrio.confidence * 100)}%` : '—'}
                        </p>
                        {(barrio.confidence ?? 1) < 0.5 && (
                            <p className="text-xs text-amber-600 mt-1">⚠ {dt('low_confidence')}</p>
                        )}
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">{dt('score_trend')}</p>
                        {barrio.history.length > 1 ? (
                            <div className="flex items-end gap-1 h-16">
                                {barrio.history.map((h: any, i: number) => (
                                    <div key={i}
                                        className="flex-1 bg-red-600/80 rounded-t"
                                        style={{ height: `${Math.max(4, h.score)}%` }}
                                        title={`${h.score} — ${new Date(h.computed_at).toLocaleDateString()}`} />
                                ))}
                            </div>
                        ) : <p className="text-xs text-zinc-600">{dt('empty')}</p>}
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">{dt('data_sources')}</p>
                        <ul className="text-xs text-zinc-500 list-disc pl-4">
                            {barrio.sources.length ? barrio.sources.map(s => <li key={s}>{s}</li>)
                                : <li>{dt('empty')}</li>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
