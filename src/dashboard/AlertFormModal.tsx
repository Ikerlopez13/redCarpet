import React, { useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { createAlert, updateAlert, geocodeInCity, type AlertType, type AlertSeverity, type CityAlert } from './dashboardService';
import { dt } from './i18n';
import { X, Search, Flower2 } from 'lucide-react';

const TYPES: AlertType[] = ['street_closed', 'danger_zone', 'punto_violeta', 'event', 'poor_lighting', 'works', 'other'];
const SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high'];

interface Props {
    location: { lat: number; lng: number };
    existing?: CityAlert;       // edit mode
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Create/edit an authority alert. Puntos violeta get first-class treatment:
 * violet styling and an optional daily schedule (e.g. 22:00–06:00 during
 * Fallas) that drives both map display and the routing bonus.
 */
export default function AlertFormModal({ location, existing, onClose, onSaved }: Props) {
    const { profile, cityBounds } = useDashboard();
    const [type, setType] = useState<AlertType>(existing?.type ?? 'danger_zone');
    const [title, setTitle] = useState(existing?.title ?? '');
    const [description, setDescription] = useState(existing?.description ?? '');
    const [severity, setSeverity] = useState<AlertSeverity>(existing?.severity ?? 'medium');
    const [radius, setRadius] = useState(existing?.radius_m ?? 100);
    const [startsAt, setStartsAt] = useState(existing?.starts_at?.slice(0, 16) ?? new Date().toISOString().slice(0, 16));
    const [expiresAt, setExpiresAt] = useState(existing?.expires_at?.slice(0, 16) ?? '');
    const [dailyStart, setDailyStart] = useState(existing?.daily_start?.slice(0, 5) ?? '');
    const [dailyEnd, setDailyEnd] = useState(existing?.daily_end?.slice(0, 5) ?? '');
    const [pos, setPos] = useState(location);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const isVioleta = type === 'punto_violeta';

    const search = async () => {
        if (!query.trim() || !cityBounds) return;
        setResults(await geocodeInCity(query, cityBounds));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const payload = {
                type, title, description, severity,
                lat: pos.lat, lng: pos.lng, radius_m: radius,
                starts_at: new Date(startsAt).toISOString(),
                expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                daily_start: dailyStart || null,
                daily_end: dailyEnd || null
            };
            if (existing) {
                await updateAlert(existing.id, payload);
            } else {
                await createAlert(profile.city_id!, profile.id, payload);
            }
            onSaved();
        } catch (err: any) {
            // DB trigger rejects out-of-boundary geometry — surface it verbatim
            setError(err?.message ?? 'Error');
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={submit}
                className={`bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border-t-4 text-zinc-200
                    ${isVioleta ? 'border-t-violet-600' : 'border-t-red-600'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-black italic uppercase text-lg flex items-center gap-2 text-white">
                        {isVioleta && <Flower2 className="w-5 h-5 text-violet-600" />}
                        {existing ? dt('alert_edit') : dt('alert_create')}
                    </h2>
                    <button type="button" onClick={onClose}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
                </div>

                {/* address search (bbox-restricted to the city) */}
                <div className="mb-3">
                    <div className="flex gap-2">
                        <input value={query} onChange={e => setQuery(e.target.value)}
                            placeholder={dt('search_placeholder')}
                            className="flex-1 bg-[#131316] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
                        <button type="button" onClick={search}
                            className="px-3 bg-white/10 rounded-xl hover:bg-white/20 text-zinc-300"><Search className="w-4 h-4" /></button>
                    </div>
                    {results.length > 0 && (
                        <ul className="border border-white/10 bg-[#131316] rounded-xl mt-1 text-sm divide-y divide-white/5">
                            {results.map(r => (
                                <li key={r.name}>
                                    <button type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-zinc-300"
                                        onClick={() => { setPos({ lat: r.lat, lng: r.lng }); setResults([]); setQuery(r.name); }}>
                                        {r.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-xs text-zinc-600 mt-1 font-mono">
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {dt('alert_type')}
                        <select value={type} onChange={e => setType(e.target.value as AlertType)}
                            className="w-full bg-[#131316] border border-white/10 rounded-xl px-2 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600">
                            {TYPES.map(t => <option key={t} value={t}>{dt('type_' + t)}</option>)}
                        </select>
                    </label>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {dt('alert_severity')}
                        <select value={severity} onChange={e => setSeverity(e.target.value as AlertSeverity)}
                            className="w-full bg-[#131316] border border-white/10 rounded-xl px-2 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600">
                            {SEVERITIES.map(s => <option key={s} value={s}>{dt('severity_' + s)}</option>)}
                        </select>
                    </label>
                </div>

                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3">
                    {dt('alert_title')}
                    <input required minLength={3} maxLength={120} value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-[#131316] border border-white/10 rounded-xl px-3 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600" />
                </label>

                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3">
                    {dt('alert_description')}
                    <textarea maxLength={2000} value={description} rows={2}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-[#131316] border border-white/10 rounded-xl px-3 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600" />
                </label>

                <div className="grid grid-cols-3 gap-3 mb-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {dt('alert_radius')}
                        <input type="number" min={10} max={2000} value={radius}
                            onChange={e => setRadius(Number(e.target.value))}
                            className="w-full bg-[#131316] border border-white/10 rounded-xl px-2 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600" />
                    </label>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {dt('alert_starts')}
                        <input type="datetime-local" required value={startsAt}
                            onChange={e => setStartsAt(e.target.value)}
                            className="w-full bg-[#131316] border border-white/10 rounded-xl px-2 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600" />
                    </label>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {dt('alert_expires')}
                        <input type="datetime-local" value={expiresAt}
                            onChange={e => setExpiresAt(e.target.value)}
                            className="w-full bg-[#131316] border border-white/10 rounded-xl px-2 py-2 mt-1.5 text-white text-sm focus:outline-none focus:border-red-600" />
                    </label>
                </div>

                {isVioleta && (
                    <fieldset className="border border-violet-700/50 bg-violet-950/30 rounded-2xl p-3 mb-3">
                        <legend className="text-[10px] uppercase tracking-widest text-violet-400 font-bold px-1">{dt('alert_schedule')}</legend>
                        <div className="flex gap-3">
                            <input type="time" value={dailyStart} onChange={e => setDailyStart(e.target.value)}
                                className="bg-[#131316] border border-white/10 rounded-xl px-2 py-1.5 text-white text-sm" />
                            <span className="self-center text-zinc-600">—</span>
                            <input type="time" value={dailyEnd} onChange={e => setDailyEnd(e.target.value)}
                                className="bg-[#131316] border border-white/10 rounded-xl px-2 py-1.5 text-white text-sm" />
                        </div>
                    </fieldset>
                )}

                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-full bg-white/10 hover:bg-white/20 text-zinc-300">{dt('cancel')}</button>
                    <button type="submit" disabled={busy}
                        className={`px-6 py-2 text-xs font-black uppercase tracking-wider rounded-full text-white disabled:opacity-50
                            ${isVioleta ? 'bg-violet-600 hover:bg-violet-500 shadow-[0_4px_20px_rgba(124,58,237,0.4)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_4px_20px_rgba(220,38,38,0.4)]'}`}>
                        {busy ? dt('loading') : dt('save')}
                    </button>
                </div>
            </form>
        </div>
    );
}
