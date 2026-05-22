import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, 
    Shield, 
    Map, 
    Zap, 
    AlertTriangle, 
    Navigation2, 
    Search, 
    Clock, 
    Users, 
    Bell,
    Settings as SettingsIcon,
    AlertCircle,
    Route as RouteIcon,
    Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { TrustedContactsService } from '../services/trustedContactsService';
import type { SOSAlert } from '../services/database.types';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export const Security: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    
    const [alarms, setAlarms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAlarms = async () => {
            if (!user) return;
            try {
                // Get accepted contacts to filter relevant alerts
                const contacts = await TrustedContactsService.getContacts(user.id);
                const acceptedContactIds = contacts
                    .filter(c => c.status === 'accepted' && c.associated_user_id)
                    .map(c => c.associated_user_id as string);

                if (acceptedContactIds.length === 0) {
                    setAlarms([]);
                    setIsLoading(false);
                    return;
                }

                // Fetch alerts from contacts (excluding own)
                const { data: alertsData, error } = await supabase
                    .from('sos_alerts')
                    .select('*, profiles:user_id(full_name, avatar_url)')
                    .in('user_id', acceptedContactIds)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (error) throw error;
                setAlarms(alertsData || []);
            } catch (err) {
                console.error('Error fetching security alarms:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlarms();
    }, [user]);

    // Dummy states for visual toggles as requested by user to clarify what is "Active"
    const [toggles, setToggles] = useState({
        danger_zones: true,
        safe_routes: true,
    });

    const handleToggle = (key: keyof typeof toggles) => {
        setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-6 px-6 pt-12 pb-8 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-xl font-black uppercase italic tracking-tighter">Círculo de Seguridad</h1>
                    </div>
                    <button 
                        onClick={() => navigate('/settings')}
                        className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
                    >
                        <SettingsIcon size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-white/5 rounded-2xl border border-white/10 px-4 py-3">
                    <Search size={18} className="text-white/20" />
                    <input 
                        type="text" 
                        placeholder="Buscar en el círculo..." 
                        className="bg-transparent outline-none text-sm text-white placeholder-white/20 flex-1"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
                {/* Alarms Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 italic">Mis Alarmas</h2>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Ver Todo</span>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="py-12 flex flex-col items-center gap-4 opacity-20">
                                <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando...</span>
                            </div>
                        ) : alarms.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-3">
                                <div className="size-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-white/20">
                                    <Bell size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Sin alertas activas</p>
                                    <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Tu círculo está seguro ahora mismo</p>
                                </div>
                            </div>
                        ) : (
                            alarms.map((alarm, idx) => (
                                <div 
                                    key={alarm.id}
                                    className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 active:scale-[0.98] transition-all"
                                >
                                    <div className="relative">
                                        <div className="size-12 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden">
                                            {alarm.profiles?.avatar_url ? (
                                                <img src={alarm.profiles.avatar_url} alt="" className="size-full object-cover" />
                                            ) : (
                                                <Users size={20} className="text-white/20" />
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 size-4 bg-red-500 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center">
                                            <AlertCircle size={8} className="text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-black italic uppercase tracking-tight truncate">
                                                {alarm.profiles?.full_name || 'Miembro del Círculo'}
                                            </p>
                                            <span className="text-[9px] font-bold text-white/20 uppercase">
                                                {new Date(alarm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-white/50 line-clamp-1 leading-relaxed">
                                            {alarm.message || 'Ha activado un aviso de trayecto'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/')}
                                        className="size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center self-center shrink-0"
                                    >
                                        <Map size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Bottom Block Grid */}
                <section className="space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 italic px-2">Configuración Activa</h2>
                    <div className="flex flex-col gap-3">
                        {/* Zonas Peligro */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Zonas de Peligro</h3>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Avisos en tiempo real</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleToggle('danger_zones')}
                                className={clsx("w-14 h-8 rounded-full p-1 transition-colors relative", toggles.danger_zones ? "bg-primary" : "bg-white/10")}
                            >
                                <div className={clsx("size-6 bg-white rounded-full transition-transform absolute top-1", toggles.danger_zones ? "translate-x-6" : "translate-x-0")} />
                            </button>
                        </div>

                        {/* Rutas Seguras GPS */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <RouteIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Rutas Seguras</h3>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">IA de navegación</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleToggle('safe_routes')}
                                className={clsx("w-14 h-8 rounded-full p-1 transition-colors relative", toggles.safe_routes ? "bg-primary" : "bg-white/10")}
                            >
                                <div className={clsx("size-6 bg-white rounded-full transition-transform absolute top-1", toggles.safe_routes ? "translate-x-6" : "translate-x-0")} />
                            </button>
                        </div>



                        {/* Contactos */}
                        <button 
                            onClick={() => navigate('/contacts')}
                            className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center">
                                    <Users size={24} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Contactos</h3>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Gestionar círculo</p>
                                </div>
                            </div>
                            <ChevronLeft size={20} className="text-white/40 rotate-180" />
                        </button>
                    </div>
                </section>

                {/* AI Status Hero (Small version) */}
                <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Zap size={48} className="animate-pulse" />
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Shield size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5 italic">IA Escudo Activo</p>
                            <p className="text-xs font-bold text-white/70">Protección predictiva activada</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
