import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Map, Zap, AlertTriangle, Navigation2, Search } from 'lucide-react';
import clsx from 'clsx';

export const Security: React.FC = () => {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Zonas de Peligro',
            desc: 'Mapa de incidencias en tiempo real.',
            icon: AlertTriangle,
            color: 'text-red-500',
            bg: 'bg-red-500/10'
        },
        {
            title: 'Rutas Seguras AI',
            desc: 'Cálculo de trayectos optimizados.',
            icon: Navigation2,
            color: 'text-primary',
            bg: 'bg-primary/10'
        },
        {
            title: 'Guardianes Activos',
            desc: 'Usuarios RedCarpet cerca de ti.',
            icon: Shield,
            color: 'text-green-500',
            bg: 'bg-green-500/10'
        }
    ];

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-6 px-6 pt-12 pb-8 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-black uppercase italic tracking-tighter">Seguridad Avanzada</h1>
                </div>

                <div className="flex items-center gap-3 bg-white/5 rounded-2xl border border-white/10 px-4 py-3">
                    <Search size={18} className="text-white/20" />
                    <input 
                        type="text" 
                        placeholder="Buscar zonas seguras..." 
                        className="bg-transparent outline-none text-sm text-white placeholder-white/20 flex-1"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {/* Status Hero */}
                <div className="bg-primary/10 border border-primary/20 rounded-[2.5rem] p-8 relative overflow-hidden group animate-fade-in">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Zap size={64} className="animate-pulse" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="size-2 bg-primary rounded-full animate-ping" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">IA Escudo Activo</h3>
                        </div>
                        <p className="text-xl font-black italic tracking-tighter leading-tight uppercase">Tu entorno está siendo monitorizado por RedCarpet AI</p>
                    </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {[
                        {
                            title: 'Zonas de Peligro',
                            desc: 'Ver incidencias en el mapa.',
                            icon: AlertTriangle,
                            color: 'text-red-500',
                            bg: 'bg-red-500/10',
                            path: '/'
                        },
                        {
                            title: 'Rutas Seguras AI',
                            desc: 'Cálculo de trayectos optimizados.',
                            icon: Navigation2,
                            color: 'text-primary',
                            bg: 'bg-primary/10',
                            path: '/route'
                        },
                        {
                            title: 'Guardianes Activos',
                            desc: 'Protección colaborativa activa.',
                            icon: Shield,
                            color: 'text-green-500',
                            bg: 'bg-green-500/10',
                            path: '/'
                        }
                    ].map((m, i) => (
                        <button
                            key={i}
                            onClick={() => navigate(m.path)}
                            className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 active:scale-[0.98] transition-all animate-slide-up w-full text-left"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <div className={clsx(
                                "size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-black/20",
                                m.bg,
                                m.color
                            )}>
                                <m.icon size={28} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-black uppercase italic">{m.title}</h4>
                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest leading-none mt-1">{m.desc}</p>
                            </div>
                            <span className="material-symbols-outlined text-white/10">arrow_forward</span>
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-zinc-900 border border-white/5 rounded-[2.5rem] flex flex-col gap-6 text-center animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <Map size={48} className="text-white/10 mx-auto" />
                    <div>
                        <h3 className="text-sm font-black uppercase italic mb-2">Capa de Seguridad</h3>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                            Activa la capa "RedCarpet Safe" en el mapa principal para ver zonas de riesgo histórico.
                        </p>
                    </div>
                    <button 
                        onClick={() => navigate('/')}
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all"
                    >
                        Configurar Mapa
                    </button>
                </div>
            </div>
        </div>
    );
};
