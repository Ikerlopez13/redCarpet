import { useEffect, useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { supabase } from '../services/supabaseClient';
import { dt } from './i18n';

interface BarrioWeekRow { barrio: string; week: string; incidents: number }
interface TopZoneRow { barrio: string; incidents: number }
interface Growth {
    total_users: number; new_24h: number; new_7d: number; new_30d: number;
    active_24h: number; active_7d: number; premium_active: number;
    daily: { day: string; signups: number }[];
}

export default function StatsPanel() {
    const { profile } = useDashboard();
    const citySlug = profile.city?.slug ?? 'valencia';
    const [weekly, setWeekly] = useState<BarrioWeekRow[]>([]);
    const [topZones, setTopZones] = useState<TopZoneRow[]>([]);
    const [resolutionHours, setResolutionHours] = useState<number | null>(null);
    const [growth, setGrowth] = useState<Growth | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [{ data: w }, { data: t }, { data: r }, { data: g }] = await Promise.all([
                supabase.rpc('stats_incidents_per_barrio_week', { p_city_slug: citySlug }),
                supabase.rpc('stats_top_reported_zones', { p_city_slug: citySlug, p_limit: 10 }),
                supabase.rpc('stats_alert_resolution_hours', { p_city_slug: citySlug }),
                supabase.rpc('god_growth_metrics')
            ]);
            setWeekly((w ?? []) as BarrioWeekRow[]);
            setTopZones((t ?? []) as TopZoneRow[]);
            setResolutionHours(typeof r === 'number' ? r : null);
            setGrowth((g ?? null) as Growth | null);
            setLoading(false);
        })().catch(() => setLoading(false));
    }, [citySlug]);

    if (loading) return <p className="p-6 text-zinc-500 font-bold uppercase text-xs tracking-widest">{dt('loading')}</p>;

    const maxIncidents = Math.max(1, ...topZones.map(z => z.incidents));
    const maxSignups = growth ? Math.max(1, ...growth.daily.map(d => d.signups)) : 1;

    return (
      <>
        {/* Crecimiento (usuarios de la app) — visible para el panel */}
        {growth && (
            <div className="p-6 pb-0">
                <h2 className="font-black italic uppercase text-white mb-4">Crecimiento</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
                    {[
                        { label: 'Usuarios', value: growth.total_users, accent: true },
                        { label: 'Altas 24 h', value: growth.new_24h },
                        { label: 'Altas 7 d', value: growth.new_7d },
                        { label: 'Altas 30 d', value: growth.new_30d },
                        { label: 'Activos 24 h', value: growth.active_24h },
                        { label: 'Activos 7 d', value: growth.active_7d },
                        { label: 'Premium', value: growth.premium_active },
                    ].map(k => (
                        <div key={k.label} className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4">
                            <div className={`text-3xl font-black ${k.accent ? 'text-red-500' : 'text-white'}`}>{k.value}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">{k.label}</div>
                        </div>
                    ))}
                </div>
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5 mb-2">
                    <h3 className="font-black italic uppercase text-white mb-4 text-sm">Altas por día · últimos 14 días</h3>
                    <div className="flex items-end gap-1.5 h-32">
                        {growth.daily.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end group" title={`${d.day}: ${d.signups}`}>
                                <span className="text-[9px] text-zinc-500 mb-1 font-mono">{d.signups > 0 ? d.signups : ''}</span>
                                <div className="w-full bg-gradient-to-t from-red-700 to-red-500 rounded-t transition-all"
                                    style={{ height: `${Math.max(3, (d.signups / maxSignups) * 100)}%` }} />
                                <span className="text-[8px] text-zinc-600 mt-1">{d.day.slice(8)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="p-6 grid gap-6 lg:grid-cols-2">
            <section className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
                <h2 className="font-black italic uppercase text-white mb-4">{dt('stats_top_zones')}</h2>
                {topZones.length === 0 && <p className="text-sm text-zinc-600">{dt('empty')}</p>}
                <ul className="space-y-2">
                    {topZones.map(z => (
                        <li key={z.barrio} className="text-sm">
                            <div className="flex justify-between mb-0.5">
                                <span className="text-zinc-300 font-semibold">{z.barrio}</span>
                                <span className="text-zinc-500 font-mono">{z.incidents}</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full">
                                <div className="h-2 bg-gradient-to-r from-red-700 to-red-500 rounded-full"
                                    style={{ width: `${(z.incidents / maxIncidents) * 100}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
                <h2 className="font-black italic uppercase text-white mb-4">{dt('stats_resolution')}</h2>
                <p className="text-4xl font-black text-white">
                    {resolutionHours != null ? `${resolutionHours.toFixed(1)} h` : '—'}
                </p>
            </section>

            <section className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5 lg:col-span-2">
                <h2 className="font-black italic uppercase text-white mb-4">{dt('stats_incidents_week')}</h2>
                {weekly.length === 0 ? <p className="text-sm text-zinc-600">{dt('empty')}</p> : (
                    <div className="overflow-x-auto">
                        <table className="text-sm w-full">
                            <thead>
                                <tr className="text-left text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/10">
                                    <th className="py-1 pr-4">Barrio</th>
                                    <th className="py-1 pr-4">Semana</th>
                                    <th className="py-1">Incidentes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weekly.map((r, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="py-1.5 pr-4 text-zinc-300">{r.barrio}</td>
                                        <td className="py-1.5 pr-4 text-zinc-500">{new Date(r.week).toLocaleDateString()}</td>
                                        <td className="py-1">{r.incidents}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
      </>
    );
}
