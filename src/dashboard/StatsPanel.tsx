import { useEffect, useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { supabase } from '../services/supabaseClient';
import { dt } from './i18n';

interface BarrioWeekRow { barrio: string; week: string; incidents: number }
interface TopZoneRow { barrio: string; incidents: number }

export default function StatsPanel() {
    const { profile } = useDashboard();
    const citySlug = profile.city?.slug ?? 'valencia';
    const [weekly, setWeekly] = useState<BarrioWeekRow[]>([]);
    const [topZones, setTopZones] = useState<TopZoneRow[]>([]);
    const [resolutionHours, setResolutionHours] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [{ data: w }, { data: t }, { data: r }] = await Promise.all([
                supabase.rpc('stats_incidents_per_barrio_week', { p_city_slug: citySlug }),
                supabase.rpc('stats_top_reported_zones', { p_city_slug: citySlug, p_limit: 10 }),
                supabase.rpc('stats_alert_resolution_hours', { p_city_slug: citySlug })
            ]);
            setWeekly((w ?? []) as BarrioWeekRow[]);
            setTopZones((t ?? []) as TopZoneRow[]);
            setResolutionHours(typeof r === 'number' ? r : null);
            setLoading(false);
        })().catch(() => setLoading(false));
    }, [citySlug]);

    if (loading) return <p className="p-6 text-zinc-500 font-bold uppercase text-xs tracking-widest">{dt('loading')}</p>;

    const maxIncidents = Math.max(1, ...topZones.map(z => z.incidents));

    return (
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
    );
}
