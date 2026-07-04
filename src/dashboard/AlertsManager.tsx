import { useCallback, useEffect, useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { listAlerts, resolveAlert, deleteAlert, subscribeToAlerts, type CityAlert } from './dashboardService';
import AlertFormModal from './AlertFormModal';
import { dt } from './i18n';
import { CheckCircle2, Trash2, Pencil, Flower2 } from 'lucide-react';

const TYPE_BADGE: Record<string, string> = {
    street_closed: 'bg-red-950/60 text-red-400 border border-red-800/40',
    danger_zone: 'bg-orange-950/60 text-orange-400 border border-orange-800/40',
    punto_violeta: 'bg-violet-950/60 text-violet-400 border border-violet-800/40',
    event: 'bg-sky-950/60 text-sky-400 border border-sky-800/40',
    poor_lighting: 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/40',
    works: 'bg-amber-950/60 text-amber-400 border border-amber-800/40',
    other: 'bg-zinc-800/80 text-zinc-400 border border-white/10'
};

export default function AlertsManager() {
    const { profile } = useDashboard();
    const cityId = profile.city_id!;
    const isAdmin = profile.role === 'city_admin' || profile.role === 'superadmin';

    const [tab, setTab] = useState<'active' | 'resolved'>('active');
    const [alerts, setAlerts] = useState<CityAlert[]>([]);
    const [editing, setEditing] = useState<CityAlert | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
        setLoading(true);
        listAlerts(cityId, tab).then(a => { setAlerts(a); setLoading(false); }).catch(console.error);
    }, [cityId, tab]);

    useEffect(() => {
        refresh();
        return subscribeToAlerts(cityId, refresh);
    }, [refresh, cityId]);

    const onResolve = async (a: CityAlert) => {
        await resolveAlert(a.id, profile.id);
        refresh();
    };

    const onDelete = async (a: CityAlert) => {
        if (!window.confirm(`${dt('alert_delete')}: "${a.title}"?`)) return;
        await deleteAlert(a.id);
        refresh();
    };

    return (
        <div className="p-6">
            <div className="flex gap-2 mb-4">
                {(['active', 'resolved'] as const).map(s => (
                    <button key={s} onClick={() => setTab(s)}
                        className={`px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${tab === s
                            ? 'bg-red-600 text-white shadow-[0_4px_20px_rgba(220,38,38,0.35)]' : 'bg-[#131316] border border-white/10 text-zinc-400 hover:text-white'}`}>
                        {s === 'active' ? dt('alert_active') : dt('alert_resolved')}
                    </button>
                ))}
            </div>

            {loading ? <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">{dt('loading')}</p> : (
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl divide-y divide-white/5">
                    {alerts.length === 0 && <p className="p-4 text-zinc-600 text-sm">{dt('empty')}</p>}
                    {alerts.map(a => (
                        <div key={a.id} className="p-4 flex items-center gap-4">
                            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${TYPE_BADGE[a.type]}`}>
                                {a.type === 'punto_violeta' && <Flower2 className="w-3 h-3" />}
                                {dt('type_' + a.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate">{a.title}</p>
                                <p className="text-xs text-zinc-500">
                                    {dt('severity_' + a.severity)}
                                    {' · '}{new Date(a.starts_at).toLocaleString()}
                                    {a.expires_at && ` → ${new Date(a.expires_at).toLocaleString()}`}
                                    {a.daily_start && ` · ⏰ ${a.daily_start.slice(0, 5)}–${a.daily_end?.slice(0, 5)}`}
                                </p>
                            </div>
                            {tab === 'active' && (
                                <div className="flex gap-2">
                                    <button onClick={() => onResolve(a)}
                                        title={dt('alert_resolve')}
                                        className="p-2 rounded-xl hover:bg-emerald-950/50 text-emerald-500">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => setEditing(a)}
                                        title={dt('alert_edit')}
                                        className="p-2 rounded-xl hover:bg-white/10 text-zinc-400">
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => onDelete(a)}
                                            title={dt('alert_delete')}
                                            className="p-2 rounded-xl hover:bg-red-950/50 text-red-500">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <AlertFormModal
                    location={{ lat: editing.lat ?? 39.47, lng: editing.lng ?? -0.376 }}
                    existing={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); refresh(); }}
                />
            )}
        </div>
    );
}
