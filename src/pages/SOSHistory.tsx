import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, History, ShieldAlert, Calendar, MapPin, Clock, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { getSOSHistory } from '../services/sosService';
import type { SOSAlert } from '../services/database.types';

export const SOSHistory: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [alerts, setAlerts] = useState<SOSAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                // If the user has no family group, we use a fallback or fetch by user_id
                // For this implementation, we'll try to get the group_id from the user metadata or profile
                // but based on the schema, alerts are tied to group_id.
                // As a fallback for "Individual" users, we query by user_id if groupId is not available
                const groupId = (user as any).profile?.family_id || (user as any).group_id || user.id;
                const data = await getSOSHistory(groupId);
                setAlerts(data);
            } catch (err) {
                console.error('Error loading SOS history:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 pt-12 pb-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black uppercase italic tracking-tighter">Historial de Alertas</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 mt-20 opacity-40 animate-pulse">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando historial...</p>
                    </div>
                ) : alerts.length > 0 ? (
                    alerts.map((item, index) => (
                        <div
                            key={item.id}
                            className="bg-white/5 rounded-2xl border border-white/5 p-5 space-y-4 animate-slide-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-600/10 rounded-lg text-red-500 shadow-[0_0_15px_rgba(255,49,49,0.2)]">
                                        <ShieldAlert size={18} />
                                    </div>
                                    <h3 className="font-bold text-white/90 text-sm">Alerta SOS</h3>
                                </div>
                                <span className={clsx(
                                    "px-3 py-1 text-[10px] font-black uppercase rounded-full border",
                                    item.status === 'active' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
                                )}>
                                    {item.status === 'active' ? 'Activa' : (item.status === 'resolved' ? 'Resuelta' : 'Cancelada')}
                                </span>
                            </div>

                            <p className="text-xs text-white/60 leading-relaxed font-medium line-clamp-2">
                                {item.message?.split('\n')[0] || 'Sin descripción adicional'}
                            </p>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Calendar size={14} className="text-primary/40" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{formatDate(item.created_at)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/40">
                                    <Clock size={14} className="text-primary/40" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{formatTime(item.created_at)}</span>
                                </div>
                                {item.lat && (
                                    <div className="flex items-center gap-2 text-white/40 col-span-2">
                                        <MapPin size={14} className="text-primary/40" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                                            {item.lat.toFixed(4)}, {item.lng?.toFixed(4)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-20 animate-fade-in mt-20">
                        <div className="size-20 rounded-full border border-white/10 flex items-center justify-center mb-4">
                            <History size={40} strokeWidth={1} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase tracking-widest italic">Paz mental absoluta.</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest mt-1">No tienes alertas recientes.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 pb-12">
                <p className="text-[9px] text-white/20 font-black italic uppercase tracking-[0.2em] text-center leading-relaxed">
                    Tus alertas se archivan de forma segura<br/>por un periodo de 12 meses.
                </p>
            </div>
        </div>
    );
};
