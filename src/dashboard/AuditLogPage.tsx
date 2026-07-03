import { useEffect, useState } from 'react';
import { useDashboard } from './DashboardLayout';
import { listAuditLog } from './dashboardService';
import { dt } from './i18n';

const ACTION_BADGE: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-sky-100 text-sky-700',
    resolve: 'bg-slate-200 text-slate-700',
    delete: 'bg-red-100 text-red-700'
};

export default function AuditLogPage() {
    const { profile } = useDashboard();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listAuditLog(profile.city_id!).then(r => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
    }, [profile.city_id]);

    if (loading) return <p className="p-6 text-slate-500">{dt('loading')}</p>;

    return (
        <div className="p-6">
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="text-sm w-full">
                    <thead>
                        <tr className="text-left text-slate-500 border-b">
                            <th className="p-3">{dt('audit_when')}</th>
                            <th className="p-3">{dt('audit_user')}</th>
                            <th className="p-3">{dt('audit_action')}</th>
                            <th className="p-3">Alerta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-slate-400">{dt('empty')}</td></tr>
                        )}
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-slate-50 align-top">
                                <td className="p-3 whitespace-nowrap text-slate-500">
                                    {new Date(r.created_at).toLocaleString()}
                                </td>
                                <td className="p-3 font-mono text-xs text-slate-600">{r.user_id}</td>
                                <td className="p-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[r.action] ?? ''}`}>
                                        {r.action}
                                    </span>
                                </td>
                                <td className="p-3 text-slate-700">
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
