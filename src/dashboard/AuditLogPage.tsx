import { useEffect, useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { listAuditLog } from './dashboardService';
import { dt } from './i18n';

const ACTION_BADGE: Record<string, string> = {
    create: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
    update: 'bg-sky-950/60 text-sky-400 border border-sky-800/40',
    resolve: 'bg-zinc-800/80 text-zinc-400 border border-white/10',
    delete: 'bg-red-950/60 text-red-400 border border-red-800/40'
};

export default function AuditLogPage() {
    const { profile } = useDashboard();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listAuditLog(profile.city_id!).then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
    }, [profile.city_id]);

    if (loading) return <p className="p-6 text-zinc-500 font-bold uppercase text-xs tracking-widest">{dt('loading')}</p>;

    return (
        <div className="p-6">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-x-auto">
                <table className="text-sm w-full">
                    <thead>
                        <tr className="text-left text-zinc-500 uppercase text-[10px] tracking-widest border-b border-white/10">
                            <th className="p-3">{dt('audit_when')}</th>
                            <th className="p-3">{dt('audit_user')}</th>
                            <th className="p-3">{dt('audit_action')}</th>
                            <th className="p-3">Alerta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-zinc-600">{dt('empty')}</td></tr>
                        )}
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-white/5 align-top">
                                <td className="p-3 whitespace-nowrap text-zinc-500">
                                    {new Date(r.created_at).toLocaleString()}
                                </td>
                                <td className="p-3 font-mono text-xs text-zinc-500">{r.user_id}</td>
                                <td className="p-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[r.action] ?? ''}`}>
                                        {r.action}
                                    </span>
                                </td>
                                <td className="p-3 text-zinc-300">
                                    {r.after?.title ?? r.before?.title ?? r.alert_id}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
