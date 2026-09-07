import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../services/supabaseClient';
import { getIncidentColor } from '../utils/incidentColors';
import { useDashboard } from './DashboardLayout';
import {
    getScoresGeojson, listAlerts, listUserIncidents, subscribeToAlerts,
    getScoreHistory, type CityAlert
} from './dashboardService';
import IncidencePicker from './IncidencePicker';
import { dt } from './i18n';
import { Plus, X, Search, Loader2 } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Choropleth ramp calibrated around the municipal baseline (~50), not the
// absolute 0-100 scale: a barrio at baseline reads green (normality), only
// barrios flagged well above it climb to yellow/orange, and red is reserved
// for the extremes — the map must inform, not alarm.
const CHOROPLETH_PAINT: any = {
    'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'score'], 0],
        0, '#16a34a', 50, '#84cc16', 55, '#facc15', 60, '#fb923c', 68, '#ef4444', 85, '#7f1d1d'
    ],
    // low-confidence barrios render washed out (visible flag, Task 3)
    'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'confidence'], 0], 0, 0.15, 1, 0.55]
};

// same calibration for panel numbers and trend bars
function scoreColor(score: number): string {
    if (score >= 68) return '#ef4444';
    if (score >= 60) return '#fb923c';
    if (score >= 55) return '#facc15';
    if (score >= 50) return '#84cc16';
    return '#16a34a';
}

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
    const [layers, setLayers] = useState({ alerts: true, violeta: true, closures: true, incidents: true });
    const [incidentDays, setIncidentDays] = useState<7 | 30>(7);
    const [creating, setCreating] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [closingIncident, setClosingIncident] = useState(false);
    const [createMode, setCreateMode] = useState(false);
    const [barrio, setBarrio] = useState<BarrioSelection | null>(null);
    // Buscador de sitios (vuela el mapa al resultado). Usa el proxy mapbox-search
    // (con topes + rate limit) y SOLO busca al pulsar Enter → coste mínimo.
    const mapRef = useRef<MapRef>(null);
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<{ name: string; addr: string; lat: number; lng: number }[]>([]);
    const [searchBusy, setSearchBusy] = useState(false);

    const doSearch = async () => {
        const q = searchQ.trim();
        if (q.length < 3) return;
        setSearchBusy(true);
        try {
            const { data } = await supabase.functions.invoke('mapbox-search', { body: { q, language: 'es' } });
            const feats: any[] = data?.features ?? [];
            setSearchResults(feats
                .filter(f => f?.geometry?.coordinates?.length === 2)
                .slice(0, 6)
                .map(f => ({
                    name: f.properties?.name || 'Lugar',
                    addr: f.properties?.full_address || f.properties?.place_formatted || '',
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                })));
        } catch { setSearchResults([]); }
        finally { setSearchBusy(false); }
    };

    const goToResult = (r: { lat: number; lng: number }) => {
        mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, duration: 1200 });
        setSearchResults([]);
        setSearchQ('');
    };

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

    // Geographic circle in meters — same construction the app uses in
    // IncidenceZones, so the dashboard shows exactly what app users see.
    const alertCirclesGeojson = useMemo(() => ({
        type: 'FeatureCollection',
        features: visibleAlerts.filter(a => a.lat != null).map(a => {
            const lat = a.lat!, lng = a.lng!;
            const radius = a.radius_m ?? 100;
            const km = radius / 1000;
            const dx = km / (111.320 * Math.cos((lat * Math.PI) / 180));
            const dy = km / 110.574;
            const ring: number[][] = [];
            for (let i = 0; i <= 64; i++) {
                const t = (i / 64) * 2 * Math.PI;
                ring.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)]);
            }
            return {
                type: 'Feature',
                properties: { color: a.type === 'punto_violeta' ? '#7c3aed' : '#f59e0b' },
                geometry: { type: 'Polygon', coordinates: [ring] }
            };
        })
    }), [visibleAlerts]);

    // Círculos de área de las incidencias, coloreados IGUAL que la app
    // (getIncidentColor por la etiqueta de description). fill 0.2 / line 0.4.
    const incidentCirclesGeojson = useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: incidents.filter(i => i.lat != null && i.lng != null).map(i => {
            const lat = i.lat, lng = i.lng;
            const radius = i.radius ?? 100;
            const km = radius / 1000;
            const dx = km / (111.320 * Math.cos((lat * Math.PI) / 180));
            const dy = km / 110.574;
            const ring: number[][] = [];
            for (let k = 0; k <= 64; k++) {
                const t = (k / 64) * 2 * Math.PI;
                ring.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)]);
            }
            const label = (i.description || '').split(' - ')[0];
            return {
                type: 'Feature' as const,
                properties: { color: getIncidentColor(label) },
                geometry: { type: 'Polygon' as const, coordinates: [ring] }
            };
        })
    }), [incidents]);

    // Superadmin global (ciudad "Global" o sin ciudad) → mapa MUNDIAL sin
    // candado. Admin de ciudad concreta → vista y candado a su ciudad.
    const isWorldwide = !cityBounds || profile?.city?.slug === 'global';
    const bounds = cityBounds ?? [-0.45, 39.27, -0.27, 39.57]; // fallback València
    const initialViewState = isWorldwide
        ? { longitude: 2.0, latitude: 41.5, zoom: 5 } // arranca en España, pan libre
        : { bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 20 } };

    return (
        <div className="relative w-full h-[calc(100dvh-121px)] md:h-[calc(100vh-56px)]">
            {/* Buscador de sitios — vuela el mapa al resultado */}
            <div className="absolute top-3 left-3 z-20 w-[300px] max-w-[calc(100%-24px)]">
                <div className="flex items-center gap-2 bg-[#0d0d0d]/95 backdrop-blur border border-white/15 rounded-xl px-3 py-2 shadow-xl">
                    <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
                        placeholder="Buscar sitio (pulsa Enter)…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 outline-none"
                    />
                    {searchBusy
                        ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
                        : searchQ && <button onClick={() => { setSearchQ(''); setSearchResults([]); }} className="text-zinc-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>}
                </div>
                {searchResults.length > 0 && (
                    <div className="mt-1 bg-[#0d0d0d]/98 backdrop-blur border border-white/15 rounded-xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
                        {searchResults.map((r, i) => (
                            <button key={i} onClick={() => goToResult(r)}
                                className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0">
                                <p className="text-sm text-white font-semibold truncate">{r.name}</p>
                                {r.addr && <p className="text-[11px] text-zinc-500 truncate">{r.addr}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={initialViewState}
                maxBounds={isWorldwide ? undefined : [[bounds[0] - 0.05, bounds[1] - 0.05], [bounds[2] + 0.05, bounds[3] + 0.05]]}
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

                {/* radius circles — same geographic circle the app renders
                    for these zones (amber like IncidenceZones; violet for
                    puntos violeta) */}
                <Source id="alert-radius" type="geojson" data={alertCirclesGeojson as any}>
                    <Layer id="alert-radius-fill" type="fill"
                        paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 }} />
                    <Layer id="alert-radius-line" type="line"
                        paint={{ 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.4 }} />
                </Source>

                {visibleAlerts.map(a => a.lat != null && (
                    <Marker key={a.id} latitude={a.lat} longitude={a.lng!} anchor="center">
                        <div
                            title={`${dt('type_' + a.type)} — ${a.title} (${a.radius_m ?? 100}m)`}
                            className="rounded-full border-2 border-white shadow-lg"
                            style={{
                                backgroundColor: ALERT_COLORS[a.type],
                                width: a.type === 'punto_violeta' ? 22 : 16,
                                height: a.type === 'punto_violeta' ? 22 : 16
                            }}
                        />
                    </Marker>
                ))}

                {/* Área de las incidencias (círculo con color, idéntico a la app) */}
                {layers.incidents && (
                    <Source id="incident-radius" type="geojson" data={incidentCirclesGeojson as any}>
                        <Layer id="incident-radius-fill" type="fill"
                            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 }} />
                        <Layer id="incident-radius-line" type="line"
                            paint={{ 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.4 }} />
                    </Source>
                )}
                {layers.incidents && incidents.map(i => {
                    const label = (i.description || '').split(' - ')[0];
                    const color = getIncidentColor(label);
                    return (
                        <Marker key={i.id} latitude={i.lat} longitude={i.lng} anchor="center">
                            <button
                                onClick={(e) => { e.stopPropagation(); setSelectedIncident(i); }}
                                className="relative size-7 rounded-full bg-zinc-900 border-2 flex items-center justify-center shadow-lg"
                                style={{ borderColor: color, boxShadow: `0 0 12px ${color}66` }}
                                title={label}
                            >
                                <span className="material-symbols-outlined text-[14px]" style={{ color }}>info</span>
                            </button>
                        </Marker>
                    );
                })}
            </Map>

            {/* layer toggles — debajo del buscador; compacto en móvil */}
            <div className="absolute top-[68px] left-3 md:left-4 z-10 bg-[#0d0d0d]/95 backdrop-blur border border-white/10 rounded-2xl shadow-xl p-3 md:p-4 text-[13px] md:text-sm space-y-2 md:space-y-2.5 w-52 md:w-60 text-zinc-200">
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

            {/* legend — calibrated scale, baseline reads as normality (oculta en móvil) */}
            <div className="hidden md:block absolute bottom-6 left-4 bg-[#0d0d0d]/95 backdrop-blur border border-white/10 rounded-2xl px-4 py-3 text-zinc-300">
                <div className="h-2 w-48 rounded-full mb-1.5"
                    style={{ background: 'linear-gradient(to right, #16a34a, #84cc16, #facc15, #fb923c, #ef4444)' }} />
                <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold text-zinc-500 w-48">
                    <span>Normal</span><span>Atención</span><span>Riesgo</span>
                </div>
            </div>

            {/* create alert — sube por encima de la nav inferior en móvil */}
            <button
                onClick={() => setCreateMode(m => !m)}
                className={`absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-black uppercase tracking-wider text-sm
                    ${createMode ? 'bg-zinc-800 text-white border border-white/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_6px_25px_rgba(220,38,38,0.45)]'}`}
            >
                <Plus className="w-5 h-5" /> {createMode ? dt('click_map_hint') : dt('alert_create')}
            </button>

            {/* Cerrar (borrar) una incidencia existente */}
            {selectedIncident && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedIncident(null)} />
                    <div className="relative w-full max-w-xs bg-[#121216] rounded-3xl p-6 shadow-2xl border border-white/10 text-center">
                        <div className="size-12 rounded-full flex items-center justify-center mx-auto mb-3"
                            style={{ backgroundColor: `${getIncidentColor((selectedIncident.description || '').split(' - ')[0])}1f`, color: getIncidentColor((selectedIncident.description || '').split(' - ')[0]) }}>
                            <span className="material-symbols-outlined">info</span>
                        </div>
                        <h3 className="text-white font-black italic uppercase tracking-tighter">{(selectedIncident.description || '').split(' - ')[0]}</h3>
                        <p className="text-[11px] text-zinc-500 mt-1">{selectedIncident.lat?.toFixed(4)}, {selectedIncident.lng?.toFixed(4)}</p>
                        <button
                            disabled={closingIncident}
                            onClick={async () => {
                                setClosingIncident(true);
                                const { error } = await supabase.from('danger_zones').delete().eq('id', selectedIncident.id);
                                setClosingIncident(false);
                                if (!error) {
                                    setSelectedIncident(null);
                                    if (cityId) listUserIncidents(cityId, incidentDays).then(setIncidents).catch(() => {});
                                }
                            }}
                            className="w-full mt-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-xs">
                            {closingIncident ? '...' : 'Cerrar alerta'}
                        </button>
                        <button onClick={() => setSelectedIncident(null)} className="w-full mt-2 py-2 text-white/40 text-xs uppercase tracking-widest font-bold">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {creating && (
                <IncidencePicker
                    location={creating}
                    cityId={profile?.city_id ?? null}
                    onClose={() => setCreating(null)}
                    onSaved={() => {
                        setCreating(null);
                        refreshAlerts();
                        if (cityId) listUserIncidents(cityId, incidentDays).then(setIncidents).catch(() => {});
                    }}
                />
            )}

            {/* barrio detail panel */}
            {barrio && (
                <div className="absolute top-0 right-0 h-full w-full sm:w-80 z-30 bg-[#0d0d0d]/97 backdrop-blur border-l border-white/10 shadow-2xl p-5 overflow-y-auto text-zinc-200">
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
                            color: scoreColor(barrio.score ?? 0) }}>{barrio.score?.toFixed(0) ?? '—'}<span className="text-base text-zinc-600">/100</span></p>
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
                                        className="flex-1 rounded-t"
                                        style={{ height: `${Math.max(4, h.score)}%`, backgroundColor: scoreColor(h.score), opacity: 0.85 }}
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
