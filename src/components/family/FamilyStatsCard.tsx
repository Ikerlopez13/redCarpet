import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ShieldCheck, MapPin, AlertTriangle, TrendingUp } from 'lucide-react';

interface FamilyStats {
    safe_arrivals_count: number;
    risk_alerts_count: number;
    routes_completed_count: number;
}

interface FamilyStatsCardProps {
    familyId: string;
}

export function FamilyStatsCard({ familyId }: FamilyStatsCardProps) {
    const [stats, setStats] = useState<FamilyStats>({
        safe_arrivals_count: 0,
        risk_alerts_count: 0,
        routes_completed_count: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (familyId) {
            fetchStats();
        }
    }, [familyId]);

    const fetchStats = async () => {
        try {
            // Get start of current week (Monday)
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('family_stats')
                .select('*')
                .eq('family_id', familyId)
                .eq('week_start_date', monday)
                .single();

            if (data) {
                setStats(data);
            } else if (!error) {
                // No stats for this week yet
                setStats({
                    safe_arrivals_count: 0,
                    risk_alerts_count: 0,
                    routes_completed_count: 0
                });
            }
        } catch (error) {
            console.error('Error fetching family stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="animate-pulse h-32 bg-zinc-900/50 rounded-xl" />;
    }

    return (
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="text-green-500" size={20} />
                <h3 className="font-bold text-white text-lg">Tranquilidad Semanal</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/30">
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin size={14} className="text-blue-400" />
                        <span className="text-xs text-zinc-400">Llegadas Seguras</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {stats.safe_arrivals_count}
                    </p>
                    <p className="text-[10px] text-zinc-500">Esta semana</p>
                </div>

                <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/30">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className={stats.risk_alerts_count === 0 ? "text-green-500" : "text-yellow-500"} />
                        <span className="text-xs text-zinc-400">Alertas Riesgo</span>
                    </div>
                    <p className={`text-2xl font-bold ${stats.risk_alerts_count === 0 ? "text-green-500" : "text-yellow-500"}`}>
                        {stats.risk_alerts_count}
                    </p>
                    <p className="text-[10px] text-zinc-500">Esta semana</p>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-purple-400" />
                    <span>Tu familia está protegida</span>
                </div>
                {stats.risk_alerts_count === 0 && (
                    <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-medium text-[10px]">
                        Semana perfecta
                    </span>
                )}
            </div>
        </div>
    );
}
